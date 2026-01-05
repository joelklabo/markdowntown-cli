import { eventHub } from "@/lib/events/eventHub";
import type { RealtimeEvent } from "./client";

export async function broadcastRunEvent(event: RealtimeEvent) {
  // In the future, this would use Azure Web PubSub
  // For now, it just emits to the local eventHub for SSE
  eventHub.emit("run_event", event);
}
