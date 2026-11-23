// news-image-20261123 — "THE WORLD IN ONE DAY — MONDAY 23 NOVEMBER 2026"
// A hand-rolled newspaper front page drawn pixel by pixel with no dependencies:
// a tiny RGB canvas, a 5x7 bitmap font, simple shapes, and a deterministic
// PNG encoder (zlib from the Node standard library). No network, no random
// data, no timestamps: two runs write byte-identical files.
//
// Run: MAKEFUN_OUTPUT_DIR=<dir> node main.ts   (writes <dir>/entry.png)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 227];
const INK = [22, 22, 22];
const RED = [176, 30, 36];
const NAVY = [29, 53, 87];
const TEAL = [39, 75, 99];
const BLUE = [47, 111, 178];
const GREEN = [74, 140, 90];
const GREY = [120, 118, 110];
const LIGHTGREY = [214, 209, 194];
const ORANGE = [224, 122, 42];
const GOLD = [214, 164, 52];
const WHITE = [250, 250, 246];

// ---------------------------------------------------------------- canvas
class Canvas {
  buf: Buffer;
  constructor() {
    this.buf = Buffer.alloc(W * H * 3);
  }
  px(x: number, y: number, c: number[]): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: number[]): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
    }
  }
  hline(x: number, y: number, w: number, c: number[]): void {
    this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: number[]): void {
    this.rect(x, y, 1, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: number[]): void {
    for (let d = -Math.floor(t / 2); d <= Math.floor(t / 2); d++) {
      this.line(x0 + d, y0, x1 + d, y1, c);
      this.line(x0, y0 + d, x1, y1 + d, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: number[]): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.px(cx + x, cy + y, c);
    }
  }
  ring(cx: number, cy: number, r: number, t: number, c: number[]): void {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      for (let d = 0; d < t; d++) {
        this.px(Math.round(cx + (r - d) * Math.cos(rad)), Math.round(cy + (r - d) * Math.sin(rad)), c);
      }
    }
  }
  // filled triangle by scanline interpolation
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.floor(Math.min(...xs));
        const hi = Math.ceil(Math.max(...xs));
        for (let x = lo; x <= hi; x++) this.px(x, y, c);
      }
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Uppercase only; every glyph is 7 rows of 5 bits ("1" = ink).
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
};

const CHAR_W = 6; // 5 px glyph + 1 px gap, in font units
const CHAR_H = 7;

function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}

function drawText(cv: Canvas, x: number, y: number, s: string, scale: number, color: number[]): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch];
    if (g) {
      for (let r = 0; r < CHAR_H; r++) {
        for (let c = 0; c < 5; c++) {
          if (g[r][c] === "1") cv.rect(cx + c * scale, y + r * scale, scale, scale, color);
        }
      }
    }
    cx += CHAR_W * scale;
  }
}

function drawTextCentered(cv: Canvas, cx: number, y: number, s: string, scale: number, color: number[]): void {
  drawText(cv, cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, color);
}

// Greedy word wrap; returns lines that fit maxWidth px at the given scale.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw a wrapped paragraph; returns the y just below the last line.
function paragraph(cv: Canvas, x: number, y: number, s: string, scale: number, maxWidth: number, color: number[], leading?: number): number {
  const lh = leading ?? CHAR_H * scale + Math.floor(scale * 1.6);
  const lines = wrap(s, maxWidth, scale);
  let yy = y;
  for (const ln of lines) {
    drawText(cv, x, yy, ln, scale, color);
    yy += lh;
  }
  return yy;
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    cv.buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- scenes
// Lead art: a cracked globe under a grey sky, smoke rising, "NO DEAL" banner.
function drawLeadArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, TEAL);
  // pale sun
  cv.circle(x + 52, y + 46, 26, GOLD);
  cv.circle(x + 52, y + 46, 18, [232, 190, 90]);
  // distant summit rooftops
  cv.rect(x, y + h - 58, w, 58, [32, 58, 74]);
  cv.tri(x + 20, y + h - 58, x + 70, y + h - 96, x + 120, y + h - 58, [32, 58, 74]);
  cv.tri(x + 150, y + h - 58, x + 210, y + h - 104, x + 270, y + h - 58, [32, 58, 74]);
  cv.tri(x + 280, y + h - 58, x + 320, y + h - 88, x + 356, y + h - 58, [32, 58, 74]);
  // globe
  const gx = x + Math.floor(w / 2) + 8;
  const gy = y + 128;
  const gr = 88;
  cv.circle(gx, gy, gr, BLUE);
  cv.circle(gx - 30, gy - 34, 26, GREEN);
  cv.circle(gx + 34, gy + 8, 30, GREEN);
  cv.circle(gx - 8, gy + 44, 20, GREEN);
  cv.circle(gx + 52, gy - 44, 16, GREEN);
  cv.ring(gx, gy, gr, 3, [20, 40, 66]);
  // crack across the globe
  cv.thickLine(gx - 70, gy - 60, gx - 18, gy - 8, 4, [16, 16, 16]);
  cv.thickLine(gx - 18, gy - 8, gx + 8, gy + 26, 4, [16, 16, 16]);
  cv.thickLine(gx + 8, gy + 26, gx + 66, gy + 62, 4, [16, 16, 16]);
  cv.thickLine(gx - 18, gy - 8, gx - 46, gy + 30, 3, [16, 16, 16]);
  // smoke puffs
  cv.circle(x + 46, y + h - 96, 16, [200, 196, 186]);
  cv.circle(x + 66, y + h - 118, 20, [214, 210, 200]);
  cv.circle(x + 92, y + h - 140, 14, [200, 196, 186]);
  cv.circle(x + w - 60, y + h - 104, 15, [200, 196, 186]);
  cv.circle(x + w - 40, y + h - 128, 19, [214, 210, 200]);
  // red banner
  cv.rect(x, y + h - 40, w, 40, RED);
  drawTextCentered(cv, x + Math.floor(w / 2), y + h - 32, "NO DEAL IN TURKIYE", 3, WHITE);
}

