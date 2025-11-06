import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { listRunArtifactsWithRepo, downloadGitHubArtifact } from '@/lib/github-app';
import { updateBudgetSpend } from '@/lib/budget';
import {
  verifyGitHubSignature,
  WebhookSignatureError,
  WebhookConfigError,
} from '@/lib/webhook';
import {
  publishCastStatusChange,
  publishCastStarted,
  publishCastCompleted,
  publishCastFailed,
} from '@/lib/cast-events';
import { uploadArtifact, generateArtifactKey } from '@/lib/storage';
import { logArtifactUploaded } from '@/lib/audit-log';

/**
 * GitHub Webhook Handler
 *
 * Handles workflow_run events from GitHub Actions to update Cast status.
 *
 * Events we handle:
 * - workflow_run.completed: Update Cast status and fetch artifacts
 * - workflow_run.in_progress: Update Cast status to running
 *
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_run
 */

interface WorkflowRunPayload {
  action: 'requested' | 'in_progress' | 'completed';
  workflow_run: {
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion:
      | 'success'
      | 'failure'
      | 'cancelled'
      | 'timed_out'
      | 'action_required'
      | 'neutral'
      | 'skipped'
      | 'stale'
      | null;
    html_url: string;
    run_attempt: number;
    created_at: string;
    updated_at: string;
  };
  repository: {
    full_name: string;
    owner: {
      login: string;
    };
    name: string;
  };
}

/**
 * Extract cast_id from workflow run
 *
 * The cast_id can be passed via:
 * 1. Workflow dispatch inputs (inputs.cast_id)
 * 2. Repository dispatch client_payload (client_payload.cast_id)
 * 3. Workflow run name (if it contains cast_id)
 */
async function extractCastId(runId: number, _owner: string, _repo: string): Promise<string | null> {
  // For now, we search the database for a Cast with this githubRunId
  // In the future, we should extract cast_id from workflow inputs/client_payload
  const cast = await prisma.cast.findFirst({
    where: {
      githubRunId: runId.toString(),
    },
  });

  return cast?.id || null;
}

