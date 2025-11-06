import crypto from 'crypto';

import { ApiErrorCode } from './api-response';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

export class GitHubConfigError extends Error {}

export class GitHubAppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly responseBody?: unknown;

  constructor(message: string, code: ApiErrorCode, status: number, responseBody?: unknown) {
    super(message);
    this.name = 'GitHubAppError';
    this.status = status;
    this.code = code;
    this.responseBody = responseBody;
  }
}

interface CachedInstallationToken {
  token: string;
  expiresAt: number;
}

interface InstallationTokenResult extends CachedInstallationToken {
  installationId: number;
}

interface GitHubWorkflowConfig {
  owner: string;
  repo: string;
  workflowFile: string;
  ref: string;
}

interface WorkflowDispatchInput {
  owner: string;
  repo: string;
  workflowFile: string;
  ref: string;
  inputs: Record<string, unknown>;
}

export interface GitHubArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expires_at: string;
  expired: boolean;
  archive_download_url: string;
}

const installationCache = new Map<string, number>();
const tokenCache = new Map<number, CachedInstallationToken>();
const DEFAULT_REPOSITORY =
  process.env.GITHUB_REPOSITORY ||
  (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
    ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
    : null);

function base64UrlEncode(input: Buffer | string) {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizePrivateKey(rawKey: string) {
  const key = rawKey.includes('BEGIN')
    ? rawKey
    : `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----`;
  return key.replace(/\\n/g, '\n');
}

function createAppJwt(appId: string, privateKey: string) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();

  const signature = signer.sign(privateKey);
  return `${data}.${base64UrlEncode(signature)}`;
}

function getWorkflowConfig(): GitHubWorkflowConfig {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyEnv = process.env.GITHUB_APP_PRIVATE_KEY;
  const repository = DEFAULT_REPOSITORY;

  if (!appId) {
    throw new GitHubConfigError('Missing GITHUB_APP_ID');
  }

  if (!privateKeyEnv) {
    throw new GitHubConfigError('Missing GITHUB_APP_PRIVATE_KEY');
  }

  if (!repository) {
    throw new GitHubConfigError('Missing GITHUB_REPOSITORY configuration');
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new GitHubConfigError(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  return {
    owner,
    repo,
    workflowFile: process.env.GITHUB_WORKFLOW_FILE || 'spell-execution.yml',
    ref: process.env.GITHUB_WORKFLOW_REF || 'main',
  };
}

async function resolveInstallationId(owner: string, repo: string, jwt: string) {
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

async function getInstallationToken(owner: string, repo: string): Promise<InstallationTokenResult> {
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

function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN_REPO';
    case 404:
      return 'WORKFLOW_NOT_FOUND';
    case 409:
      return 'IDEMPOTENCY_CONFLICT';
    case 410:
      return 'ARTIFACT_EXPIRED';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 504:
      return 'TIMEOUT';
    default:
      return 'INTERNAL';
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function triggerWorkflowDispatch(inputs: Record<string, unknown>) {
  const cfg = getWorkflowConfig();
  return triggerWorkflowDispatchWithConfig({ ...cfg, inputs });
}

/**
 * Trigger repository_dispatch event
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
 */
export async function triggerRepositoryDispatch(
  eventType: string,
  clientPayload: Record<string, unknown>
) {
  const cfg = getWorkflowConfig();
  return triggerRepositoryDispatchWithConfig({
    owner: cfg.owner,
    repo: cfg.repo,
    eventType,
    clientPayload,
  });
}

interface RepositoryDispatchInput {
  owner: string;
  repo: string;
  eventType: string;
  clientPayload: Record<string, unknown>;
}

export async function triggerRepositoryDispatchWithConfig(config: RepositoryDispatchInput) {
  const { owner, repo, eventType, clientPayload } = config;
  const { token } = await getInstallationToken(owner, repo);

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: clientPayload,
    }),
  });

  if (response.status === 404) {
    throw new GitHubAppError(
      `Repository ${owner}/${repo} not found or no workflow listening to ${eventType}`,
      'WORKFLOW_NOT_FOUND',
      404
    );
  }

  if (response.status === 403) {
    throw new GitHubAppError(
      `GitHub App lacks permission for ${owner}/${repo}`,
      'FORBIDDEN_REPO',
      403
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new GitHubAppError(
      `Failed to dispatch repository event (${response.status})`,
      mapStatusToCode(response.status),
      response.status,
      body
    );
  }
}

export async function triggerWorkflowDispatchWithConfig(config: WorkflowDispatchInput) {
  const { owner, repo, workflowFile, ref, inputs } = config;
  const { token } = await getInstallationToken(owner, repo);

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      body: JSON.stringify({
        ref,
        inputs,
      }),
    }
  );

  if (response.status === 404) {
    throw new GitHubAppError(
      `Workflow ${workflowFile} not found in ${owner}/${repo}`,
      'WORKFLOW_NOT_FOUND',
      404
    );
  }

  if (response.status === 403) {
    throw new GitHubAppError(
      `GitHub App lacks permission for ${owner}/${repo}`,
      'FORBIDDEN_REPO',
      403
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new GitHubAppError(
      `Failed to dispatch workflow (${response.status})`,
      mapStatusToCode(response.status),
      response.status,
      body
    );
  }
}

export async function listRunArtifacts(runId: number) {
  const cfg = getWorkflowConfig();
  return listRunArtifactsWithRepo(cfg.owner, cfg.repo, runId);
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

export async function getArtifactDownloadUrl(artifactId: number) {
  const cfg = getWorkflowConfig();
  return getArtifactDownloadUrlWithRepo(cfg.owner, cfg.repo, artifactId);
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

  // Fallback: if GitHub ever returns 200, return empty to avoid crashing callers.
  return undefined;
}

/**
 * Get the most recent workflow run for a repository
 * This is useful after triggering workflow_dispatch to get the run_id
 */
export async function getLatestWorkflowRun(workflowFile: string, maxWaitMs = 5000) {
  const cfg = getWorkflowConfig();
  return getLatestWorkflowRunWithRepo(cfg.owner, cfg.repo, workflowFile, maxWaitMs);
}

export async function getLatestWorkflowRunWithRepo(
  owner: string,
  repo: string,
  workflowFile: string,
  maxWaitMs = 5000
): Promise<number | null> {
  const { token } = await getInstallationToken(owner, repo);
  const startTime = Date.now();

  // Poll for the workflow run (it may take a few seconds to appear)
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
        },
      }
    );

    if (response.ok) {
      const data = (await response.json()) as {
        workflow_runs: Array<{ id: number; created_at: string }>;
      };

      if (data.workflow_runs.length > 0) {
        const latestRun = data.workflow_runs[0];
        // Check if this run was created recently (within last 30 seconds)
        const createdAt = new Date(latestRun.created_at).getTime();
        if (Date.now() - createdAt < 30000) {
          return latestRun.id;
        }
      }
    }

    // Wait 1 second before next poll
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
}

export function getGitHubWorkflowConfig() {
  return getWorkflowConfig();
}

/**
 * Download artifact from GitHub Actions
 * Returns the artifact content as a Buffer
 */
export async function downloadGitHubArtifact(
  owner: string,
  repo: string,
  artifactId: number
): Promise<Buffer> {
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
    }
  );

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
      `Failed to download artifact ${artifactId}`,
      mapStatusToCode(response.status),
      response.status,
      body
    );
  }

  // Read response as buffer
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
