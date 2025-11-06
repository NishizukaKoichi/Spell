import { prisma } from '@/lib/prisma';
import { executeWasmWithMonitoring } from '@/lib/wasm/worker-runner';
import { trackWasmExecution, calculateWasmCost } from '@/lib/wasm/metrics';
import { serializeInput, deserializeOutput, validateInput } from '@/lib/wasm/io-handler';
import { WasmResourceLimits } from '@/lib/wasm/runtime';
import {
  triggerWorkflowDispatch,
  getLatestWorkflowRun,
  getGitHubWorkflowConfig,
} from '@/lib/github-app';

/**
 * Execution engine types
 */
export type ExecutionEngine = 'wasm' | 'github_actions' | 'hybrid';

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  memoryUsedMb?: number;
  costCents: number;
  engine: ExecutionEngine;
  fallback?: boolean;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  input?: unknown;
  timeout?: number;
  limits?: Partial<WasmResourceLimits>;
  allowFallback?: boolean;
}

/**
 * Determine which execution engine to use for a spell
 */
export async function determineExecutionEngine(spellId: string): Promise<{
  engine: ExecutionEngine;
  canUseWasm: boolean;
  reason: string;
}> {
  const spell = await prisma.spell.findUnique({
    where: { id: spellId },
    select: {
      executionEngine: true,
      wasmModuleUrl: true,
      wasmModuleHash: true,
      executionMode: true,
    },
  });

  if (!spell) {
    return {
      engine: 'github_actions',
      canUseWasm: false,
      reason: 'Spell not found',
    };
  }

  // Check if WASM module is available
  const hasWasmModule = spell.wasmModuleUrl || spell.wasmModuleHash;

  if (spell.executionEngine === 'wasm') {
    if (!hasWasmModule) {
      return {
        engine: 'github_actions',
        canUseWasm: false,
        reason: 'WASM engine configured but no module available',
      };
    }
    return {
      engine: 'wasm',
      canUseWasm: true,
      reason: 'Spell configured for WASM execution',
    };
  }

  if (spell.executionEngine === 'hybrid') {
    if (hasWasmModule) {
      return {
        engine: 'wasm',
        canUseWasm: true,
        reason: 'Hybrid mode with WASM module available',
      };
    }
    return {
      engine: 'github_actions',
      canUseWasm: false,
      reason: 'Hybrid mode but no WASM module available',
    };
  }

  // Default to GitHub Actions
  return {
    engine: 'github_actions',
    canUseWasm: hasWasmModule || false,
    reason: 'Spell configured for GitHub Actions execution',
  };
}

/**
 * Execute a spell using the appropriate engine
 */
export async function executeSpell(
  spellId: string,
  castId: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Determine execution engine
    const { engine, canUseWasm, reason } = await determineExecutionEngine(spellId);

    console.log(`Execution engine for spell ${spellId}: ${engine} (${reason})`);

    // Get spell details
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
      select: {
        id: true,
        key: true,
        version: true,
        inputSchema: true,
        resourceLimits: true,
      },
    });

    if (!spell) {
      throw new Error('Spell not found');
    }

    // Validate input against schema
    if (spell.inputSchema) {
      const validation = validateInput(options.input, spell.inputSchema as Record<string, unknown>);
      if (!validation.valid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }
    }

    let result: ExecutionResult;

    if (engine === 'wasm') {
      result = await executeWithWasm(spellId, castId, spell, options);

      // Fallback to GitHub Actions if WASM fails and fallback is allowed
      if (!result.success && options.allowFallback && canUseWasm) {
        console.log(`WASM execution failed, falling back to GitHub Actions: ${result.error}`);
        result = await executeWithGitHub(spellId, castId, spell, options);
        result.fallback = true;
      }
    } else {
      result = await executeWithGitHub(spellId, castId, spell, options);
    }

    return result;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs,
      costCents: 0,
      engine: 'github_actions',
    };
  }
}

/**
 * Execute spell using WASM runtime
 */
