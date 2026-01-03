import { revalidateTag } from "next/cache";

export function safeRevalidateTag(tag: string) {
  try {
    revalidateTag(tag, "max");
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`revalidateTag failed for ${tag}`, err);
    }
  }
}
