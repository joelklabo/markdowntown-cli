import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { PublicSkillSummary } from "@/lib/skills/skillTypes";
import { SkillCard } from "@/components/skills/SkillCard";

export function SkillsList({ skills, className, ...rest }: { skills: PublicSkillSummary[] } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-mdt-4 lg:grid-cols-2", className)} {...rest}>
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  );
}
