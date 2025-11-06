import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';

/**
 * SSE (Server-Sent Events) endpoint for real-time cast progress updates
 *
 * Usage:
 * const eventSource = new EventSource('/api/v1/casts/{cast_id}/events');
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log(data.status, data.message);
 * };
 *
 * Event format:
 * {
 *   "cast_id": "...",
 *   "status": "queued" | "running" | "succeeded" | "failed",
 *   "message": "...",
 *   "progress": 0-100,
 *   "artifact_url": "..." (if succeeded)
 * }
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: castId } = await params;

    // Verify cast exists
    const cast = await prisma.cast.findUnique({
      where: { id: castId },
      include: {
        spell: {
          select: {
            name: true,
            key: true,
          },
        },
      },
    });

    if (!cast) {
      return apiError('WORKFLOW_NOT_FOUND', 404, 'Cast not found');
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial status
        const sendEvent = (data: unknown) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Send initial cast status
        sendEvent({
          cast_id: cast.id,
          spell_key: cast.spell.key,
          spell_name: cast.spell.name,
          status: cast.status,
          message: getStatusMessage(cast.status),
          progress: getProgress(cast.status),
          started_at: cast.startedAt?.toISOString(),
          artifact_url: cast.artifactUrl,
        });

        // Poll for updates every 2 seconds
        intervalId = setInterval(async () => {
          try {
            const updatedCast = await prisma.cast.findUnique({
              where: { id: castId },
              include: {
                spell: {
                  select: {
                    name: true,
                    key: true,
                  },
                },
              },
            });

            if (!updatedCast) {
              controller.close();
              return;
            }

            // Send update
            sendEvent({
              cast_id: updatedCast.id,
              spell_key: updatedCast.spell.key,
              spell_name: updatedCast.spell.name,
              status: updatedCast.status,
              message: getStatusMessage(updatedCast.status),
              progress: getProgress(updatedCast.status),
              started_at: updatedCast.startedAt?.toISOString(),
              finished_at: updatedCast.finishedAt?.toISOString(),
              duration_ms: updatedCast.duration,
              artifact_url: updatedCast.artifactUrl,
              error_message: updatedCast.errorMessage,
            });

            // Close stream if cast is in terminal state
            if (updatedCast.status === 'succeeded' || updatedCast.status === 'failed') {
              clearInterval(intervalId);
              // Send final event
              sendEvent({
                cast_id: updatedCast.id,
                status: updatedCast.status,
                message: 'Stream closed',
                final: true,
              });
              controller.close();
            }
          } catch (error) {
            console.error('[SSE] Error fetching cast update:', error);
            clearInterval(intervalId);
            controller.close();
          }
        }, 2000);
      },

      cancel() {
        if (intervalId) {
          clearInterval(intervalId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[SSE] Error:', error);
    return apiError('INTERNAL', 500, 'Failed to create event stream');
  }
}

function getStatusMessage(status: string): string {
  switch (status) {
    case 'queued':
      return 'Cast is queued for execution';
    case 'running':
      return 'Cast is currently running';
    case 'succeeded':
      return 'Cast succeeded';
    case 'failed':
      return 'Cast execution failed';
    default:
      return 'Unknown status';
  }
}

function getProgress(status: string): number {
  switch (status) {
    case 'queued':
      return 10;
    case 'running':
      return 50;
    case 'succeeded':
      return 100;
    case 'failed':
      return 100;
    default:
      return 0;
  }
}
