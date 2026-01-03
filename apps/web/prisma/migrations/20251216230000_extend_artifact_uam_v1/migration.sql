-- Extend Artifact + ArtifactVersion for UAM v1.
--
-- Notes on legacy data:
-- - Prior enum values included SNIPPET/AGENT/DOCUMENT. These are mapped to the new
--   ArtifactType values as follows:
--   - TEMPLATE -> TEMPLATE
--   - SNIPPET -> MODULE
--   - AGENT/DOCUMENT -> ARTIFACT

-- AlterEnum
BEGIN;
CREATE TYPE "ArtifactType_new" AS ENUM ('TEMPLATE', 'MODULE', 'ARTIFACT');

-- Rewrite existing values before casting into the new enum.
ALTER TABLE "Artifact" ALTER COLUMN "type" TYPE TEXT USING ("type"::text);
UPDATE "Artifact"
SET "type" = CASE
  WHEN "type" = 'TEMPLATE' THEN 'TEMPLATE'
  WHEN "type" = 'SNIPPET' THEN 'MODULE'
  ELSE 'ARTIFACT'
END;

ALTER TABLE "Artifact" ALTER COLUMN "type" TYPE "ArtifactType_new" USING ("type"::text::"ArtifactType_new");
ALTER TYPE "ArtifactType" RENAME TO "ArtifactType_old";
ALTER TYPE "ArtifactType_new" RENAME TO "ArtifactType";
DROP TYPE "ArtifactType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Artifact"
  ADD COLUMN "forkedFromId" TEXT,
  ADD COLUMN "hasScopes" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lintGrade" TEXT,
  ADD COLUMN "targets" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable (preserve existing JSON content as UAM)
ALTER TABLE "ArtifactVersion" RENAME COLUMN "content" TO "uam";
ALTER TABLE "ArtifactVersion"
  ADD COLUMN "compiled" JSONB,
  ADD COLUMN "lint" JSONB,
  ALTER COLUMN "version" SET DEFAULT 'draft',
  ALTER COLUMN "version" SET DATA TYPE TEXT USING ("version"::text);

-- CreateIndex
CREATE INDEX "Artifact_tags_idx" ON "Artifact" USING GIN ("tags");
CREATE INDEX "Artifact_targets_idx" ON "Artifact" USING GIN ("targets");
CREATE INDEX "Artifact_forkedFromId_idx" ON "Artifact"("forkedFromId");

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

