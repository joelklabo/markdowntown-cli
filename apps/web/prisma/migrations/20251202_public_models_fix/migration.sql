-- Bring database schema up to parity with current Prisma models (Snippet, Template, Document, etc.)
-- This is forward-only and tolerant of partially applied earlier migrations.

-- Enum types
DO $$
BEGIN
  CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "SnippetKind" AS ENUM ('SYSTEM', 'STYLE', 'TOOLS', 'FREEFORM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Rename legacy Section table to Snippet when present.
DO $$
BEGIN
  IF to_regclass('"Snippet"') IS NULL AND to_regclass('"Section"') IS NOT NULL THEN
    ALTER TABLE "Section" RENAME TO "Snippet";
  END IF;
END
$$;

-- Ensure Snippet columns exist.
ALTER TABLE "Snippet"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "kind" "SnippetKind" NOT NULL DEFAULT 'FREEFORM',
  ADD COLUMN IF NOT EXISTS "views" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "copies" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "downloads" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "votesUp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "votesDown" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "favoritesCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commentsCount" INTEGER NOT NULL DEFAULT 0;

-- Snippet indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Snippet_slug_key" ON "Snippet"("slug");
CREATE INDEX IF NOT EXISTS "Snippet_visibility_idx" ON "Snippet"("visibility");
CREATE INDEX IF NOT EXISTS "Snippet_createdAt_idx" ON "Snippet"("createdAt");
CREATE INDEX IF NOT EXISTS "Snippet_updatedAt_idx" ON "Snippet"("updatedAt");
CREATE INDEX IF NOT EXISTS "Snippet_tags_gin" ON "Snippet" USING gin ("tags");

-- Templates
CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "body" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "views" INTEGER NOT NULL DEFAULT 0,
  "copies" INTEGER NOT NULL DEFAULT 0,
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Template_slug_key" ON "Template"("slug");
CREATE INDEX IF NOT EXISTS "Template_visibility_idx" ON "Template"("visibility");
CREATE INDEX IF NOT EXISTS "Template_tags_gin" ON "Template" USING gin("tags");
CREATE INDEX IF NOT EXISTS "Template_userId_idx" ON "Template"("userId");
CREATE INDEX IF NOT EXISTS "Template_createdAt_idx" ON "Template"("createdAt");
CREATE INDEX IF NOT EXISTS "Template_updatedAt_idx" ON "Template"("updatedAt");

-- Documents
CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "renderedContent" TEXT,
  "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "views" INTEGER NOT NULL DEFAULT 0,
  "copies" INTEGER NOT NULL DEFAULT 0,
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Document_slug_key" ON "Document"("slug");
CREATE INDEX IF NOT EXISTS "Document_visibility_idx" ON "Document"("visibility");
CREATE INDEX IF NOT EXISTS "Document_tags_gin" ON "Document" USING gin("tags");
CREATE INDEX IF NOT EXISTS "Document_userId_idx" ON "Document"("userId");
CREATE INDEX IF NOT EXISTS "Document_createdAt_idx" ON "Document"("createdAt");
CREATE INDEX IF NOT EXISTS "Document_updatedAt_idx" ON "Document"("updatedAt");

-- DocumentSnippet join
CREATE TABLE IF NOT EXISTS "DocumentSnippet" (
  "documentId" TEXT NOT NULL,
  "snippetId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "overrides" JSONB,
  CONSTRAINT "DocumentSnippet_pkey" PRIMARY KEY ("documentId", "position"),
  CONSTRAINT "DocumentSnippet_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentSnippet_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DocumentSnippet_snippetId_idx" ON "DocumentSnippet"("snippetId");

-- Engagement tables
CREATE TABLE IF NOT EXISTS "Vote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Vote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Vote_target_idx" ON "Vote"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Favorite_target_idx" ON "Favorite"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Comment_target_idx" ON "Comment"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Event_target_idx" ON "Event"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Event_kind_created_idx" ON "Event"("kind", "createdAt");
