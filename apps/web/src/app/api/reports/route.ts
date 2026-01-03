import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "node:fs";
import path from "node:path";

function isAdmin(email?: string | null) {
  const list =
    process.env.ADMIN_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (list.length === 0) return false;
  return email ? list.includes(email.toLowerCase()) : false;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(session.user.email ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = path.join(process.cwd(), "logs", "abuse-signals.log");
  if (!fs.existsSync(file)) return NextResponse.json([]);
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  const entries = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return { raw: l };
    }
  });
  return NextResponse.json(entries.slice(-200));
}
