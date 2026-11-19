import { describe, expect, it } from "vitest";
import { parseValues } from "@/lib/formvalues";

const form = (o: Record<string, string>) => (n: string) => (n in o ? o[n] : null);

describe("parseValues", () => {
  it("parses each field type and skips blanks", () => {
    const ms = [
      { id: "a", fieldType: "number" as const },
      { id: "b", fieldType: "yesno" as const },
      { id: "c", fieldType: "text" as const },
      { id: "d", fieldType: "stars" as const },
      { id: "e", fieldType: "richtext" as const },
    ];
    const v = parseValues(ms, form({ m_a: "12.5", m_b: "no", m_c: "  ", m_d: "4", m_e: "hello" }));
    expect(v).toEqual({ a: 12.5, b: false, d: 4, e: { text: "hello", assetIds: [] } });
  });

  it("collects sets and skips empty rows", () => {
    const v = parseValues(
      [{ id: "s", fieldType: "sets" }],
      form({ m_s_reps_0: "10", m_s_weight_0: "40", m_s_reps_1: "", m_s_weight_1: "", m_s_reps_2: "8", m_s_weight_2: "45" }),
    );
    expect(v).toEqual({ s: [{ reps: 10, weight: 40 }, { reps: 8, weight: 45 }] });
  });

  it("passes unparseable numbers through so validation can complain", () => {
    expect(parseValues([{ id: "a", fieldType: "number" }], form({ m_a: "abc" })).a).toBeNaN();
  });
});
