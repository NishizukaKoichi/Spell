import { prisma } from '@/lib/prisma';

/**
 * WASM execution metrics
 */
export interface WasmMetrics {
  executionTimeMs: number;
  memoryUsedMb: number;
  success: boolean;
  error?: string;
  spellId: string;
  castId: string;
  wasmVersion: string;
  timestamp: Date;
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgExecutionTimeMs: number;
  avgMemoryUsedMb: number;
  totalExecutionTimeMs: number;
  totalMemoryUsedMb: number;
  p50ExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  p99ExecutionTimeMs: number;
}

/**
 * Track WASM execution metrics
 */
export async function trackWasmExecution(metrics: WasmMetrics): Promise<void> {
  try {
    await prisma.wasmExecution.create({
      data: {
        castId: metrics.castId,
        spellId: metrics.spellId,
        executionTimeMs: metrics.executionTimeMs,
        memoryUsedMb: metrics.memoryUsedMb,
        wasmVersion: metrics.wasmVersion,
        success: metrics.success,
        errorMessage: metrics.error || null,
        metadata: {
          timestamp: metrics.timestamp.toISOString(),
        },
      },
    });

    console.log('Tracked WASM execution metrics:', {
      castId: metrics.castId,
      success: metrics.success,
      executionTimeMs: metrics.executionTimeMs,
      memoryUsedMb: metrics.memoryUsedMb,
    });
  } catch (error) {
    console.error('Failed to track WASM execution metrics:', error);
    // Don't throw - metrics tracking should not break execution
  }
}

/**
 * Get aggregated metrics for a spell
 */
export async function getSpellMetrics(
  spellId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AggregatedMetrics> {
  const whereClause: {
    spellId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    spellId,
  };

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = startDate;
    if (endDate) whereClause.createdAt.lte = endDate;
  }

  const executions = await prisma.wasmExecution.findMany({
    where: whereClause,
    select: {
      executionTimeMs: true,
      memoryUsedMb: true,
      success: true,
    },
    orderBy: {
      executionTimeMs: 'asc',
    },
  });

  const totalExecutions = executions.length;

  if (totalExecutions === 0) {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,
      avgExecutionTimeMs: 0,
      avgMemoryUsedMb: 0,
      totalExecutionTimeMs: 0,
      totalMemoryUsedMb: 0,
      p50ExecutionTimeMs: 0,
      p95ExecutionTimeMs: 0,
      p99ExecutionTimeMs: 0,
    };
  }

  const successfulExecutions = executions.filter((e) => e.success).length;
  const failedExecutions = totalExecutions - successfulExecutions;
  const successRate = (successfulExecutions / totalExecutions) * 100;

  const totalExecutionTimeMs = executions.reduce((sum, e) => sum + e.executionTimeMs, 0);
  const totalMemoryUsedMb = executions.reduce((sum, e) => sum + e.memoryUsedMb, 0);

  const avgExecutionTimeMs = totalExecutionTimeMs / totalExecutions;
  const avgMemoryUsedMb = totalMemoryUsedMb / totalExecutions;

  // Calculate percentiles
  const p50Index = Math.floor(totalExecutions * 0.5);
  const p95Index = Math.floor(totalExecutions * 0.95);
  const p99Index = Math.floor(totalExecutions * 0.99);

  const p50ExecutionTimeMs = executions[p50Index]?.executionTimeMs || 0;
  const p95ExecutionTimeMs = executions[p95Index]?.executionTimeMs || 0;
  const p99ExecutionTimeMs = executions[p99Index]?.executionTimeMs || 0;

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    successRate,
    avgExecutionTimeMs,
    avgMemoryUsedMb,
    totalExecutionTimeMs,
    totalMemoryUsedMb,
    p50ExecutionTimeMs,
    p95ExecutionTimeMs,
    p99ExecutionTimeMs,
  };
}

/**
 * Compare WASM vs GitHub Actions performance
 */
export async function compareExecutionEngines(
  spellId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  wasm: AggregatedMetrics;
  githubActions: {
    totalExecutions: number;
    avgExecutionTimeMs: number;
    successRate: number;
  };
}> {
  // Get WASM metrics
  const wasmMetrics = await getSpellMetrics(spellId, startDate, endDate);

  // Get GitHub Actions metrics from Cast table
  const whereClause: {
    spellId: string;
    githubRunId: { not: null };
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    spellId,
    githubRunId: { not: null },
  };

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = startDate;
    if (endDate) whereClause.createdAt.lte = endDate;
  }

  const casts = await prisma.cast.findMany({
    where: whereClause,
    select: {
      duration: true,
      status: true,
    },
  });

  const totalCasts = casts.length;
  const successfulCasts = casts.filter((c) => c.status === 'completed').length;
  const totalDuration = casts.reduce((sum, c) => sum + (c.duration || 0), 0);

  return {
    wasm: wasmMetrics,
    githubActions: {
      totalExecutions: totalCasts,
      avgExecutionTimeMs: totalCasts > 0 ? totalDuration / totalCasts : 0,
      successRate: totalCasts > 0 ? (successfulCasts / totalCasts) * 100 : 0,
    },
  };
}

