import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHECKLIST,
  exportChecklist,
  moveItem,
  moveSection,
  nextStatus,
  parseChecklist,
  summarize,
  type ChecklistSection,
} from "./checklist";

const list = (): ChecklistSection[] => [
  {
    id: 1,
    title: "Clean",
    description: "",
    items: [
      { id: 11, name: "PBW", note: "", status: "OK" },
      { id: 12, name: "Star San", note: "dilute", status: "MISSING" },
    ],
  },
  { id: 2, title: "Empty", description: "", items: [] },
  { id: 3, title: "Boil", description: "60 min", items: [{ id: 31, name: "Kettle", note: "", status: "TODO" }] },
];

const ids = (sections: ChecklistSection[] | null) => sections?.map((s) => [s.id, s.items.map((i) => i.id)]);

describe("nextStatus", () => {
  it("cycles not checked → have it → missing → not used → not checked", () => {
    expect(nextStatus("TODO")).toBe("OK");
    expect(nextStatus("OK")).toBe("MISSING");
    expect(nextStatus("MISSING")).toBe("SKIP");
    expect(nextStatus("SKIP")).toBe("TODO");
  });
});

describe("summarize", () => {
  it("counts statuses, progress and what's missing with its step", () => {
    const s = summarize(list());
    expect(s).toMatchObject({ OK: 1, MISSING: 1, SKIP: 0, TODO: 1, total: 3, percent: 67 });
    expect(s.missing).toEqual([{ name: "Star San", step: 1, section: "Clean" }]);
  });
  it("is zero percent with no items", () => {
    expect(summarize([]).percent).toBe(0);
  });
});

describe("moveSection", () => {
  it("swaps with the neighbour and stops at the ends", () => {
    expect(ids(moveSection(list(), 0, 1))).toEqual([[2, []], [1, [11, 12]], [3, [31]]]);
    expect(moveSection(list(), 0, -1)).toBeNull();
    expect(moveSection(list(), 2, 1)).toBeNull();
  });
});

describe("moveItem", () => {
  it("swaps within a section", () => {
    expect(ids(moveItem(list(), 0, 0, 1))).toEqual([[1, [12, 11]], [2, []], [3, [31]]]);
  });
  it("crosses into the neighbouring section, including an empty one", () => {
    expect(ids(moveItem(list(), 0, 1, 1))).toEqual([[1, [11]], [2, [12]], [3, [31]]]);
    expect(ids(moveItem(list(), 2, 0, -1))).toEqual([[1, [11, 12]], [2, [31]], [3, []]]);
  });
  it("stops at the very first and last place", () => {
    expect(moveItem(list(), 0, 0, -1)).toBeNull();
    expect(moveItem(list(), 2, 0, 1)).toBeNull();
  });
  it("leaves the original untouched", () => {
    const before = list();
    moveItem(before, 0, 1, 1);
    expect(ids(before)).toEqual(ids(list()));
  });
});

describe("parseChecklist", () => {
  it("round-trips an export", () => {
    const drafts = parseChecklist(exportChecklist(list()));
    expect(drafts[0]).toEqual({
      title: "Clean",
      description: "",
      items: [
        { name: "PBW", note: "" },
        { name: "Star San", note: "dilute" },
      ],
    });
    expect(drafts[2].description).toBe("60 min");
  });
  it("reads the stand-alone page's backup (desc, missing notes) and drops blank items", () => {
    const json = JSON.stringify({ version: 2, sections: [{ title: " Mash ", desc: "65°C", items: [{ name: "Paddle" }, { name: "  " }] }] });
    expect(parseChecklist(json)).toEqual([{ title: "Mash", description: "65°C", items: [{ name: "Paddle", note: "" }] }]);
  });
  it("rejects text that isn't JSON or lacks sections", () => {
    expect(() => parseChecklist("nope")).toThrow("valid JSON");
    expect(() => parseChecklist('{"sections":[{"title":"x"}]}')).toThrow("Expected sections");
  });
});

it("ships a starter list with named items in every section", () => {
  expect(DEFAULT_CHECKLIST.length).toBe(10);
  for (const s of DEFAULT_CHECKLIST) {
    expect(s.title).not.toBe("");
    expect(s.items.length).toBeGreaterThan(0);
  }
});
