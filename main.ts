// big-pickle final news image revision.
const fs = require('node:fs');
const zlib = require('node:zlib');

const W = 1024;
const H = 1024;
const pixels = Buffer.alloc(W * H * 3);

const FONT = {
  'A': '.###./#...#/#...#/#####/#...#/#...#/#...#',
  'B': '####./#...#/#...#/####./#...#/#...#/####.',
  'C': '.####/#..../#..../#..../#..../#..../.####',
  'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
  'E': '#####/#..../#..../####./#..../#..../#####',
  'F': '#####/#..../#..../####./#..../#..../#....',
  'G': '.####/#..../#..../#.###/#...#/#...#/.###.',
  'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  'I': '#####/..#../..#../..#../..#../..#../#####',
  'J': '..###/....#/....#/....#/#...#/#...#/.###.',
  'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  'L': '#..../#..../#..../#..../#..../#..../#####',
  'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  'N': '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  'P': '####./#...#/#...#/####./#..../#..../#....',
  'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  'R': '####./#...#/#...#/####./#.#../#..#./#...#',
  'S': '.####/#..../#..../.###./....#/....#/####.',
  'T': '#####/..#../..#../..#../..#../..#../..#..',
  'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  'V': '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  'W': '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..',
  'Z': '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '...../...../...../...../...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ':': '...../.##../.##../...../.##../.##../.....',
  '-': '...../...../...../#####/...../...../.....',
  ',': '...../...../...../...../.##../.##../.#...',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '?': '.###./#...#/....#/...#./..#../...../..#..'
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i] = c[0];
  pixels[i + 1] = c[1];
  pixels[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
      setPixel(xx, yy, c);
    }
  }
}

function drawLine(x0, y0, x1, y1, c) {
  let a = Math.round(x0);
  let b = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - a);
  const dy = Math.abs(ey - b);
  const sx = a < ex ? 1 : -1;
  const sy = b < ey ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    setPixel(a, b, c);
    if (a === ex && b === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; a += sx; }
    if (e2 < dx) { err += dx; b += sy; }
  }
}

function drawCircle(cx, cy, r, c) {
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    setPixel(cx + x, cy + y, c); setPixel(cx + y, cy + x, c);
    setPixel(cx - y, cy + x, c); setPixel(cx - x, cy + y, c);
    setPixel(cx - x, cy - y, c); setPixel(cx - y, cy - x, c);
    setPixel(cx + y, cy - x, c); setPixel(cx + x, cy - y, c);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

function fillCircle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPixel(cx + x, cy + y, c);
    }
  }
}

function fillEllipse(cx, cy, rx, ry, c) {
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) {
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) setPixel(cx + x, cy + y, c);
    }
  }
}

function arcEllipse(cx, cy, rx, ry, c) {
  for (let t = 0; t < Math.PI * 2; t += 0.01) {
    setPixel(Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)), c);
  }
}

