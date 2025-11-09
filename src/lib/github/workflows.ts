import { GITHUB_API_BASE, GITHUB_API_VERSION } from './constants';
import { getGitHubWorkflowConfig } from './config';
import { GitHubAppError } from './errors';
import { getInstallationToken } from './tokens';
import { mapStatusToCode, safeJson } from './utils';

interface WorkflowDispatchInput {
  owner: string;
  repo: string;
  workflowFile: string;
  ref: string;
  inputs: Record<string, unknown>;
}

interface RepositoryDispatchInput {
  owner: string;
  repo: string;
  eventType: string;
  clientPayload: Record<string, unknown>;
}

export async function triggerWorkflowDispatch(inputs: Record<string, unknown>) {
  const cfg = getGitHubWorkflowConfig();
  return triggerWorkflowDispatchWithConfig({ ...cfg, inputs });
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
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'Content-Type': 'application/json',
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

export async function triggerRepositoryDispatch(
  eventType: string,
  clientPayload: Record<string, unknown>
) {
  const cfg = getGitHubWorkflowConfig();
  return triggerRepositoryDispatchWithConfig({
    owner: cfg.owner,
    repo: cfg.repo,
    eventType,
    clientPayload,
  });
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

export async function getLatestWorkflowRun(workflowFile: string, maxWaitMs = 5000) {
  const cfg = getGitHubWorkflowConfig();
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
        const createdAt = new Date(latestRun.created_at).getTime();
        if (Date.now() - createdAt < 30000) {
          return latestRun.id;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
}
