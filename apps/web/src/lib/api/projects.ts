import { prisma } from "@/lib/prisma";

export async function getUserProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { snapshots: true } } },
  });
}

export async function getProject(userId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { files: true } } },
      },
    },
  });
}
