import { DEFAULT_REPOSITORY } from './config';
import { GitHubAppError, GitHubConfigError } from './errors';
import { GITHUB_API_BASE, GITHUB_API_VERSION } from './constants';
import { mapStatusToCode, safeJson } from './utils';

const installationCache = new Map<string, number>();

export async function resolveInstallationId(owner: string, repo: string, jwt: string) {
  const cacheKey = `${owner}/${repo}`;
  const cached = installationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const envInstallationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (envInstallationId) {
    const parsed = Number(envInstallationId);
    if (Number.isNaN(parsed)) {
      throw new GitHubConfigError('Invalid GITHUB_APP_INSTALLATION_ID');
    }

    if (!DEFAULT_REPOSITORY || cacheKey === DEFAULT_REPOSITORY) {
      installationCache.set(cacheKey, parsed);
      return parsed;
    }
  }

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/installation`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });

  if (response.status === 404) {
    throw new GitHubAppError(
      `GitHub App is not installed for ${owner}/${repo}`,
      'FORBIDDEN_REPO',
      403
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new GitHubAppError(
      `Failed to resolve installation for ${owner}/${repo}`,
      mapStatusToCode(response.status),
      response.status,
      body
    );
  }

  const data = (await response.json()) as { id: number };
  installationCache.set(cacheKey, data.id);
  return data.id;
}
