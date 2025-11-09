import { GitHubAppError, GitHubConfigError } from './errors';
import { GITHUB_API_BASE, GITHUB_API_VERSION } from './constants';
import { resolveInstallationId } from './installations';
import { createAppJwt, normalizePrivateKey, mapStatusToCode, safeJson } from './utils';

interface CachedInstallationToken {
  token: string;
  expiresAt: number;
}

interface InstallationTokenResult extends CachedInstallationToken {
  installationId: number;
}

const tokenCache = new Map<number, CachedInstallationToken>();

export async function getInstallationToken(
  owner: string,
  repo: string
): Promise<InstallationTokenResult> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyEnv = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKeyEnv) {
    throw new GitHubConfigError('Missing GitHub App credentials');
  }

  const privateKey = normalizePrivateKey(privateKeyEnv);
  const jwt = createAppJwt(appId, privateKey);
  const installationId = await resolveInstallationId(owner, repo, jwt);
  const cached = tokenCache.get(installationId);

  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return { ...cached, installationId };
  }

  const response = await fetch(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    }
  );

  if (!response.ok) {
    const body = await safeJson(response);
    const status = response.status;
    const code = mapStatusToCode(status);
    throw new GitHubAppError(`Failed to create installation token (${status})`, code, status, body);
  }

  const payload = (await response.json()) as { token: string; expires_at: string };
  const entry: CachedInstallationToken = {
    token: payload.token,
    expiresAt: new Date(payload.expires_at).getTime(),
  };

  tokenCache.set(installationId, entry);

  return { ...entry, installationId };
}
