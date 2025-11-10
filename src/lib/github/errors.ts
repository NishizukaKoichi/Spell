import type { ApiErrorCode } from '@/lib/api-response';

export class GitHubConfigError extends Error {}

export class GitHubAppError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode,
    public status: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'GitHubAppError';
  }
}
