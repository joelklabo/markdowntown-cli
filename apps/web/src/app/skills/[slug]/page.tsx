import { notFound } from "next/navigation";
import { SkillDetail } from "@/components/skills/SkillDetail";
import { SkillDetailTracker } from "@/components/skills/SkillDetailTracker";
import { Container } from "@/components/ui/Container";
import { getPublicSkill } from "@/lib/publicSkills";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let skill = null;
  try {
    skill = await getPublicSkill(slug);
  } catch (err) {
    console.warn("skill detail load failed", err);
    skill = null;
  }

  if (!skill) notFound();

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <SkillDetailTracker
          id={skill.id}
          slug={skill.slug ?? skill.id}
          title={skill.title}
          targets={skill.targets}
          capabilityCount={skill.capabilityCount}
        />
        <SkillDetail skill={skill} />
      </Container>
    </main>
  );
}
