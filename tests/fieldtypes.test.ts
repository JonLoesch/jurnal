import { describe, expect, it } from "vitest";
import { checkValue, validateConfig } from "@/lib/fieldtypes";

const ok = (r: ReturnType<typeof checkValue>) => (r.ok ? { v: r.value, n: r.num } : r);

describe("checkValue", () => {
  it("accepts and rejects per type", () => {
    expect(ok(checkValue("text", {}, "hi"))).toEqual({ v: "hi", n: null });
    expect(checkValue("text", {}, 5).ok).toBe(false);
    expect(ok(checkValue("number", {}, 12.5))).toEqual({ v: 12.5, n: 12.5 });
    expect(checkValue("number", { min: 0 }, -1).ok).toBe(false);
    expect(checkValue("number", {}, NaN).ok).toBe(false);
    expect(ok(checkValue("stars", {}, 4))).toEqual({ v: 4, n: 4 });
    expect(checkValue("stars", {}, 6).ok).toBe(false);
    expect(checkValue("stars", {}, 2.5).ok).toBe(false);
    expect(ok(checkValue("yesno", {}, true))).toEqual({ v: true, n: 1 });
    expect(ok(checkValue("yesno", {}, false))).toEqual({ v: false, n: 0 });
    expect(checkValue("yesno", {}, "yes").ok).toBe(false);
    expect(ok(checkValue("choice", { choices: ["a", "b"] }, "b"))).toEqual({ v: "b", n: null });
    expect(checkValue("choice", { choices: ["a", "b"] }, "c").ok).toBe(false);
    expect(ok(checkValue("timeofday", {}, "07:30"))).toEqual({ v: "07:30", n: 450 });
    expect(checkValue("timeofday", {}, "7:30").ok).toBe(false);
    expect(ok(checkValue("duration", {}, 45))).toEqual({ v: 45, n: 45 });
    expect(checkValue("duration", {}, -1).ok).toBe(false);
  });

  it("stores rich text with its photo ids", () => {
    const id = "6f1c1f4e-8f5e-4d0a-9a53-0d6a7f4c2b11";
    expect(ok(checkValue("richtext", {}, { text: "hello", assetIds: [id] }))).toEqual({
      v: { text: "hello", assetIds: [id] },
      n: null,
    });
    expect(checkValue("richtext", {}, { text: "x", assetIds: ["nope"] }).ok).toBe(false);
  });

  it("uses the top weight of a set list as the numeric copy", () => {
    const sets = [
      { reps: 10, weight: 40 },
      { reps: 8, weight: 45 },
    ];
    expect(ok(checkValue("sets", {}, sets))).toEqual({ v: sets, n: 45 });
    expect(ok(checkValue("sets", {}, []))).toEqual({ v: [], n: null });
    expect(checkValue("sets", {}, [{ reps: -1, weight: 5 }]).ok).toBe(false);
  });
});

describe("validateConfig", () => {
  it("requires at least two choices", () => {
    expect(validateConfig("choice", { choices: ["a"] })).not.toBeNull();
    expect(validateConfig("choice", { choices: ["a", "b"] })).toBeNull();
    expect(validateConfig("sets", { targetSets: 0 })).not.toBeNull();
    expect(validateConfig("sets", { targetSets: 3, targetReps: 10 })).toBeNull();
  });
});
