import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { getArtifactUrl, validateFilename } from '@/lib/storage';
import {
  logArtifactDownloaded,
  logArtifactAccessDenied,
  getRequestContext,
} from '@/lib/audit-log';

/**
 * GET /api/artifacts/[castId]/[filename]
 *
 * Download artifact for a cast
 *
 * Authentication: Required
 * Authorization: User must be cast owner OR spell must be public
 *
 * Returns: Redirect to signed R2 URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { castId: string; filename: string } }
) {
  try {
    const session = await auth();
    const { castId, filename } = params;

    // Validate filename for security
    if (!validateFilename(filename)) {
      return apiError('VALIDATION_ERROR', 400, 'Invalid filename');
    }

    // Get cast with spell info
    const cast = await prisma.cast.findUnique({
      where: { id: castId },
      include: {
        spell: {
          select: {
            status: true,
            authorId: true,
          },
        },
        caster: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!cast) {
      return apiError('NOT_FOUND', 404, 'Cast not found');
    }

    // Check if artifact exists in R2
    if (!cast.artifactStorageKey) {
      return apiError('NOT_FOUND', 404, 'Artifact not found in storage');
    }

    // Authorization check
    const userId = session?.user?.id;
    const isCastOwner = userId && cast.casterId === userId;
    const isSpellAuthor = userId && cast.spell.authorId === userId;
    const isPublicSpell = cast.spell.status === 'public';

    if (!isCastOwner && !isSpellAuthor && !isPublicSpell) {
      // Log unauthorized access attempt
      const { ipAddress, userAgent } = getRequestContext(request);
      await logArtifactAccessDenied(
        userId || null,
        castId,
        filename,
        'User is not cast owner and spell is not public',
        ipAddress,
        userAgent
      );

      return apiError('FORBIDDEN', 403, 'Access denied: You do not have permission to access this artifact');
    }

    // Generate signed URL (expires in 1 hour)
    const signedUrl = await getArtifactUrl({
      castId,
      filename,
      expiresIn: 3600, // 1 hour
      download: true, // Set Content-Disposition to attachment
    });

    // Log artifact download
    if (userId) {
      const { ipAddress, userAgent } = getRequestContext(request);
      await logArtifactDownloaded(userId, castId, filename, ipAddress, userAgent);
    }

    // Redirect to signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('[Artifact Download] Error:', error);
    return apiError('INTERNAL', 500, 'Failed to download artifact');
  }
}
