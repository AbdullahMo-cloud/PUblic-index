const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a 256x256 RGBA PNG buffer in pure Node.js with zlib
function createPng(width, height, pixelFn) {
  // CRC32 table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image scanlines
  const rawBytes = Buffer.alloc(height * (1 + width * 4));
  let ptr = 0;
  for (let y = 0; y < height; y++) {
    rawBytes[ptr++] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawBytes[ptr++] = r;
      rawBytes[ptr++] = g;
      rawBytes[ptr++] = b;
      rawBytes[ptr++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawBytes, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk]);
}

// Draw Etisalat emblem icon (vibrant red curves / sphere)
function renderEtisalatIcon(width, height) {
  return createPng(width, height, (x, y, w, h) => {
    // Normalized coordinates from -1 to 1
    const cx = (x - w / 2) / (w / 2);
    const cy = (y - h / 2) / (h / 2);
    const r = Math.sqrt(cx * cx + cy * cy);

    // Rounded app icon squircle background
    const cornerRadius = 0.85;
    const absX = Math.abs(cx);
    const absY = Math.abs(cy);
    // Superellipse: |x|^4 + |y|^4 <= 1
    const squircleDist = Math.pow(absX, 4.5) + Math.pow(absY, 4.5);
    
    // Background: clean crisp white with subtle edge border
    if (squircleDist > 0.95) {
      // Outside icon boundary: transparent
      return [0, 0, 0, 0];
    }

    // Inside icon
    let bgR = 255;
    let bgG = 255;
    let bgB = 255;
    let bgA = 255;

    // Etisalat Red: #E30613 -> (227, 6, 19)
    const redR = 227;
    const redG = 6;
    const redB = 19;

    // Etisalat Dark Crimson for 3D depth/shading
    const darkR = 175;
    const darkG = 4;
    const darkB = 14;

    // Upper swirl band of Etisalat emblem
    // Center of emblem shifted slightly to match branding
    const ex = cx * 1.35;
    const ey = cy * 1.35 + 0.05;

    // Distance to sphere
    const sphereDist = Math.sqrt(ex * ex + ey * ey);
    
    // Check if inside the two trademark Etisalat spiral ribbon curves
    // Curve 1: Upper sweeping ribbon
    const angle = Math.atan2(ey, ex);
    const spiral1 = 0.55 + 0.22 * Math.sin(angle * 1.5 - 0.4);
    const ribbon1Dist = Math.abs(sphereDist - spiral1);

    // Curve 2: Lower swoosh
    const spiral2 = 0.65 + 0.18 * Math.cos(angle * 1.2 + 0.6);
    const ribbon2Dist = Math.abs(sphereDist - spiral2);

    let isEmblem = false;
    let shade = 1.0;

    if (ribbon1Dist < 0.28 && sphereDist < 0.82 && (ey < 0.25 || ex > -0.2)) {
      isEmblem = true;
      shade = 0.85 + 0.3 * (ex * 0.5 - ey * 0.5);
    } else if (ribbon2Dist < 0.22 && sphereDist < 0.85 && ey > -0.35) {
      isEmblem = true;
      shade = 0.75 + 0.4 * (ex * 0.5 + ey * 0.5);
    } else if (sphereDist < 0.48 && sphereDist > 0.22 && ex > -0.3 && ex < 0.4 && ey > -0.25 && ey < 0.3) {
      isEmblem = true;
      shade = 0.9;
    }

    if (isEmblem) {
      shade = Math.max(0, Math.min(1.2, shade));
      const finalR = Math.min(255, Math.floor(redR * shade));
      const finalG = Math.min(255, Math.floor(redG * shade));
      const finalB = Math.min(255, Math.floor(redB * shade));
      return [finalR, finalG, finalB, 255];
    }

    // Soft antialiased border of squircle
    if (squircleDist > 0.88) {
      const edgeAlpha = Math.floor(255 * (1 - (squircleDist - 0.88) / 0.07));
      return [230, 230, 230, Math.max(0, Math.min(255, edgeAlpha))];
    }

    return [bgR, bgG, bgB, bgA];
  });
}

// Create Windows .ICO file wrapping a PNG
function createIcoFromPng(pngBuffer) {
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // type: icon
  icoHeader.writeUInt16LE(1, 4); // count: 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(0, 0); // width 256 (0 = 256)
  dirEntry.writeUInt8(0, 1); // height 256 (0 = 256)
  dirEntry.writeUInt8(0, 2); // color count
  dirEntry.writeUInt8(0, 3); // reserved
  dirEntry.writeUInt16LE(1, 4); // color planes
  dirEntry.writeUInt16LE(32, 6); // bits per pixel
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // size of image in bytes
  dirEntry.writeUInt32LE(22, 12); // offset where PNG starts (6 + 16 = 22)

  return Buffer.concat([icoHeader, dirEntry, pngBuffer]);
}

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

console.log('Generating Etisalat 256x256 app icon PNG...');
const pngBuf = renderEtisalatIcon(256, 256);
fs.writeFileSync(path.join(PUBLIC_DIR, 'etisalat-icon.png'), pngBuf);
fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), pngBuf);

console.log('Generating Windows .ICO with Etisalat emblem...');
const icoBuf = createIcoFromPng(pngBuf);
fs.writeFileSync(path.join(PUBLIC_DIR, 'etisalat.ico'), icoBuf);
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuf);

console.log('Icons created in /public:');
console.log(' - public/etisalat-icon.png');
console.log(' - public/etisalat.ico');
console.log(' - public/favicon.ico');
