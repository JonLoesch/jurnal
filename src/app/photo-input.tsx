"use client";

import { useState } from "react";

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

export function PhotoInput({ name }: { name: string }) {
  const [note, setNote] = useState("");
  return (
    <div>
      <input
        type="file"
        name={name}
        accept="image/*"
        multiple
        className="text-xs"
        onChange={async (e) => {
          const input = e.currentTarget;
          const files = await Promise.all(Array.from(input.files ?? []).map(shrink));
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          input.files = dt.files;
          const total = files.reduce((n, f) => n + f.size, 0);
          setNote(total > TOTAL_LIMIT ? "Too many photos at once: add fewer, or add the rest in a second save." : "");
        }}
      />
      {note && <p className="text-xs text-red-700">{note}</p>}
    </div>
  );
}
