import { NextResponse } from "next/server";
import { withAPM } from "@/lib/observability";
import { computeHealth } from "@/lib/health";

export async function GET(request: Request) {
  return withAPM(request, async () => NextResponse.json(computeHealth()));
}