function drawText(x, y, text, c, scale, bold) {
  let cx = x;
  for (const raw of text.toUpperCase()) {
    const g = (FONT[raw] || FONT['?']).split('/');
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
          if (bold) fillRect(cx + col * scale + 1, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
  return cx;
}

function textWidth(text, scale) {
  return text.length * 6 * scale;
}

function drawCenteredText(y, text, c, scale, bold) {
  drawText(Math.round((W - textWidth(text, scale)) / 2), y, text, c, scale, bold);
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    if (cur === '') cur = word;
    else if ((cur + ' ' + word).length <= maxChars) cur += ' ' + word;
    else { lines.push(cur); cur = word; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

const NAVY = [9, 16, 34];
const HEADER = [15, 29, 58];
const CARD = [20, 38, 72];
const BORDER = [46, 82, 138];
const TEXT = [232, 240, 252];
const MUTED = [146, 168, 204];
const GOLD = [242, 190, 92];
const TEAL = [92, 204, 192];
const CORAL = [232, 124, 104];
const BLUE = [120, 166, 242];
const OCEAN = [22, 48, 84];
const LAND = [42, 104, 102];
const GRIDLINE = [52, 94, 148];

fillRect(0, 0, W, H, NAVY);
fillRect(0, 0, W, 162, HEADER);
fillRect(0, 1022, W, 2, GOLD);
drawLine(16, 16, W - 16, 16, BORDER);
drawLine(16, H - 16, W - 16, H - 16, BORDER);
drawLine(16, 16, 16, H - 16, BORDER);
drawLine(W - 16, 16, W - 16, H - 16, BORDER);

const gcx = 92;
const gcy = 82;
const gr = 52;
fillCircle(gcx, gcy, gr, OCEAN);
arcEllipse(gcx, gcy, gr, gr, GRIDLINE);
arcEllipse(gcx, gcy, gr - 1, gr - 1, GRIDLINE);
for (const f of [-0.55, -0.28, 0, 0.28, 0.55]) {
  const yy = gcy + f * gr;
  const hw = Math.sqrt(gr * gr - (f * gr) * (f * gr));
  drawLine(gcx - hw, yy, gcx + hw, yy, GRIDLINE);
}
arcEllipse(gcx, gcy, gr * 0.38, gr, GRIDLINE);
arcEllipse(gcx, gcy, gr * 0.72, gr, GRIDLINE);
fillEllipse(gcx - 18, gcy - 12, 12, 8, LAND);
fillEllipse(gcx + 14, gcy + 6, 10, 14, LAND);
fillEllipse(gcx - 6, gcy + 20, 7, 5, LAND);

drawText(168, 38, 'THE WORLD ON 18 NOVEMBER 2026', TEXT, 3, true);
fillRect(168, 66, textWidth('THE WORLD ON 18 NOVEMBER 2026', 3), 3, GOLD);
drawText(168, 88, '18 NOV 2026', GOLD, 2, true);
drawText(W - 16 - textWidth('DAILY BRIEF', 1), 40, 'DAILY BRIEF', MUTED, 1, false);
drawText(W - 16 - textWidth('ISSUE 11', 1), 88, 'ISSUE 11', MUTED, 1, false);

const labels = [
  'DIPLOMATIC TALKS CONTINUE ON TRADE ROUTES',
  'COASTAL REGIONS PREPARE FOR STORMS',
  'SPACE AGENCIES PUBLISH TELESCOPE FINDINGS',
  'SCHOOLS EXPAND CODING CURRICULA',
  'CENTRAL BANKS PUBLISH OUTLOOKS',
  'FILM FESTIVALS OPEN',
  'MARATHON RECORDS FALL',
  'RENEWABLE GRID PROJECTS BREAK GROUND'
];
const accents = [GOLD, TEAL, BLUE, CORAL, GOLD, TEAL, BLUE, CORAL];
const cardW = 452;
const cardH = 178;
const startX = 40;
const startY = 178;
for (let i = 0; i < 8; i++) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = startX + col * (cardW + 40);
  const y = startY + row * (cardH + 16);
  fillRect(x, y, cardW, cardH, CARD);
  drawLine(x, y, x + cardW - 1, y, BORDER);
  drawLine(x, y + cardH - 1, x + cardW - 1, y + cardH - 1, BORDER);
  drawLine(x, y, x, y + cardH - 1, BORDER);
  drawLine(x + cardW - 1, y, x + cardW - 1, y + cardH - 1, BORDER);
  const acc = accents[i];
  fillRect(x, y, 7, cardH, acc);
  const num = (i + 1).toString().padStart(2, '0');
  drawText(x + 24, y + 20, num, acc, 2, true);
  drawLine(x + 24, y + 44, x + 72, y + 44, BORDER);
  const lines = wrapText(labels[i], 32);
  let ty = y + 58;
  for (const line of lines) {
    drawText(x + 24, ty, line, TEXT, 2, false);
    ty += 20;
  }
  fillRect(x + cardW - 26, y + cardH - 22, 10, 10, acc);
}

fillRect(0, 950, W, 74, [13, 24, 48]);
drawLine(0, 950, W, 950, BORDER);
drawCenteredText(972, 'WORLD NEWS DIGEST', MUTED, 2, true);
drawLine(320, 996, 704, 996, BORDER);

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const rowStart = y * (1 + W * 3);
  raw[rowStart] = 0;
  pixels.copy(raw, rowStart + 1, y * W * 3, (y + 1) * W * 3);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const idat = zlib.deflateSync(raw);
const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outDir, { recursive: true });
const sep = outDir.includes('\\') ? '\\' : '/';
const cleanDir = outDir.replace(/[\\/]+$/, '');
const outPath = cleanDir + sep + 'entry.png';
fs.writeFileSync(outPath, png);
console.log(outPath);
