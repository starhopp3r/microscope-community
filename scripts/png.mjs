import { inflateSync } from "node:zlib";

export function decodePng(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("not a PNG");
  let at = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  const data = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const kind = buffer.subarray(at + 4, at + 8).toString("latin1");
    const chunk = buffer.subarray(at + 8, at + 8 + length);
    if (kind === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      if (chunk[8] !== 8 || chunk[12] !== 0 || ![2, 6].includes(chunk[9])) throw new Error("only 8-bit, non-interlaced RGB or RGBA PNGs are supported");
      type = chunk[9];
    } else if (kind === "IDAT") data.push(chunk);
    else if (kind === "IEND") break;
    at += 12 + length;
  }
  const bpp = type === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(data));
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pixels[out + x - bpp] : 0;
      const b = y > 0 ? pixels[out - stride + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[out - stride + x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[out + x] = value & 255;
    }
  }
  return { width, height, bpp, pixels };
}

export function changedFraction(first, second, { threshold = 24 } = {}) {
  const a = decodePng(first);
  const b = decodePng(second);
  if (a.width !== b.width || a.height !== b.height) return { fraction: 1, changed: a.width * a.height };
  let changed = 0;
  for (let i = 0, j = 0; i < a.pixels.length; i += a.bpp, j += b.bpp) {
    if (Math.abs(a.pixels[i] - b.pixels[j]) > threshold || Math.abs(a.pixels[i + 1] - b.pixels[j + 1]) > threshold || Math.abs(a.pixels[i + 2] - b.pixels[j + 2]) > threshold) changed++;
  }
  return { fraction: changed / (a.width * a.height), changed };
}