/**
 * Get recent execution history for a spell
 */
export async function getExecutionHistory(
  spellId: string,
  limit = 100
): Promise<
  Array<{
    id: string;
    castId: string;
    executionTimeMs: number;
    memoryUsedMb: number;
    success: boolean;
    errorMessage: string | null;
    createdAt: Date;
  }>
> {
  return await prisma.wasmExecution.findMany({
    where: {
      spellId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    select: {
      id: true,
      castId: true,
      executionTimeMs: true,
      memoryUsedMb: true,
      success: true,
      errorMessage: true,
      createdAt: true,
    },
  });
}

/**
 * Get performance trends over time
 */
export async function getPerformanceTrends(
  spellId: string,
  days = 30
): Promise<
  Array<{
    date: string;
    executions: number;
    avgExecutionTimeMs: number;
    avgMemoryUsedMb: number;
    successRate: number;
  }>
> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const executions = await prisma.wasmExecution.findMany({
    where: {
      spellId,
      createdAt: {
        gte: startDate,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Group by date
  const groupedByDate = new Map<
    string,
    {
      executions: number;
      totalTime: number;
      totalMemory: number;
      successful: number;
    }
  >();

  for (const execution of executions) {
    const date = execution.createdAt.toISOString().split('T')[0];
    const existing = groupedByDate.get(date) || {
      executions: 0,
      totalTime: 0,
      totalMemory: 0,
      successful: 0,
    };

    existing.executions++;
    existing.totalTime += execution.executionTimeMs;
    existing.totalMemory += execution.memoryUsedMb;
    if (execution.success) existing.successful++;

    groupedByDate.set(date, existing);
  }

  // Convert to array
  const trends = Array.from(groupedByDate.entries()).map(([date, data]) => ({
    date,
    executions: data.executions,
    avgExecutionTimeMs: data.totalTime / data.executions,
    avgMemoryUsedMb: data.totalMemory / data.executions,
    successRate: (data.successful / data.executions) * 100,
  }));

  return trends;
}

/**
 * Calculate cost based on WASM execution metrics
 */
export function calculateWasmCost(executionTimeMs: number, memoryUsedMb: number): number {
  // Pricing model:
  // - $0.001 per second of execution time
  // - $0.0001 per MB of memory used
  // Result in cents

  const timeCostCents = (executionTimeMs / 1000) * 0.1; // $0.001 per second = 0.1 cents
  const memoryCostCents = memoryUsedMb * 0.01; // $0.0001 per MB = 0.01 cents

  const totalCostCents = Math.ceil(timeCostCents + memoryCostCents);

  // Minimum cost: 1 cent
  return Math.max(1, totalCostCents);
}

/**
 * Get cost statistics for a spell
 */
export async function getSpellCostStats(
  spellId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCost: number;
  avgCostPerExecution: number;
  totalExecutions: number;
}> {
  const metrics = await getSpellMetrics(spellId, startDate, endDate);

  if (metrics.totalExecutions === 0) {
    return {
      totalCost: 0,
      avgCostPerExecution: 0,
      totalExecutions: 0,
    };
  }

  // Calculate costs for all executions
  const totalCost = calculateWasmCost(
    metrics.totalExecutionTimeMs,
    metrics.totalMemoryUsedMb
  );

  return {
    totalCost,
    avgCostPerExecution: totalCost / metrics.totalExecutions,
    totalExecutions: metrics.totalExecutions,
  };
}

/**
 * Monitor resource usage and alert if thresholds exceeded
 */
export interface ResourceThresholds {
  maxAvgExecutionTimeMs?: number;
  maxAvgMemoryUsedMb?: number;
  minSuccessRate?: number;
}

export async function checkResourceThresholds(
  spellId: string,
  thresholds: ResourceThresholds
): Promise<{
  ok: boolean;
  alerts: string[];
}> {
  const metrics = await getSpellMetrics(spellId);
  const alerts: string[] = [];

  if (
    thresholds.maxAvgExecutionTimeMs &&
    metrics.avgExecutionTimeMs > thresholds.maxAvgExecutionTimeMs
  ) {
    alerts.push(
      `Average execution time (${metrics.avgExecutionTimeMs.toFixed(2)}ms) exceeds threshold (${thresholds.maxAvgExecutionTimeMs}ms)`
    );
  }

  if (thresholds.maxAvgMemoryUsedMb && metrics.avgMemoryUsedMb > thresholds.maxAvgMemoryUsedMb) {
    alerts.push(
      `Average memory usage (${metrics.avgMemoryUsedMb.toFixed(2)}MB) exceeds threshold (${thresholds.maxAvgMemoryUsedMb}MB)`
    );
  }

  if (thresholds.minSuccessRate && metrics.successRate < thresholds.minSuccessRate) {
    alerts.push(
      `Success rate (${metrics.successRate.toFixed(2)}%) is below threshold (${thresholds.minSuccessRate}%)`
    );
  }

  return {
    ok: alerts.length === 0,
    alerts,
  };
}
