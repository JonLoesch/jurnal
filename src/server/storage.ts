import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Where uploaded photos live. Local disk for now; an object store (e.g. R2) can implement the same interface. */
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

export const storage: Storage = new FsStorage(process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads"));

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
