import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Function to send SSE message
  const sendEvent = async (data: any) => {
    try {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
      );
    } catch (error) {
      console.error("Error writing to stream:", error);
    }
  };

  // Start polling for cast updates
  const pollInterval = setInterval(async () => {
    try {
      const cast = await prisma.cast.findUnique({
        where: { id },
        include: {
          spell: true,
        },
      });

      if (!cast) {
        await sendEvent({ error: "Cast not found" });
        clearInterval(pollInterval);
        await writer.close();
        return;
      }

      // Send current cast status
      await sendEvent({
        id: cast.id,
        status: cast.status,
        startedAt: cast.startedAt,
        finishedAt: cast.finishedAt,
        duration: cast.duration,
        errorMessage: cast.errorMessage,
        artifactUrl: cast.artifactUrl,
        costCents: cast.costCents,
      });

      // If cast is in a terminal state, stop polling
      if (cast.status === "completed" || cast.status === "failed") {
        clearInterval(pollInterval);
        await writer.close();
      }
    } catch (error) {
      console.error("Error polling cast:", error);
      await sendEvent({ error: "Failed to fetch cast status" });
      clearInterval(pollInterval);
      await writer.close();
    }
  }, 2000); // Poll every 2 seconds

  // Handle client disconnect
  req.signal.addEventListener("abort", () => {
    clearInterval(pollInterval);
    writer.close();
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
