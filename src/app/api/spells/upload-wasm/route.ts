import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateWasmModule, calculateWasmHash } from '@/lib/wasm/runtime';
import { storeWasmModule } from '@/lib/wasm/module-loader';
import {
  logWasmModuleUploaded,
  logWasmModuleValidated,
  logWasmModuleValidationFailed,
  getRequestContext,
} from '@/lib/audit-log';

/**
 * POST /api/spells/upload-wasm
 * Upload a WASM module for a spell
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    }

    const userId = session.user.id;

    // Parse multipart form data
    const formData = await req.formData();
    const spellId = formData.get('spellId') as string;
    const version = formData.get('version') as string;
    const wasmFile = formData.get('wasmFile') as File;

    // Validation
    if (!spellId) {
      return apiError('VALIDATION_ERROR', 422, 'spellId is required');
    }

    if (!version) {
      return apiError('VALIDATION_ERROR', 422, 'version is required');
    }

    if (!wasmFile) {
      return apiError('VALIDATION_ERROR', 422, 'wasmFile is required');
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (wasmFile.size > maxSize) {
      return apiError(
        'VALIDATION_ERROR',
        422,
        `WASM file size (${wasmFile.size} bytes) exceeds maximum allowed size (${maxSize} bytes)`
      );
    }

    // Verify spell exists and user owns it
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!spell) {
      return apiError('WORKFLOW_NOT_FOUND', 404, 'Spell not found');
    }

    if (spell.authorId !== userId) {
      return apiError('UNAUTHORIZED', 403, 'You do not have permission to upload WASM for this spell');
    }

    // Read file as buffer
    const arrayBuffer = await wasmFile.arrayBuffer();
    const wasmBinary = Buffer.from(arrayBuffer);

    // Get request context for audit logging
    const { ipAddress, userAgent } = getRequestContext(req);

    // Validate WASM binary
    if (!validateWasmModule(wasmBinary)) {
      await logWasmModuleValidationFailed(
        userId,
        spellId,
        'Invalid WASM binary',
        'Missing WASM magic number',
      );
      return apiError('VALIDATION_ERROR', 422, 'Invalid WASM binary: missing magic number');
    }

    // Calculate hash
    const hash = calculateWasmHash(wasmBinary);

    // Store WASM module
    const { id: moduleId } = await storeWasmModule(spellId, version, wasmBinary, {
      fileName: wasmFile.name,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    });

    // Update spell with WASM module reference
    await prisma.spell.update({
      where: { id: spellId },
      data: {
        wasmModuleHash: hash,
        executionEngine: 'wasm', // Auto-switch to WASM engine
      },
    });

    // Log upload event
    await logWasmModuleUploaded(userId, moduleId, spellId, version, wasmBinary.length, hash);

    // Log validation event
    await logWasmModuleValidated(userId, moduleId, spellId, hash);

    return apiSuccess(
      {
        moduleId,
        spellId,
        version,
        hash,
        size: wasmBinary.length,
        message: 'WASM module uploaded successfully',
      },
      201
    );
  } catch (error) {
    console.error('WASM upload error:', error);
    return apiError('INTERNAL', 500, 'Failed to upload WASM module');
  }
}

/**
 * GET /api/spells/upload-wasm?spellId=xxx
 * List WASM modules for a spell
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const spellId = searchParams.get('spellId');

    if (!spellId) {
      return apiError('VALIDATION_ERROR', 422, 'spellId is required');
    }

    // Verify spell exists and user owns it
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!spell) {
      return apiError('WORKFLOW_NOT_FOUND', 404, 'Spell not found');
    }

    if (spell.authorId !== userId) {
      return apiError('UNAUTHORIZED', 403, 'You do not have permission to view WASM modules for this spell');
    }

    // Get all WASM modules for the spell
    const modules = await prisma.wasmModule.findMany({
      where: { spellId },
      select: {
        id: true,
        version: true,
        hash: true,
        size: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiSuccess({
      spellId,
      modules,
      total: modules.length,
    });
  } catch (error) {
    console.error('WASM list error:', error);
    return apiError('INTERNAL', 500, 'Failed to list WASM modules');
  }
}

/**
 * DELETE /api/spells/upload-wasm?moduleId=xxx
 * Delete a WASM module
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get('moduleId');

    if (!moduleId) {
      return apiError('VALIDATION_ERROR', 422, 'moduleId is required');
    }

    // Get module and verify ownership
    const module = await prisma.wasmModule.findUnique({
      where: { id: moduleId },
      include: {
        spell: {
          select: {
            authorId: true,
          },
        },
      },
    });

    if (!module) {
      return apiError('WORKFLOW_NOT_FOUND', 404, 'WASM module not found');
    }

    if (module.spell.authorId !== userId) {
      return apiError('UNAUTHORIZED', 403, 'You do not have permission to delete this WASM module');
    }

    // Delete module
    await prisma.wasmModule.delete({
      where: { id: moduleId },
    });

    return apiSuccess({
      moduleId,
      message: 'WASM module deleted successfully',
    });
  } catch (error) {
    console.error('WASM delete error:', error);
    return apiError('INTERNAL', 500, 'Failed to delete WASM module');
  }
}
