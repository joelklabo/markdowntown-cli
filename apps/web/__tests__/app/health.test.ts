import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, computeHealth } from "@/app/api/health/route";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("health endpoint", () => {
  it("returns ok when queue and worker are configured", async () => {
    process.env.WEBPUBSUB_CONNECTION_STRING = "Endpoint=sb://example/";
    process.env.WORKER_IMAGE = "ghcr.io/markdowntown/worker:latest";

    const response = await GET(new Request("https://example.com/api/health"));
    const body = await response.json();

    expect(response.headers.get("x-trace-id")).toBeTruthy();
    expect(body.status).toBe("ok");
    expect(body.services.queue).toBe("ok");
    expect(body.services.worker).toBe("ok");
  });

  it("is degraded when signals are missing", () => {
    delete process.env.WEBPUBSUB_CONNECTION_STRING;
    delete process.env.WORKER_IMAGE;

    const health = computeHealth(new Date("2024-01-01T00:00:00Z"));
    expect(health.status).toBe("degraded");
    expect(health.services.queue).toBe("missing");
    expect(health.services.worker).toBe("missing");
    expect(health.timestamp).toBe("2024-01-01T00:00:00.000Z");
  });
});
