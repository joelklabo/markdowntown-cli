import { hasHardFailure, loadDocSnapshot, refreshDocumentation } from "@/lib/docs/refresh";

export async function GET() {
  const [registry, inventory] = await Promise.all([loadDocSnapshot("registry"), loadDocSnapshot("inventory")]);
  return Response.json({ registry, inventory });
}

export async function POST() {
  const result = await refreshDocumentation();
  const status = hasHardFailure(result) ? 502 : 200;
  return Response.json(result, { status });
}
