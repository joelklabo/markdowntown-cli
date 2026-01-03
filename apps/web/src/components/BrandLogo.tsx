import Image from "next/image";
import Link from "next/link";
import { Wordmark, type WordmarkProps } from "@/components/Wordmark";

type BrandLogoProps = {
  showWordmark?: boolean;
  size?: number;
  asLink?: boolean;
};

export function BrandLogo({ showWordmark = true, size = 40, asLink = true }: BrandLogoProps) {
  const wordmarkSize: NonNullable<WordmarkProps["size"]> =
    size <= 28 ? "sm" : size <= 44 ? "md" : "lg";

  const content = (
    <>
      <Image src="/markdown-town-icon.svg" alt="mark downtown logo" width={size} height={size} priority />
      {showWordmark && <Wordmark asLink={false} size={wordmarkSize} />}
    </>
  );

  if (!asLink) {
    return <span className="inline-flex items-center gap-2">{content}</span>;
  }

  return (
    <Link href="/" className="inline-flex items-center gap-2">
      {content}
    </Link>
  );
}
