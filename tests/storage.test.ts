import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, { body: Buffer; opts: unknown }>();
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, body: Buffer, opts: unknown) => void store.set(pathname, { body, opts })),
  get: vi.fn(async (pathname: string) => {
    const hit = store.get(pathname);
    return hit ? { statusCode: 200, stream: new Response(new Uint8Array(hit.body)).body } : null;
  }),
}));

import { BlobStorage } from "@/server/storage";

describe("BlobStorage", () => {
  beforeEach(() => store.clear());

  it("round-trips bytes as a private blob", async () => {
    const s = new BlobStorage();
    await s.put("abc-123", new Uint8Array([1, 2, 3]));
    expect(store.get("photos/abc-123")?.opts).toMatchObject({ access: "private" });
    expect(Array.from(await s.get("abc-123"))).toEqual([1, 2, 3]);
  });

  it("rejects path-like keys and missing photos", async () => {
    const s = new BlobStorage();
    await expect(s.put("../x", new Uint8Array([1]))).rejects.toThrow("bad storage key");
    await expect(s.get("nope")).rejects.toThrow("not found");
  });
});