async function executeWithWasm(
  spellId: string,
  castId: string,
  spell: {
    id: string;
    key: string;
    version: string;
    resourceLimits: unknown;
  },
  options: ExecutionOptions
): Promise<ExecutionResult> {
  try {
    // Load resource limits from spell configuration
    const resourceLimits = (spell.resourceLimits as Partial<WasmResourceLimits>) || {};

    // Execute WASM module
    const result = await executeWasmWithMonitoring(
      {
        type: 'database',
        spellId: spell.id,
        version: spell.version,
      },
      {
        input: options.input,
        timeout: options.timeout,
        limits: {
          ...resourceLimits,
          ...options.limits,
        },
      },
      {
        spellId: spell.id,
        castId,
        spellKey: spell.key,
      }
    );

    // Calculate cost based on execution metrics
    const costCents = calculateWasmCost(
      result.executionTimeMs,
      result.memoryUsedMb || 0
    );

    // Track metrics
    await trackWasmExecution({
      executionTimeMs: result.executionTimeMs,
      memoryUsedMb: result.memoryUsedMb || 0,
      success: result.success,
      error: result.error,
      spellId: spell.id,
      castId,
      wasmVersion: spell.version,
      timestamp: new Date(),
    });

    return {
      success: result.success,
      output: result.output,
      error: result.error,
      executionTimeMs: result.executionTimeMs,
      memoryUsedMb: result.memoryUsedMb,
      costCents,
      engine: 'wasm',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: 0,
      costCents: 0,
      engine: 'wasm',
    };
  }
}

/**
 * Execute spell using GitHub Actions
 */
async function executeWithGitHub(
  spellId: string,
  castId: string,
  spell: {
    id: string;
    key: string;
  },
  options: ExecutionOptions
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    const cfg = getGitHubWorkflowConfig();

    // Trigger workflow
    await triggerWorkflowDispatch({
      cast_id: castId,
      spell_key: spell.key,
      input_data: JSON.stringify(options.input || {}),
    });

    // Get run ID
    const runId = await getLatestWorkflowRun(cfg.workflowFile, 5000);

    // Update cast with GitHub run ID
    await prisma.cast.update({
      where: { id: castId },
      data: {
        status: 'running',
        startedAt: new Date(),
        githubRunId: runId ? runId.toString() : null,
      },
    });

    const executionTimeMs = Date.now() - startTime;

    // GitHub Actions cost (estimated - actual cost will be calculated later)
    const costCents = 10; // Base cost for GitHub Actions

    return {
      success: true,
      executionTimeMs,
      costCents,
      engine: 'github_actions',
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs,
      costCents: 0,
      engine: 'github_actions',
    };
  }
}

/**
 * Get execution engine statistics
 */
export async function getExecutionEngineStats(
  startDate?: Date,
  endDate?: Date
): Promise<{
  wasm: {
    totalExecutions: number;
    successRate: number;
    avgExecutionTimeMs: number;
    totalCostCents: number;
  };
  githubActions: {
    totalExecutions: number;
    successRate: number;
    avgExecutionTimeMs: number;
    totalCostCents: number;
  };
}> {
  // WASM stats
  const wasmExecutions = await prisma.wasmExecution.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const wasmTotal = wasmExecutions.length;
  const wasmSuccessful = wasmExecutions.filter((e) => e.success).length;
  const wasmTotalTime = wasmExecutions.reduce((sum, e) => sum + e.executionTimeMs, 0);
  const wasmTotalCost = wasmExecutions.reduce(
    (sum, e) => sum + calculateWasmCost(e.executionTimeMs, e.memoryUsedMb),
    0
  );

  // GitHub Actions stats
  const githubCasts = await prisma.cast.findMany({
    where: {
      githubRunId: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const githubTotal = githubCasts.length;
  const githubSuccessful = githubCasts.filter((c) => c.status === 'completed').length;
  const githubTotalTime = githubCasts.reduce((sum, c) => sum + (c.duration || 0), 0);
  const githubTotalCost = githubCasts.reduce((sum, c) => sum + c.costCents, 0);

  return {
    wasm: {
      totalExecutions: wasmTotal,
      successRate: wasmTotal > 0 ? (wasmSuccessful / wasmTotal) * 100 : 0,
      avgExecutionTimeMs: wasmTotal > 0 ? wasmTotalTime / wasmTotal : 0,
      totalCostCents: wasmTotalCost,
    },
    githubActions: {
      totalExecutions: githubTotal,
      successRate: githubTotal > 0 ? (githubSuccessful / githubTotal) * 100 : 0,
      avgExecutionTimeMs: githubTotal > 0 ? githubTotalTime / githubTotal : 0,
      totalCostCents: githubTotalCost,
    },
  };
}

/**
 * Update spell execution engine
 */
export async function updateSpellExecutionEngine(
  spellId: string,
  engine: ExecutionEngine
): Promise<void> {
  await prisma.spell.update({
    where: { id: spellId },
    data: {
      executionEngine: engine,
    },
  });

  console.log(`Updated spell ${spellId} execution engine to: ${engine}`);
}
