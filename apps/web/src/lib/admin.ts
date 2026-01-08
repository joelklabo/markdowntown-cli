const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ?? [];

export function isAdmin(user: { email?: string | null } | null | undefined): boolean {
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email);
}
