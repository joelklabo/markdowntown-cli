export type RealtimeEvent = {
  runId: string;
  snapshotId: string;
  projectId?: string | null;
  status: string;
  type: string;
  error?: string | null;
};

export type RealtimeListener = (event: RealtimeEvent) => void;

class RealtimeClient {
  private listeners: Set<RealtimeListener> = new Set();
  private eventSource: EventSource | null = null;

  subscribe(listener: RealtimeListener) {
    this.listeners.add(listener);
    if (!this.eventSource) {
      this.connect();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private connect() {
    if (typeof window === "undefined") return;
    
    this.eventSource = new EventSource("/api/events");
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach((l) => l(data));
      } catch (e) {
        console.error("Failed to parse event data", e);
      }
    };
    this.eventSource.onerror = () => {
      console.error("SSE connection error");
      this.disconnect();
      // Reconnect after 5s
      setTimeout(() => this.connect(), 5000);
    };
  }

  private disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();
