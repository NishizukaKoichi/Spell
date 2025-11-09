import { NextRequest } from 'next/server';

import { apiError, apiSuccess } from '@/lib/api-response';
import { requireApiKey } from '@/lib/api-middleware';
import {
  GitHubAppError,
  GitHubConfigError,
  getArtifactDownloadUrlWithRepo,
  getGitHubWorkflowConfig,
  listRunArtifactsWithRepo,
} from '@/lib/github-app';

interface RouteParams {
  runId: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  const { runId } = await params;
  const runIdNumber = Number(runId);

  if (Number.isNaN(runIdNumber) || runIdNumber <= 0) {
    return apiError('VALIDATION_ERROR', 422, 'runId must be a positive integer');
  }

  const authResult = await requireApiKey(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const url = new URL(req.url);
  const repoOverride = url.searchParams.get('repo');
  const artifactName = url.searchParams.get('artifact_name');
  const includeExpired = url.searchParams.get('include_expired') === 'true';

  let owner: string;
  let repo: string;

  try {
    if (repoOverride) {
      const [o, r] = repoOverride.split('/');
      if (!o || !r) {
        return apiError('VALIDATION_ERROR', 422, 'repo query param must be in the form owner/repo');
      }
      owner = o;
      repo = r;
    } else {
      const cfg = getGitHubWorkflowConfig();
      owner = cfg.owner;
      repo = cfg.repo;
    }
  } catch (error) {
    if (error instanceof GitHubConfigError) {
      return apiError('INTERNAL', 500, error.message);
    }

    throw error;
  }

  try {
    const artifacts = await listRunArtifactsWithRepo(owner, repo, runIdNumber);
    const filtered = artifacts.filter((artifact) => {
      const matchesName = artifactName ? artifact.name === artifactName : true;
      const matchesExpiry = includeExpired ? true : !artifact.expired;
      return matchesName && matchesExpiry;
    });

    if (filtered.length === 0) {
      return apiError('ARTIFACT_EXPIRED', 410, 'Artifact not found or expired');
    }

    const results = [];
    for (const artifact of filtered) {
      let downloadUrl: string | undefined;
      try {
        downloadUrl = await getArtifactDownloadUrlWithRepo(owner, repo, artifact.id);
      } catch (error) {
        if (error instanceof GitHubAppError && error.code === 'ARTIFACT_EXPIRED') {
          // Skip expired artifacts unless explicitly requested
          if (!includeExpired) {
            continue;
          }
        } else if (error instanceof GitHubAppError) {
          throw error;
        } else {
          console.error('Failed to resolve artifact download URL:', error);
          throw new GitHubAppError('Failed to resolve artifact download URL', 'INTERNAL', 500);
        }
      }

      results.push({
        id: artifact.id,
        name: artifact.name,
        size_in_bytes: artifact.size_in_bytes,
        created_at: artifact.created_at,
        expires_at: artifact.expires_at,
        expired: artifact.expired,
        download_url: downloadUrl ?? null,
      });
    }

    if (results.length === 0) {
      return apiError('ARTIFACT_EXPIRED', 410, 'Artifact not found or expired');
    }

    return apiSuccess({ artifacts: results });
  } catch (error) {
    if (error instanceof GitHubAppError) {
      return apiError(error.code, error.status, error.message);
    }

    if (error instanceof GitHubConfigError) {
      return apiError('INTERNAL', 500, error.message);
    }

    console.error('Unexpected artifact fetch error:', error);
    return apiError('INTERNAL', 500, 'Failed to fetch artifacts');
  }
}