// Small Capitol dome strip (fits a panel about 64 px tall).
function drawCapitol(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, NAVY);
  const cx = x + Math.floor(w / 2);
  const base = y + h - 8;
  // dome: a circle whose lower half is hidden behind the building block
  cv.circle(cx, base - 26, 30, WHITE);
  cv.rect(cx - 30, base - 26, 60, 26, WHITE);
  // gold finial on top of the dome
  cv.circle(cx, y + 3, 3, GOLD);
  // building block
  cv.rect(cx - 110, base - 26, 220, 26, WHITE);
  cv.rect(cx - 150, base - 8, 300, 8, WHITE);
  // columns
  for (let i = 0; i < 9; i++) {
    cv.rect(cx - 104 + i * 24, base - 22, 8, 18, NAVY);
  }
  // windows on the flanks
  for (const wx of [cx - 96, cx - 76, cx + 68, cx + 88]) {
    cv.rect(wx, base - 20, 10, 12, NAVY);
  }
}

// Sea, warship and explosion burst (fits a panel about 64 px tall).
function drawShip(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x, y, w, h, [214, 226, 232]);
  // sea
  cv.rect(x, y + 18, w, h - 18, [28, 74, 110]);
  for (let i = 0; i < 6; i++) {
    cv.hline(x + 14 + i * 72, y + 30 + (i % 3) * 12, 46, [120, 170, 205]);
  }
  // small sun, top left
  cv.circle(x + 30, y + 10, 8, GOLD);
  // hull with bow to the right
  const hx = x + 70;
  const hy = y + 36;
  cv.rect(hx, hy, 240, 14, [52, 52, 52]);
  cv.tri(hx + 240, hy, hx + 278, hy + 7, hx + 240, hy + 14, [52, 52, 52]);
  cv.rect(hx + 70, hy - 16, 80, 16, [90, 90, 90]);
  cv.rect(hx + 160, hy - 22, 20, 22, [90, 90, 90]);
  cv.line(hx + 110, hy - 16, hx + 110, hy - 30, [52, 52, 52]);
  // explosion burst above the stern
  const ex = hx + 26;
  const ey = hy - 12;
  cv.circle(ex, ey, 18, ORANGE);
  cv.circle(ex, ey, 10, GOLD);
  cv.circle(ex - 16, ey + 8, 7, ORANGE);
  cv.circle(ex + 16, ey - 4, 7, ORANGE);
  // smoke
  cv.circle(ex - 4, ey - 24, 9, [90, 88, 84]);
  cv.circle(ex + 10, ey - 34, 11, [110, 108, 102]);
  // drone, top right
  const dx = x + w - 70;
  const dy = y + 10;
  cv.rect(dx - 10, dy - 3, 20, 6, INK);
  cv.hline(dx - 18, dy - 8, 36, INK);
  cv.hline(dx - 18, dy + 6, 36, INK);
  cv.circle(dx - 16, dy - 8, 3, GREY);
  cv.circle(dx + 16, dy - 8, 3, GREY);
  cv.circle(dx - 16, dy + 8, 3, GREY);
  cv.circle(dx + 16, dy + 8, 3, GREY);
}

