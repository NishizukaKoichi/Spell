import { GitHubConfigError } from './errors';

export interface GitHubWorkflowConfig {
  owner: string;
  repo: string;
  workflowFile: string;
  ref: string;
}

export const DEFAULT_REPOSITORY =
  process.env.GITHUB_REPOSITORY ||
  (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
    ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
    : null);

export function getGitHubWorkflowConfig(): GitHubWorkflowConfig {
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
