import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { listRunArtifactsWithRepo } from '@/lib/github-app';
import { updateBudgetSpend } from '@/lib/budget';

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
 * Verify GitHub webhook signature
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signature.slice(7);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');

  // Use timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(calculatedSignature));
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
    // Verify webhook secret
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('GITHUB_WEBHOOK_SECRET is not configured');
      return apiError('INTERNAL', 500, 'Webhook secret not configured');
    }

    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) {
      return apiError('UNAUTHORIZED', 401, 'Missing signature');
    }

    const rawBody = await req.text();
    const isValid = verifySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return apiError('UNAUTHORIZED', 401, 'Invalid signature');
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

    // Update Cast based on action
    switch (action) {
      case 'in_progress':
        await prisma.cast.update({
          where: { id: castId },
          data: {
            status: 'running',
            startedAt: new Date(workflow_run.created_at),
            githubRunId: workflow_run.id.toString(),
            githubRunAttempt: workflow_run.run_attempt,
          },
        });
        break;

      case 'completed': {
        const isSuccess = workflow_run.conclusion === 'success';
        const status = isSuccess ? 'succeeded' : 'failed';
        const finishedAt = new Date(workflow_run.updated_at);

        // Calculate duration in milliseconds
        const startedAt = new Date(workflow_run.created_at);
        const duration = finishedAt.getTime() - startedAt.getTime();

        // Fetch artifacts if succeeded
        let artifactUrl: string | null = null;
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
                // Store the archive_download_url
                // Note: This URL requires authentication, so we'll need to proxy it
                artifactUrl = `/api/v1/github/runs/${workflow_run.id}/artifacts/${artifact.id}`;
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
            errorMessage: isSuccess ? null : `Workflow concluded with: ${workflow_run.conclusion}`,
          },
          include: {
            caster: true,
          },
        });

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