// ---------------------------------------------------------------- page
function drawPage(): Canvas {
  const cv = new Canvas();
  cv.rect(0, 0, W, H, PAPER);
  const M = 30; // margin
  const RW = W - 2 * M; // 964

  // ---- masthead
  drawTextCentered(cv, W / 2, 26, "THE WORLD IN ONE DAY", 8, INK);
  drawTextCentered(cv, W / 2, 100, "MONDAY 23 NOVEMBER 2026", 3, RED);
  cv.hline(M, 132, RW, INK);
  cv.hline(M, 136, RW, INK);
  drawTextCentered(cv, W / 2, 144, "THE DAY'S WORLD NEWS, IN ONE PAGE", 2, GREY);

  // ---- lead story: COP31
  const leadY = 178;
  const leadTextW = 566;
  drawText(cv, M, leadY, "CLIMATE SUMMIT - TURKIYE", 2, RED);
  let y = leadY + 30;
  const leadHead = wrap("CLIMATE TALKS COLLAPSE WITH NO DEAL", leadTextW, 5);
  for (const ln of leadHead) {
    drawText(cv, M, y, ln, 5, INK);
    y += 7 * 5 + 10;
  }
  y += 6;
  y = paragraph(
    cv,
    M,
    y,
    "NEARLY 200 NATIONS LEFT THE COP31 SUMMIT IN TURKIYE WITHOUT AN OVERARCHING AGREEMENT AFTER TWO DAYS OF OVERTIME TALKS. THE EUROPEAN UNION AND OTHERS REJECTED THE FINAL DRAFT AS TOO WEAK ON FOSSIL FUELS.",
    2,
    leadTextW,
    INK,
  );
  drawLeadArt(cv, 622, leadY, 372, 296);
  cv.hline(M, 492, RW, INK);

  // ---- second row: Democrats | Libya ship
  const row2Y = 500;
  const colW = 467;
  // left: US House
  drawText(cv, M, row2Y, "UNITED STATES", 2, RED);
  let y2 = row2Y + 28;
  const usHead = wrap("DEMOCRATS WIN THE HOUSE", colW, 4);
  for (const ln of usHead) {
    drawText(cv, M, y2, ln, 4, INK);
    y2 += 7 * 4 + 8;
  }
  y2 += 4;
  y2 = paragraph(
    cv,
    M,
    y2,
    "DEMOCRATS CLINCHED AT LEAST 258 SEATS, THE LARGEST HOUSE MAJORITY SINCE 1992.",
    2,
    colW,
    INK,
  );
  drawCapitol(cv, M, 684, colW, 64);
  // right: Libya
  const rx = M + colW + 30;
  drawText(cv, rx, row2Y, "LIBYA - MEDITERRANEAN", 2, RED);
  let y3 = row2Y + 28;
  const lyHead = wrap("SEA DRONES HIT RUSSIAN WARSHIP", colW, 4);
  for (const ln of lyHead) {
    drawText(cv, rx, y3, ln, 4, INK);
    y3 += 7 * 4 + 8;
  }
  y3 += 4;
  y3 = paragraph(
    cv,
    rx,
    y3,
    "SUSPECTED UKRAINIAN SEA DRONES STRUCK THE CORVETTE MERKURY AT BENGHAZI. OFFICIALS SAY IT WAS BADLY DAMAGED AND LATER CAPSIZED.",
    2,
    colW,
    INK,
  );
  drawShip(cv, rx, 684, colW, 64);
  cv.hline(M, 764, RW, INK);

  // ---- third row: Hormuz | briefs
  const row3Y = 780;
  drawText(cv, M, row3Y, "STRAIT OF HORMUZ", 2, RED);
  let y4 = row3Y + 28;
  const hzHead = wrap("TANKERS STRUCK IN THE GULF", colW, 4);
  for (const ln of hzHead) {
    drawText(cv, M, y4, ln, 4, INK);
    y4 += 7 * 4 + 8;
  }
  y4 += 4;
  y4 = paragraph(
    cv,
    M,
    y4,
    "AT LEAST THREE OIL TANKERS WERE STRUCK IN AND NEAR THE STRAIT, AND TWO MORE CAUGHT FIRE AFTER HITTING MINES, IRAN SAID. ATTACKS ON SHIPPING THERE ARE AT THEIR HIGHEST SINCE THE WAR BEGAN.",
    2,
    colW,
    INK,
  );
  // right: also today
  drawText(cv, rx, row3Y, "ALSO TODAY", 2, RED);
  const briefs: [string, string][] = [
    ["INDONESIA", "24 BODY BAGS FROM A FACTORY FIRE IN JAVA."],
    ["KYIV REGION", "RUSSIAN STRIKES KILLED 11, UKRAINE SAID."],
    ["TRAVEL", "1,000 DELTA FLIGHTS DELAYED AT ATLANTA."],
    ["SPORT", "ALCARAZ BEAT ZVEREV TO WIN THE ATP FINALS."],
  ];
  let yb = row3Y + 28;
  for (const [k, body] of briefs) {
    drawText(cv, rx, yb, k + " -", 2, INK);
    const lines = wrap(body, colW - textWidth(k + " - ", 2), 2);
    let yy = yb;
    for (const ln of lines) {
      drawText(cv, rx + textWidth(k + " - ", 2), yy, ln, 2, INK);
      yy += 7 * 2 + 3;
    }
    yb = yy + 8;
    if (yb < 968) cv.hline(rx, yb - 5, colW, LIGHTGREY);
  }

  // ---- footer
  cv.hline(M, 978, RW, INK);
  drawTextCentered(cv, W / 2, 988, "AS REPORTED ON MONDAY 23 NOVEMBER 2026 - AP - REUTERS - XINHUA - SCMP", 2, GREY);
  return cv;
}

// ---------------------------------------------------------------- main
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  const cv = drawPage();
  const png = encodePNG(cv);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
