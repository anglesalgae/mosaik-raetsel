// Einmaliges Werkzeug: SVG-Pfade (game-icons) rastern und Kontaktbogen als PNG schreiben.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { deflateSync } from 'node:zlib';

/* ---------- SVG-Pfad in Polygone zerlegen ---------- */
export function parsePath(d) {
  let i = 0;
  const n = d.length;
  const skip = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
  const isNumStart = () => { skip(); return i < n && /[-+.\d]/.test(d[i]); };
  const num = () => {
    skip();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i, i + 40));
    if (!m) throw new Error('num at ' + i + ': ' + d.slice(i, i + 20));
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const flag = () => { skip(); const c = d[i++]; if (c !== '0' && c !== '1') throw new Error('flag'); return c === '1' ? 1 : 0; };
  const polys = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = '';
  const lineTo = (nx, ny) => { cur.push([nx, ny]); x = nx; y = ny; };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const steps = 12;
    const x0 = x, y0 = y;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      lineTo(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
  };
  const quad = (x1, y1, x2, y2) => {
    const steps = 10, x0 = x, y0 = y;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      lineTo(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2);
    }
  };
  const arc = (rx, ry, phi, fa, fs, x2, y2) => {
    const x1 = x, y1 = y;
    if (rx === 0 || ry === 0) { lineTo(x2, y2); return; }
    rx = Math.abs(rx); ry = Math.abs(ry);
    const p = (phi * Math.PI) / 180, cp = Math.cos(p), sp = Math.sin(p);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = Math.sqrt(Math.max(0, num2 / den));
    if (fa === fs) co = -co;
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
    const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => {
      const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    };
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI;
    if (fs && dt < 0) dt += 2 * Math.PI;
    const steps = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 16)));
    for (let k = 1; k <= steps; k++) {
      const t = t1 + (dt * k) / steps;
      const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
      lineTo(cp * ex - sp * ey + cx, sp * ex + cp * ey + cy);
    }
  };
  while (true) {
    skip();
    if (i >= n) break;
    if (/[a-zA-Z]/.test(d[i])) { cmd = d[i++]; }
    else if (!cmd) throw new Error('no cmd');
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        const nx = num() + ox, ny = num() + oy;
        cur = [[nx, ny]]; polys.push(cur); x = sx = nx; y = sy = ny;
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': lineTo(num() + ox, num() + oy); break;
      case 'H': lineTo(num() + (rel ? x : 0), y); break;
      case 'V': lineTo(x, num() + (rel ? y : 0)); break;
      case 'C': {
        const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy];
        cubic(...a); lcx = a[2]; lcy = a[3];
        break;
      }
      case 'S': {
        const rx1 = /[CS]/.test(prev) ? 2 * x - lcx : x, ry1 = /[CS]/.test(prev) ? 2 * y - lcy : y;
        const a = [num() + ox, num() + oy, num() + ox, num() + oy];
        cubic(rx1, ry1, ...a); lcx = a[0]; lcy = a[1];
        break;
      }
      case 'Q': {
        const a = [num() + ox, num() + oy, num() + ox, num() + oy];
        quad(...a); lqx = a[0]; lqy = a[1];
        break;
      }
      case 'T': {
        const qx = /[QT]/.test(prev) ? 2 * x - lqx : x, qy = /[QT]/.test(prev) ? 2 * y - lqy : y;
        const a = [num() + ox, num() + oy];
        quad(qx, qy, ...a); lqx = qx; lqy = qy;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), phi = num(), fa = flag(), fs = flag();
        arc(rx, ry, phi, fa, fs, num() + ox, num() + oy);
        break;
      }
      case 'Z': {
        if (cur) cur.push([sx, sy]);
        x = sx; y = sy;
        // Nach Z beginnt ein neuer Teilpfad am Startpunkt
        cur = [[sx, sy]]; polys.push(cur);
        break;
      }
      default: throw new Error('cmd ' + cmd);
    }
    prev = C;
    if (C === 'Z') { skip(); if (i < n && !/[a-zA-Z]/.test(d[i])) throw new Error('num after Z'); }
  }
  return polys.filter(p => p.length > 2);
}

/* ---------- Rastern (nonzero) mit Überabtastung ---------- */
export function rasterize(polys, size, vb = 512, ss = 4) {
  const N = size * ss, scale = N / vb;
  const edges = [];
  for (const p of polys) {
    for (let k = 0; k < p.length; k++) {
      const [ax, ay] = p[k], [bx, by] = p[(k + 1) % p.length];
      if (ay === by) continue;
      edges.push([ax * scale, ay * scale, bx * scale, by * scale]);
    }
  }
  const cov = new Float32Array(size * size);
  for (let r = 0; r < N; r++) {
    const yy = r + 0.5;
    const xs = [];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) {
        xs.push([ax + ((yy - ay) * (bx - ax)) / (by - ay), by > ay ? 1 : -1]);
      }
    }
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1];
      if (wind !== 0) {
        const x0 = Math.max(0, Math.ceil(xs[k][0] - 0.5)), x1 = Math.min(N - 1, Math.floor(xs[k + 1][0] - 0.5));
        for (let c = x0; c <= x1; c++) cov[Math.floor(r / ss) * size + Math.floor(c / ss)] += 1 / (ss * ss);
      }
    }
  }
  return cov;
}

/* ---------- PNG schreiben (Graustufen) ---------- */
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
export function writePng(file, w, h, gray) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = gray[y * w + x]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** Icon-Pfad (weiß auf schwarz) aus einer game-icons-SVG holen. */
export function iconPath(svg) {
  const m = /<path fill="#fff" d="([^"]+)"/.exec(svg);
  return m ? m[1] : null;
}

export function listSvgs(root) {
  const out = [];
  for (const author of readdirSync(root)) {
    const dir = join(root, author);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.svg')) out.push({ author, name: basename(f, '.svg'), file: join(dir, f) });
  }
  return out;
}

export { readFileSync };
