import type { ExecutionInput, ExecutionResult, ExecutionService } from './types'

/**
 * Workflow Service
 *
 * Executes spells via GitHub Actions workflow dispatch.
 * This mode is suitable for:
 * - Long-running tasks
 * - Scheduled executions
 * - Tasks requiring full GitHub ecosystem integration
 */
export class WorkflowExecutionService implements ExecutionService {
  private readonly githubToken: string
  private readonly repoOwner: string
  private readonly repoName: string

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN || ''
    this.repoOwner = process.env.GITHUB_REPO_OWNER || ''
    this.repoName = process.env.GITHUB_REPO_NAME || ''

    if (!this.githubToken || !this.repoOwner || !this.repoName) {
      throw new Error('GitHub configuration missing for workflow execution')
    }
  }

  async execute(input: ExecutionInput): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      // Dispatch GitHub Actions workflow
      const workflowId = `spell-${input.spellKey}.yml`
      const response = await fetch(
        `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${workflowId}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              castId: input.castId,
              spellId: input.spellId,
              userId: input.userId,
              input: JSON.stringify(input.input),
            },
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`GitHub workflow dispatch failed: ${response.statusText}`)
      }

      const duration = Date.now() - startTime

      // Note: GitHub Actions runs async, so we return "queued" status
      // A webhook will update the status later
      return {
        status: 'queued',
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        status: 'failed',
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