export async function POST(req: NextRequest) {
  try {
    // Get raw body and signature
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    // Verify webhook signature
    try {
      verifyGitHubSignature(
        rawBody,
        signature,
        process.env.GITHUB_WEBHOOK_SECRET
      );
    } catch (err) {
      if (err instanceof WebhookConfigError) {
        console.error('[GitHub Webhook] Configuration error:', err.message);
        return apiError('INTERNAL', 500, 'Webhook secret not configured');
      }

      if (err instanceof WebhookSignatureError) {
        console.error('[GitHub Webhook] Signature verification failed:', err.details);
        return apiError('UNAUTHORIZED', 401, err.message);
      }

      console.error('[GitHub Webhook] Unexpected error during verification:', err);
      return apiError('INTERNAL', 500, 'Webhook verification failed');
    }

    // Parse event type
    const eventType = req.headers.get('x-github-event');
    if (eventType !== 'workflow_run') {
      // Ignore non-workflow_run events
      return apiSuccess({ message: 'Event type not handled' });
    }

    const payload = JSON.parse(rawBody) as WorkflowRunPayload;
    const { action, workflow_run, repository } = payload;

    // Extract cast_id
    const castId = await extractCastId(workflow_run.id, repository.owner.login, repository.name);

    if (!castId) {
      console.warn(`[GitHub Webhook] No cast found for run ${workflow_run.id}`);
      return apiSuccess({ message: 'No associated cast found' });
    }

    // Fetch the cast to get previous status and user ID
    const existingCast = await prisma.cast.findUnique({
      where: { id: castId },
      select: { status: true, casterId: true },
    });

    if (!existingCast) {
      console.warn(`[GitHub Webhook] Cast ${castId} not found`);
      return apiSuccess({ message: 'Cast not found' });
    }

    const previousStatus = existingCast.status;

    // Update Cast based on action
    switch (action) {
      case 'in_progress': {
        const startedAt = new Date(workflow_run.created_at);

        await prisma.cast.update({
          where: { id: castId },
          data: {
            status: 'running',
            startedAt,
            githubRunId: workflow_run.id.toString(),
            githubRunAttempt: workflow_run.run_attempt,
          },
        });

        // Publish cast started event
        await publishCastStarted(castId, existingCast.casterId, startedAt);
        break;
      }

      case 'completed': {
        const isSuccess = workflow_run.conclusion === 'success';
        const status = isSuccess ? 'succeeded' : 'failed';
        const finishedAt = new Date(workflow_run.updated_at);

        // Calculate duration in milliseconds
        const startedAt = new Date(workflow_run.created_at);
        const duration = finishedAt.getTime() - startedAt.getTime();

        // Fetch and store artifacts if succeeded
        let artifactUrl: string | null = null;
        let artifactStorageKey: string | null = null;
        let artifactSize: number | null = null;
        let artifactContentType: string | null = null;

        if (isSuccess) {
          try {
            const artifacts = await listRunArtifactsWithRepo(
              repository.owner.login,
              repository.name,
              workflow_run.id
            );

            if (artifacts.length > 0) {
              // Use the first non-expired artifact
              const artifact = artifacts.find((a) => !a.expired);
              if (artifact) {
                try {
                  // Download artifact from GitHub
                  console.log(`[GitHub Webhook] Downloading artifact ${artifact.id}...`);
                  const artifactBuffer = await downloadGitHubArtifact(
                    repository.owner.login,
                    repository.name,
                    artifact.id
                  );

                  // Upload to R2
                  const filename = artifact.name || 'output.zip';
                  console.log(`[GitHub Webhook] Uploading artifact to R2: ${filename}`);
                  artifactStorageKey = await uploadArtifact({
                    castId,
                    filename,
                    content: artifactBuffer,
                    contentType: 'application/zip',
                    metadata: {
                      githubArtifactId: artifact.id.toString(),
                      githubRunId: workflow_run.id.toString(),
                    },
                  });

                  artifactSize = artifactBuffer.length;
                  artifactContentType = 'application/zip';

                  // Generate internal artifact URL for access
                  artifactUrl = `/api/artifacts/${castId}/${filename}`;

                  // Log artifact upload
                  await logArtifactUploaded(
                    existingCast.casterId,
                    castId,
                    filename,
                    artifactSize,
                    artifactStorageKey
                  );

                  console.log(`[GitHub Webhook] Artifact uploaded successfully: ${artifactStorageKey}`);
                } catch (uploadError) {
                  console.error(`[GitHub Webhook] Failed to upload artifact to R2:`, uploadError);
                  // Fallback to old behavior
                  artifactUrl = `/api/v1/github/runs/${workflow_run.id}/artifacts/${artifact.id}`;
                }
              }
            }
          } catch (error) {
            console.error(`[GitHub Webhook] Failed to fetch artifacts:`, error);
          }
        }

        const updatedCast = await prisma.cast.update({
          where: { id: castId },
          data: {
            status,
            finishedAt,
            duration: Math.round(duration),
            artifactUrl,
            artifactStorageKey,
            artifactSize,
            artifactContentType,
            errorMessage: isSuccess ? null : `Workflow concluded with: ${workflow_run.conclusion}`,
          },
          include: {
            caster: true,
          },
        });

        // Publish appropriate event based on status
        if (isSuccess) {
          await publishCastCompleted(
            castId,
            existingCast.casterId,
            finishedAt,
            Math.round(duration),
            updatedCast.costCents,
            artifactUrl
          );
        } else {
          await publishCastFailed(
            castId,
            existingCast.casterId,
            updatedCast.errorMessage || 'Workflow failed',
            finishedAt
          );
        }

        // Update budget spend if execution succeeded
        // Note: We charge even for failed executions (user consumed resources)
        if (updatedCast.costCents > 0) {
          try {
            await updateBudgetSpend(updatedCast.casterId, updatedCast.costCents);
          } catch (error) {
            console.error(`[GitHub Webhook] Failed to update budget:`, error);
            // Don't fail the webhook if budget update fails
          }
        }
        break;
      }

      default:
        // Ignore other actions (requested, etc.)
        break;
    }

    return apiSuccess({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('[GitHub Webhook] Error:', error);
    return apiError('INTERNAL', 500, 'Failed to process webhook');
  }
}
