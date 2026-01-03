import Link from "next/link";
import { cn } from "@/lib/cn";
import { LivingCityWordmark } from "./wordmark/LivingCityWordmark";

type WordmarkSize = "sm" | "md" | "lg";

export type WordmarkProps = {
  asLink?: boolean;
  href?: string;
  size?: WordmarkSize;
  className?: string;
};

const sizeClasses: Record<WordmarkSize, { root: string; svg: string }> = {
  sm: { root: "text-body-sm", svg: "h-5" },
  md: { root: "text-[1.15rem]", svg: "h-7" },
  lg: { root: "text-h3", svg: "h-10" },
};

export function Wordmark({ asLink = true, href = "/", size = "md", className }: WordmarkProps) {
  const classes = cn(
    "inline-flex items-center whitespace-nowrap select-none",
    sizeClasses[size].root,
    className
  );

  const content = (
    <LivingCityWordmark
      className={cn(
        "w-auto shrink-0"
      )}
      containerClassName={cn("w-auto", sizeClasses[size].svg)}
    />
  );

  if (!asLink) {
    return (
      <span data-testid="wordmark" className={classes} aria-label="mark downtown">
        {content}
      </span>
    );
  }

  return (
    <Link data-testid="wordmark" href={href} className={classes} aria-label="mark downtown">
      {content}
    </Link>
  );
}
