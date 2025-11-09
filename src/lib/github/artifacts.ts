import { GITHUB_API_BASE, GITHUB_API_VERSION } from './constants';
import { getGitHubWorkflowConfig } from './config';
import { GitHubAppError } from './errors';
import { getInstallationToken } from './tokens';
import { mapStatusToCode, safeJson } from './utils';

export interface GitHubArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expires_at: string;
  expired: boolean;
  archive_download_url: string;
}

export async function listRunArtifactsWithRepo(owner: string, repo: string, runId: number) {
  const { token } = await getInstallationToken(owner, repo);

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    }
  );

  if (response.status === 404) {
    throw new GitHubAppError(
      `Run ${runId} not found in ${owner}/${repo}`,
      'WORKFLOW_NOT_FOUND',
      404
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new GitHubAppError(
      `Failed to list artifacts for run ${runId}`,
      mapStatusToCode(response.status),
      response.status,
      body
    );
  }

  const payload = (await response.json()) as { artifacts: GitHubArtifact[] };
  return payload.artifacts;
}

export async function listRunArtifacts(runId: number) {
  const cfg = getGitHubWorkflowConfig();
  return listRunArtifactsWithRepo(cfg.owner, cfg.repo, runId);
}

export async function getArtifactDownloadUrlWithRepo(
  owner: string,
  repo: string,
  artifactId: number
) {
  const { token } = await getInstallationToken(owner, repo);
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      redirect: 'manual',
    }
  );

  if (response.status === 302) {
    const location = response.headers.get('location');
    if (!location) {
      throw new GitHubAppError(
        `GitHub returned redirect without location for artifact ${artifactId}`,
        'INTERNAL',
        500
      );
    }
    return location;
  }

  if (response.status === 404 || response.status === 410) {
    throw new GitHubAppError(
      `Artifact ${artifactId} not found or expired`,
      'ARTIFACT_EXPIRED',
      410
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new GitHubAppError(
      `Failed to fetch artifact ${artifactId}`,
      mapStatusToCode(response.status),
      response.status,
      body
    );
  }

  return undefined;
}

export async function getArtifactDownloadUrl(artifactId: number) {
  const cfg = getGitHubWorkflowConfig();
  return getArtifactDownloadUrlWithRepo(cfg.owner, cfg.repo, artifactId);
}
