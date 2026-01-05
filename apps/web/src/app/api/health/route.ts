import { NextResponse } from "next/server";
import { withAPM } from "@/lib/observability";

type ServiceStatus = "ok" | "missing";
type HealthStatus = "ok" | "degraded";

export type HealthResponse = {
  status: HealthStatus;
  services: {
    queue: ServiceStatus;
    worker: ServiceStatus;
  };
  timestamp: string;
};

export function computeHealth(now: Date = new Date()): HealthResponse {
  const queue = process.env.WEBPUBSUB_CONNECTION_STRING ? "ok" : "missing";
  const worker = process.env.WORKER_IMAGE || process.env.WORKER_CONTAINER ? "ok" : "missing";
  const status: HealthStatus = queue === "ok" && worker === "ok" ? "ok" : "degraded";

  return {
    status,
    services: { queue, worker },
    timestamp: now.toISOString(),
  };
}

export async function GET(request: Request) {
  return withAPM(request, async () => NextResponse.json(computeHealth()));
}
