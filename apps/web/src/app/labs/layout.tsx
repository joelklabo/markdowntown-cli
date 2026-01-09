import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export default async function LabsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!isAdmin(session?.user)) {
    redirect("/signin?error=unauthorized");
  }

  return <>{children}</>;
}
