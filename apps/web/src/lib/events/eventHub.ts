import { EventEmitter } from "events";

class EventHub extends EventEmitter {
  private static instance: EventHub;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): EventHub {
    if (!EventHub.instance) {
      EventHub.instance = new EventHub();
    }
    return EventHub.instance;
  }
}

export const eventHub = EventHub.getInstance();
