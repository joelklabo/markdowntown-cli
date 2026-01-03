import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function ArtifactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/a/${encodeURIComponent(slug)}`);
}
