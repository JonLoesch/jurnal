"use client";

import { useRef, useState } from "react";

const MAX_EDGE = 1600;
const TOTAL_LIMIT = 4 * 1024 * 1024; // Vercel rejects request bodies over 4.5 MB

/** Shrink a photo in the browser so phone-sized images fit the upload limit and don't eat storage. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // an unreadable image goes up as is and the server explains
  }
}

const trigger = "cursor-pointer rounded border border-neutral-400 px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800";

/**
 * Attach photos: take one with the camera or pick from the library, as many times as you like. Photos pile up
 * in a hidden input that carries them with the form.
 */
export function PhotoInput({ name }: { name: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const kept = useRef<File[]>([]);
  const real = useRef<HTMLInputElement>(null);

  function keep(next: File[]) {
    kept.current = next;
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (real.current) real.current.files = dt.files;
    setFiles(next);
  }

  async function add(el: HTMLInputElement) {
    const added = await Promise.all(Array.from(el.files ?? []).map(shrink));
    el.value = ""; // so the same photo can be chosen again
    const next = [...kept.current, ...added];
    if (next.length > 10 || next.reduce((n, f) => n + f.size, 0) > TOTAL_LIMIT) {
      setNote("That's too much at once: save these first, then add more.");
      return;
    }
    setNote("");
    keep(next);
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className={trigger}>
          Choose photos
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void add(e.currentTarget)} />
        </label>
        <label className={trigger}>
          Take a photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void add(e.currentTarget)} />
        </label>
        {files.length > 0 && (
          <span className="text-xs text-neutral-500">
            {files.length} photo{files.length === 1 ? "" : "s"} attached{" "}
            <button type="button" className="underline" onClick={() => keep([])}>clear</button>
          </span>
        )}
      </div>
      <input ref={real} type="file" name={name} multiple className="hidden" tabIndex={-1} aria-hidden />
      {note && <p className="text-xs text-red-700">{note}</p>}
    </div>
  );
}
