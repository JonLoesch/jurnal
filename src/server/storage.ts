import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

/** Where uploaded photos live: Vercel Blob when its token is set, local disk otherwise (dev and tests). */
export interface Storage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}

export class FsStorage implements Storage {
  constructor(private dir: string) {}
  private file(key: string) {
    if (!/^[\w-]+$/.test(key)) throw new Error("bad storage key");
    return path.join(this.dir, key);
  }
  async put(key: string, bytes: Uint8Array) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(key), bytes);
  }
  async get(key: string) {
    return readFile(this.file(key));
  }
}

/** Private blobs: no public URL exists, and every read goes through the access-checked asset route. */
export class BlobStorage implements Storage {
  private pathname(key: string) {
    if (!/^[\w-]+$/.test(key)) throw new Error("bad storage key");
    return `photos/${key}`;
  }
  async put(key: string, bytes: Uint8Array) {
    await put(this.pathname(key), Buffer.from(bytes), { access: "private", addRandomSuffix: false, allowOverwrite: true });
  }
  async get(key: string) {
    const res = await get(this.pathname(key), { access: "private" });
    if (!res || res.statusCode !== 200) throw new Error("photo not found in storage");
    return new Uint8Array(await new Response(res.stream).arrayBuffer());
  }
}

export const storage: Storage = process.env.BLOB_READ_WRITE_TOKEN
  ? new BlobStorage()
  : new FsStorage(process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads"));

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
