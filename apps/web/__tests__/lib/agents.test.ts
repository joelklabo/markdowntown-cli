import { sampleAgent } from "@/lib/agents";

describe("sampleAgent", () => {
  it("returns numbered titles", async () => {
    const output = await sampleAgent.run({
      userId: "u1",
      sections: [
        { id: "1", title: "One", content: "" },
        { id: "2", title: "Two", content: "" },
      ],
    });
    expect(output).toBe("1. One\n2. Two");
  });
});
