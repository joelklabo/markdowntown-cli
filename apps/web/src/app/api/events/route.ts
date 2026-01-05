import { NextRequest } from "next/server";
import { eventHub } from "@/lib/events/eventHub";
import type { RealtimeEvent } from "@/lib/pubsub/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const onRunEvent = (event: RealtimeEvent) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      eventHub.on("run_event", onRunEvent);

      req.signal.addEventListener("abort", () => {
        eventHub.off("run_event", onRunEvent);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
