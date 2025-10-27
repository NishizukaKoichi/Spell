import type { ExecutionMode, ExecutionService } from './types'
import { WorkflowExecutionService } from './workflow-service'
import { ServiceExecutionService } from './service-mode'

/**
 * Execution Service Factory
 *
 * Returns the appropriate execution service based on execution mode
 */
export function getExecutionService(mode: ExecutionMode): ExecutionService {
  switch (mode) {
    case 'workflow':
      return new WorkflowExecutionService()
    case 'service':
      return new ServiceExecutionService()
    case 'clone':
      // Clone mode: user owns the code, no execution needed
      throw new Error('Clone mode does not support execution')
    default:
      throw new Error(`Unknown execution mode: ${mode}`)
  }
}
