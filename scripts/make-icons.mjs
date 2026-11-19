// Writes simple placeholder PNG icons (a blue square with a white "J") without any image library.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function icon(size) {
  const bg = [37, 99, 235], fg = [255, 255, 255];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const stemX0 = Math.round(size * 0.5), stemX1 = Math.round(size * 0.64);
  const top = Math.round(size * 0.22), bottom = Math.round(size * 0.74);
  const hookY0 = Math.round(size * 0.62), hookX0 = Math.round(size * 0.3);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const inStem = x >= stemX0 && x < stemX1 && y >= top && y < bottom;
      const inHook = y >= hookY0 && y < bottom && x >= hookX0 && x < stemX1 && y >= bottom - Math.round(size * 0.12);
      const px = inStem || inHook ? fg : bg;
      raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
for (const s of [192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), icon(s));
