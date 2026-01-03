import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/prisma", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prisma")>("@/lib/prisma");
  return { ...actual, hasDatabaseEnv: true };
});
import { getServices, setServices, resetServices, createServices } from "@/services";
import { getPublicSection, listPublicSections } from "@/lib/publicSections";
import { getPublicTemplate } from "@/lib/publicTemplates";

const stubSections = {
  listPublic: vi.fn().mockResolvedValue([{ id: "s1", title: "sec", content: "", tags: [], visibility: "PUBLIC", createdAt: new Date(), updatedAt: new Date() }]),
  findByIdOrSlug: vi.fn().mockResolvedValue({
    id: "s1",
    title: "sec",
    content: "",
    tags: [],
    visibility: "PUBLIC",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

const stubTemplates = {
  listPublic: vi.fn().mockResolvedValue([]),
  findPublicBySlug: vi.fn().mockResolvedValue(null),
  findPublicByIdOrSlug: vi.fn().mockResolvedValue({
    id: "t1",
    slug: "t1",
    title: "template",
    description: "",
    body: "",
    fields: [],
    tags: [],
    views: 0,
    copies: 0,
    uses: 0,
    visibility: "PUBLIC",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

const stubDocuments = {
  listPublic: vi.fn().mockResolvedValue([]),
  findPublicBySlug: vi.fn().mockResolvedValue(null),
};

afterEach(() => {
  resetServices();
  vi.restoreAllMocks();
});

describe("service registry", () => {
  it("creates default services", () => {
    const services = createServices();
    expect(services.sections).toBeDefined();
    expect(services.templates).toBeDefined();
    expect(services.documents).toBeDefined();
  });

  it("routes public section helpers through registry", async () => {
    setServices({ sections: stubSections, templates: stubTemplates, documents: stubDocuments });
    await listPublicSections(10);
    await getPublicSection("s1");
    expect(stubSections.listPublic).toHaveBeenCalled();
    expect(stubSections.findByIdOrSlug).toHaveBeenCalledWith("s1");
  });

  it("routes public template helper through registry", async () => {
    setServices({ sections: stubSections, templates: stubTemplates, documents: stubDocuments });
    const tpl = await getPublicTemplate("t1");
    expect(tpl?.id).toBe("t1");
    expect(stubTemplates.findPublicByIdOrSlug).toHaveBeenCalledWith("t1");
  });

  it("getServices memoizes", () => {
    const first = getServices();
    const second = getServices();
    expect(first).toBe(second);
  });
});
