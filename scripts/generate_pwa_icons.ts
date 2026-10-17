import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// Minimal deterministic PNG encoder (RGBA) so we don't need native canvas bindings
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPng(size: number, maskable: boolean): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows: Buffer[] = [];
  const cx = size / 2;
  const cy = size / 2;
  const safeRadius = maskable ? size * 0.36 : size * 0.44;

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Dark obsidian background (#0B0E14)
      let r = 11;
      let g = 14;
      let b = 20;
      const a = 255;

      // Outer brass ring
      if (Math.abs(dist - safeRadius) < size * 0.03) {
        r = 217;
        g = 119;
        b = 6;
      } else if (dist < safeRadius) {
        // Inner dark slate medallion (#131822)
        r = 19;
        g = 24;
        b = 34;

        // Balance beam horizontal & vertical cross
        if (Math.abs(dy + safeRadius * 0.25) < size * 0.025 && Math.abs(dx) < safeRadius * 0.65) {
          r = 245;
          g = 158;
          b = 11;
        } else if (Math.abs(dx) < size * 0.025 && dy > -safeRadius * 0.45 && dy < safeRadius * 0.55) {
          r = 217;
          g = 119;
          b = 6;
        } else if (dx < -safeRadius * 0.2 && dx > -safeRadius * 0.65 && dy > 0 && dy < safeRadius * 0.45) {
          // Left emerald flask (#10B981)
          r = 16;
          g = 185;
          b = 129;
        } else if (dx > safeRadius * 0.2 && dx < safeRadius * 0.65 && dy > 0 && dy < safeRadius * 0.45) {
          // Right crimson trap (#F43F5E)
          r = 244;
          g = 63;
          b = 94;
        }
      }

      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    rawRows.push(row);
  }

  const idatData = zlib.deflateSync(Buffer.concat(rawRows));
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const publicDir = path.join(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="24" fill="#0B0E14"/>
  <circle cx="64" cy="64" r="52" fill="#131822" stroke="#D97706" stroke-width="4"/>
  <path d="M64 26V98M42 98H86" stroke="#D97706" stroke-width="4" stroke-linecap="round"/>
  <path d="M26 44L64 36L102 44" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
  <circle cx="64" cy="36" r="5" fill="#FDE68A"/>
  <rect x="20" y="56" width="22" height="22" rx="5" fill="#10B981"/>
  <rect x="86" y="56" width="22" height="22" rx="5" fill="#F43F5E"/>
</svg>\n`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createIconPng(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createIconPng(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createIconPng(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createIconPng(180, false));

console.log('[PWA Icons] Generated icon.svg, pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png, apple-touch-icon.png');
