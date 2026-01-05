import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

type Handler = () => Promise<NextResponse> | NextResponse;

type StructuredLog = {
  event: string;
  traceId: string;
  durationMs?: number;
  path?: string;
  method?: string;
  status?: number;
  message?: string;
  [key: string]: unknown;
};

function logInfo(payload: StructuredLog) {
  try {
    console.info(payload.event, payload);
  } catch {
    // ignore console failures
  }
}

function logError(payload: StructuredLog) {
  try {
    console.error(payload.event, payload);
  } catch {
    // ignore console failures
  }
}

export async function withAPM(request: Request, handler: Handler): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? randomUUID();
  const path = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return "unknown";
    }
  })();
  const start = nowMs();
  let response: NextResponse;
  try {
    response = await handler();
  } catch (err) {
    const duration = nowMs() - start;
    logError({
      event: "api_error",
      path,
      traceId,
      durationMs: Number(duration.toFixed(1)),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const duration = nowMs() - start;
  const headers = response.headers;

  headers.set("x-trace-id", traceId);
  headers.set("x-request-id", traceId);
  const existingTiming = headers.get("Server-Timing");
  const totalTiming = `total;dur=${duration.toFixed(1)};desc=${traceId}`;
  headers.set("Server-Timing", existingTiming ? `${existingTiming}, ${totalTiming}` : totalTiming);

  logInfo({
    event: "api_request",
    path,
    method: request.method,
    status: response.status,
    traceId,
    durationMs: Number(duration.toFixed(1)),
  });

  return response;
}

export function auditLog(event: string, data: Record<string, unknown>, traceId?: string) {
  logInfo({ event, traceId: traceId ?? "unknown", ...data });

  try {
    Sentry.addBreadcrumb({
      category: "api",
      message: event,
      data: { ...data, traceId },
      level: "info",
    });
  } catch {
    // ignore sentry failures/misconfig
  }
}
