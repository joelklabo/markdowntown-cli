/*
  Warnings:

  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Vote` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('SNIPPET', 'TEMPLATE', 'AGENT', 'DOCUMENT');

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentSnippet" DROP CONSTRAINT "DocumentSnippet_documentId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentSnippet" DROP CONSTRAINT "DocumentSnippet_snippetId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_userId_fkey";

-- DropForeignKey
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_userId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";

-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_userId_fkey";

-- DropIndex
DROP INDEX "Document_createdAt_idx";

-- DropIndex
DROP INDEX "Document_tags_gin";

-- DropIndex
DROP INDEX "Document_updatedAt_idx";

-- DropIndex
DROP INDEX "Snippet_tags_gin";

-- DropIndex
DROP INDEX "Template_createdAt_idx";

-- DropIndex
DROP INDEX "Template_tags_gin";

-- DropIndex
DROP INDEX "Template_updatedAt_idx";

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Snippet" RENAME CONSTRAINT "Section_pkey" TO "Snippet_pkey";

-- AlterTable
ALTER TABLE "Template" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "Comment";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "Favorite";

-- DropTable
DROP TABLE "Vote";

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "type" "ArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "copies" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "votesUp" INTEGER NOT NULL DEFAULT 0,
    "votesDown" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactVersion" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_slug_key" ON "Artifact"("slug");

-- CreateIndex
CREATE INDEX "Artifact_userId_idx" ON "Artifact"("userId");

-- CreateIndex
CREATE INDEX "Artifact_visibility_idx" ON "Artifact"("visibility");

-- CreateIndex
CREATE INDEX "Artifact_type_idx" ON "Artifact"("type");

-- CreateIndex
CREATE INDEX "ArtifactVersion_artifactId_idx" ON "ArtifactVersion"("artifactId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- RenameForeignKey
ALTER TABLE "Snippet" RENAME CONSTRAINT "Section_agentId_fkey" TO "Snippet_agentId_fkey";

-- RenameForeignKey
ALTER TABLE "Snippet" RENAME CONSTRAINT "Section_userId_fkey" TO "Snippet_userId_fkey";

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactVersion" ADD CONSTRAINT "ArtifactVersion_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSnippet" ADD CONSTRAINT "DocumentSnippet_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSnippet" ADD CONSTRAINT "DocumentSnippet_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "Snippet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Section_agentId_idx" RENAME TO "Snippet_agentId_idx";

-- RenameIndex
ALTER INDEX "Section_userId_idx" RENAME TO "Snippet_userId_idx";
