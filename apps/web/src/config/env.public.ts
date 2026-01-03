import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://app.posthog.com"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const parsed = publicSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid public environment variables: ${JSON.stringify(formatted, null, 2)}`);
}

export const envPublic = parsed.data;
