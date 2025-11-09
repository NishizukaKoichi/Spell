// TKT-002: Execution Mode Type Definitions
// SPEC Reference: Section 7 (Execution Modes)

/**
 * Execution Mode
 * Defines how a Spell is executed
 */
export type ExecutionMode = 'workflow' | 'service' | 'clone';

/**
 * Workflow Execution Configuration
 * For GitHub Actions workflow-based execution
 */
export interface WorkflowExecution {
  repo: string;
  workflow_id: string;
  dispatch: 'workflow_dispatch' | 'repository_dispatch';
}

/**
 * Service Execution Configuration
 * For serverless runtime execution (WASM/Container)
 */
export interface ServiceExecution {
  runtime: 'wasm' | 'container';
  timeout_ms: number;
  max_memory_mb: number;
  max_output_mb: number;
}

/**
 * Clone Execution Configuration
 * For template repository cloning
 */
export interface CloneExecution {
  template_repo: string;
  license_url?: string;
}
