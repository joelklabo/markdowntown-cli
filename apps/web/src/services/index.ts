import { createPrismaSectionsRepo, SectionsRepo } from "./sections";
import { createPrismaTemplatesRepo, TemplatesRepo } from "./templates";
import { createPrismaDocumentsRepo, DocumentsRepo } from "./documents";

export type Services = {
  sections: SectionsRepo;
  templates: TemplatesRepo;
  documents: DocumentsRepo;
};

let currentServices: Services | null = null;

export function createServices(): Services {
  return {
    sections: createPrismaSectionsRepo(),
    templates: createPrismaTemplatesRepo(),
    documents: createPrismaDocumentsRepo(),
  };
}

export function getServices(): Services {
  if (!currentServices) {
    currentServices = createServices();
  }
  return currentServices;
}

export function setServices(next: Services) {
  currentServices = next;
}

export function resetServices() {
  currentServices = null;
}

export type { SectionsRepo, TemplatesRepo, DocumentsRepo };
