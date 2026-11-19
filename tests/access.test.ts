import { describe, expect, it } from "vitest";
import { computeAccess, viewEntries, type AccessInput, type GrantFact } from "@/lib/access";

const J = { id: "j1", ownerAccountId: "owner", defaultPrecision: "day" as const };
const sections = [
  { id: "s-open", protected: false },
  { id: "s-prot", protected: true },
];
const metrics = [
  { id: "m-open", sectionId: "s-open", protected: false },
  { id: "m-prot", sectionId: "s-open", protected: true },
  { id: "m-in-prot", sectionId: "s-prot", protected: false },
  { id: "m-prot-in-prot", sectionId: "s-prot", protected: true },
];
const grant = (scope: GrantFact["scope"], scopeId: string, extra: Partial<GrantFact> = {}): GrantFact => ({
  scope,
  scopeId,
  commentPerm: "none",
  canAlert: false,
  precision: null,
  ...extra,
});
const base = (over: Partial<AccessInput>): AccessInput => ({
  jurnal: J,
  sections,
  metrics,
  viewer: { accountId: "viewer", presentedLinkValid: false },
  grants: [],
  ...over,
});
const sees = (a: ReturnType<typeof computeAccess>) => [...a.metricIds].sort();

describe("computeAccess", () => {
  it("lets the owner see everything at full precision", () => {
    const a = computeAccess(base({ viewer: { accountId: "owner", presentedLinkValid: false } }));
    expect(a.role).toBe("owner");
    expect(a.precision).toBe("time");
    expect(sees(a)).toEqual(["m-in-prot", "m-open", "m-prot", "m-prot-in-prot"]);
    expect(a.hasHidden).toBe(false);
  });

  it("gives strangers nothing", () => {
    expect(computeAccess(base({})).role).toBe("none");
    expect(computeAccess(base({ viewer: { accountId: null, presentedLinkValid: false } })).role).toBe("none");
  });

  it("shows only unprotected items to a plain jurnal grantee", () => {
    const a = computeAccess(base({ grants: [grant("jurnal", "j1")] }));
    expect(a.role).toBe("grantee");
    expect(sees(a)).toEqual(["m-open"]);
    expect(a.hasHidden).toBe(true);
  });

  it("needs a section grant for a protected section", () => {
    const a = computeAccess(base({ grants: [grant("jurnal", "j1"), grant("section", "s-prot")] }));
    expect(sees(a)).toEqual(["m-in-prot", "m-open"]); // protected metric inside still hidden
  });

  it("needs a metric grant for a protected metric, and the section above it", () => {
    const onlyMetric = computeAccess(base({ grants: [grant("jurnal", "j1"), grant("metric", "m-prot")] }));
    expect(sees(onlyMetric)).toEqual(["m-open", "m-prot"]);
    // A metric grant inside a protected section does nothing without the section grant.
    const noSection = computeAccess(base({ grants: [grant("jurnal", "j1"), grant("metric", "m-prot-in-prot")] }));
    expect(sees(noSection)).toEqual(["m-open"]);
    const both = computeAccess(
      base({ grants: [grant("jurnal", "j1"), grant("section", "s-prot"), grant("metric", "m-prot-in-prot")] }),
    );
    expect(sees(both)).toEqual(["m-in-prot", "m-open", "m-prot-in-prot"]);
  });

  it("gives nothing for section or metric grants without a jurnal grant", () => {
    const a = computeAccess(base({ grants: [grant("section", "s-prot"), grant("metric", "m-prot")] }));
    expect(a.role).toBe("none");
    expect(sees(a)).toEqual([]);
  });

  it("gives link visitors the unprotected items, read only at day precision", () => {
    const a = computeAccess(
      base({ viewer: { accountId: null, presentedLinkValid: true }, jurnal: { ...J, defaultPrecision: "time" } }),
    );
    expect(a.role).toBe("link");
    expect(sees(a)).toEqual(["m-open"]);
    expect(a.commentPerm).toBe("none");
    expect(a.canAlert).toBe(false);
  });

  it("does not let a link raise a signed-in grantee's section grants", () => {
    const a = computeAccess(
      base({ viewer: { accountId: "viewer", presentedLinkValid: true }, grants: [grant("section", "s-prot")] }),
    );
    expect(a.role).toBe("link");
    expect(sees(a)).toEqual(["m-open"]);
  });

  it("applies the grant's precision, falling back to the jurnal default", () => {
    expect(computeAccess(base({ grants: [grant("jurnal", "j1")] })).precision).toBe("day");
    expect(computeAccess(base({ grants: [grant("jurnal", "j1", { precision: "time" })] })).precision).toBe("time");
    const fine = { ...J, defaultPrecision: "time" as const };
    expect(computeAccess(base({ jurnal: fine, grants: [grant("jurnal", "j1")] })).precision).toBe("time");
    expect(computeAccess(base({ jurnal: fine, grants: [grant("jurnal", "j1", { precision: "day" })] })).precision).toBe("day");
  });

  it("carries comment and alert permissions from the jurnal grant only", () => {
    const a = computeAccess(
      base({ grants: [grant("jurnal", "j1", { commentPerm: "write", canAlert: true }), grant("section", "s-prot", { canAlert: false })] }),
    );
    expect(a.commentPerm).toBe("write");
    expect(a.canAlert).toBe(true);
  });
});

describe("viewEntries", () => {
  const e = {
    id: "e1",
    sectionId: "s-open",
    authorId: "owner",
    effectiveDate: "2026-11-04",
    effectiveTime: "08:15",
    addedAt: new Date("2026-11-04T13:16:00Z"),
    updatedAt: new Date("2026-11-04T13:17:00Z"),
  };
  const hidden = { ...e, id: "e2", sectionId: "s-prot" };

  it("hides entries from sections the viewer can't see", () => {
    const a = computeAccess(base({ grants: [grant("jurnal", "j1")] }));
    expect(viewEntries(a, [e, hidden]).map((x) => x.id)).toEqual(["e1"]);
  });

  it("strips every time detail at day precision", () => {
    const a = computeAccess(base({ grants: [grant("jurnal", "j1")] }));
    const [v] = viewEntries(a, [e]);
    expect(v).toEqual({ id: "e1", sectionId: "s-open", authorId: "owner", effectiveDate: "2026-11-04" });
    expect(JSON.stringify(v)).not.toContain("08:15");
    expect(JSON.stringify(v)).not.toContain("13:16");
  });

  it("keeps times at time precision", () => {
    const a = computeAccess(base({ grants: [grant("jurnal", "j1", { precision: "time" })] }));
    expect(viewEntries(a, [e])[0]).toMatchObject({ effectiveTime: "08:15" });
  });
});
