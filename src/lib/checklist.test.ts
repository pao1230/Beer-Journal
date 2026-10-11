import { describe, expect, it } from "vitest";
import {
  applySectionToggle,
  cycle,
  DEFAULT_CHECKLIST,
  exportChecklist,
  moveItem,
  moveSection,
  nextStatus,
  parseChecklist,
  parseQty,
  qtyText,
  sectionToggle,
  summarize,
  type ChecklistItem,
  type ChecklistSection,
} from "./checklist";

const item = (id: number, name: string, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  name,
  note: "",
  quantity: null,
  unit: "",
  status: "TODO",
  missingQty: null,
  ...extra,
});

const list = (): ChecklistSection[] => [
  {
    id: 1,
    title: "Clean",
    description: "",
    collapsed: false,
    items: [
      item(11, "PBW", { status: "OK" }),
      item(12, "Star San", { note: "dilute", quantity: 3, unit: "bottles", status: "MISSING", missingQty: 2 }),
    ],
  },
  { id: 2, title: "Empty", description: "", collapsed: false, items: [] },
  { id: 3, title: "Boil", description: "60 min", collapsed: true, items: [item(31, "Kettle")] },
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

describe("cycle", () => {
  it("starts a missing item as short by the whole amount needed and forgets it after", () => {
    const missing = cycle(item(1, "Keg", { quantity: 2, unit: "kegs", status: "OK" }));
    expect(missing).toMatchObject({ status: "MISSING", missingQty: 2 });
    expect(cycle({ ...missing, missingQty: 1 })).toMatchObject({ status: "SKIP", missingQty: null });
    expect(cycle(item(2, "Paddle", { status: "OK" }))).toMatchObject({ status: "MISSING", missingQty: null });
  });
});

describe("section toggle", () => {
  it("ticks what's left, then clears everything once nothing is left", () => {
    const [clean] = list();
    expect(sectionToggle(clean)).toBe("clear");
    expect(applySectionToggle(clean, "clear").items.map((i) => [i.status, i.missingQty])).toEqual([
      ["TODO", null],
      ["TODO", null],
    ]);
    const boil = list()[2];
    expect(sectionToggle(boil)).toBe("check");
    const mixed = { ...clean, items: [...clean.items, item(13, "Brush")] };
    expect(applySectionToggle(mixed, "check").items.map((i) => i.status)).toEqual(["OK", "MISSING", "OK"]);
  });
});

describe("amounts", () => {
  it("formats with the unit only when there is a number", () => {
    expect(qtyText(2, "bottles")).toBe("2 bottles");
    expect(qtyText(0.5, "")).toBe("0.5");
    expect(qtyText(1 / 3, "kg")).toBe("0.33 kg");
    expect(qtyText(null, "g")).toBe("");
  });
  it("parses typed amounts, accepting a decimal comma", () => {
    expect(parseQty("2")).toBe(2);
    expect(parseQty(" 1,5 ")).toBe(1.5);
    expect(parseQty("")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("-1")).toBeNull();
  });
});

describe("summarize", () => {
  it("counts statuses, progress and what's missing with its step", () => {
    const s = summarize(list());
    expect(s).toMatchObject({ OK: 1, MISSING: 1, SKIP: 0, TODO: 1, total: 3, percent: 67 });
    expect(s.missing).toEqual([{ name: "Star San", short: "2 bottles", step: 1, section: "Clean" }]);
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
        { name: "PBW", note: "", quantity: null, unit: "" },
        { name: "Star San", note: "dilute", quantity: 3, unit: "bottles" },
      ],
    });
    expect(drafts[2].description).toBe("60 min");
  });
  it("reads the stand-alone page's backup (desc, missing notes) and drops blank items", () => {
    const json = JSON.stringify({ version: 2, sections: [{ title: " Mash ", desc: "65°C", items: [{ name: "Paddle" }, { name: "  " }] }] });
    expect(parseChecklist(json)).toEqual([{ title: "Mash", description: "65°C", items: [{ name: "Paddle", note: "", quantity: null, unit: "" }] }]);
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
