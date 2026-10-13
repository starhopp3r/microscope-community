import { bandsAt, contractionAt, CYCLE_S, THIN_UM, THICK_UM } from "./model.mjs";
export const UM = 100;
export const WINDOW = 190;
export const THIN_ROWS = [75, 25, -25, -75];
export const THICK_ROWS = [50, 0, -50];

const f1 = (v) => v.toFixed(1);

function thinSvg(P, B, x0, x1, z) {
  const a = B.iso([x0, 0, z], P);
  const b = B.iso([x1, 0, z], P);
  const k = B.screenScale(P);
  const line = (dz) => `M${f1(a[0])} ${f1(a[1] - dz * k)}L${f1(b[0])} ${f1(b[1] - dz * k)}`;
  const bead = 3.4 * k;
  const pitch = 6.4 * k;
  const strand = (dz, phase) =>
    `<path d="${line(dz)}" fill="none" stroke="var(--bio-actin-edge)" stroke-width="${f1(bead + 1.2)}" stroke-linecap="round" stroke-dasharray="0 ${f1(pitch)}" stroke-dashoffset="${f1(phase)}"/>` +
    `<path d="${line(dz)}" fill="none" stroke="var(--bio-actin)" stroke-width="${f1(bead)}" stroke-linecap="round" stroke-dasharray="0 ${f1(pitch)}" stroke-dashoffset="${f1(phase)}"/>`;
  return `<path class="bio-thin" d="${line(0)}" fill="none" stroke="var(--bio-actin-lo)" stroke-width="${f1(1.2 * k)}"/>` + strand(1.6, 0) + strand(-1.6, pitch / 2);
}

function headSvg(P, B, x, z, side, toward, tilt) {
  const k = B.screenScale(P);
  const [cx, cy] = B.iso([x + toward * 3, 0, z + side * 9], P);
  const angle = -side * toward * (55 - tilt);
  return `<ellipse class="bio-body" data-swatch="myosin" cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(5.2 * k)}" ry="${f1(2.6 * k)}" transform="rotate(${f1(angle)} ${f1(cx)} ${f1(cy)})" fill="url(#bio-r-myosin)"/>`;
}

function thickSvg(P, B, centre, z, cycling, time, anchor) {
  const half = (1.6 * UM) / 2;
  const bare = (0.16 * UM) / 2;
  const out = [B.rope(P, [[centre - half, 0, z], [centre + half, 0, z]], 6, "myosin")];
  let index = 0;
  for (const toward of [-1, 1]) {
    for (let d = bare + 4; d <= half - 3; d += 10.5) {
      for (const side of [1, -1]) {
        const x = centre + toward * d;
        const tilt = cycling * 22 * (0.5 + 0.5 * Math.sin(time * 7 + index * 1.7));
        out.push(headSvg(P, B, x, z, side, toward, tilt));
        if (anchor && toward === 1 && side === 1 && Math.abs(d - 52) < 5.5) anchor.head = B.iso([x + toward * 3, 0, z + side * 9], P);
        index++;
      }
    }
  }
  return out.join("");
}

function zdiscSvg(P, B, x) {
  const points = [];
  for (let z = 96, i = 0; z >= -96; z -= 12, i++) points.push([x + (i % 2 ? 3.5 : -3.5), 0, z]);
  return B.rope(P, points, 2.3, "zdisc");
}

export function sarcomereSvg(time, P, B, { L, R }) {
  const bands = bandsAt(time);
  const c = contractionAt(time);
  const tt = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  const cycling = tt >= 1.2 && tt < 5.2 ? Math.min(1, c * 4 + (tt < 3.8 ? 0.4 : 0)) : 0;
  const sl = bands.sl * UM;
  const thin = THIN_UM * UM;
  const half = (THICK_UM * UM) / 2;
  const zds = [-1.5, -0.5, 0.5, 1.5].map((n) => n * sl).filter((x) => Math.abs(x) < WINDOW + thin);
  const art = [];
  for (const z of THIN_ROWS) {
    for (const xz of zds) {
      const from = Math.max(-WINDOW - 20, xz - thin);
      const to = Math.min(WINDOW + 20, xz + thin);
      if (to > from) art.push(thinSvg(P, B, from, to, z));
    }
  }
  const anchor = {};
  for (const centre of [-sl, 0, sl]) {
    for (const z of THICK_ROWS) {
      if (centre - half > WINDOW + 20 || centre + half < -WINDOW - 20) continue;
      art.push(thickSvg(P, B, centre, z, cycling, time, centre === 0 && z === THICK_ROWS[0] ? anchor : null));
    }
  }
  for (const xz of zds) if (Math.abs(xz) < WINDOW + 10) art.push(zdiscSvg(P, B, xz));
  art.push(B.rope(P, [[0, 0, 62], [0, 0, -62]], 1.3, "zdisc"));
  const at = (p) => B.iso(p, P);
  const left = -sl / 2;
  const right = sl / 2;
  const y = (z) => at([0, 0, z])[1];
  const x = (v) => at([v, 0, 0])[0];
  const dims = [
    B.dimension([x(left), y(140)], [x(right), y(140)], `Sarcomere ${bands.sl.toFixed(2)} µm`, { offset: 0 }),
    B.dimension([x(-half), y(118)], [x(half), y(118)], `A band ${bands.a.toFixed(2)} µm`, { offset: 0 }),
    bands.h > 0.04 ? B.dimension([x(-bands.h * UM / 2), y(98)], [x(bands.h * UM / 2), y(98)], `H zone`, { offset: 0 }) : "",
    B.dimension([x(left + bands.i * UM / 2), y(-112)], [x(left - bands.i * UM / 2), y(-112)], `I band ${bands.i.toFixed(2)} µm`, { offset: 0 }),
  ];
  const labels = [
    B.label("Z disc", at([left + 3.5, 0, -84]), { side: "left", x: L }),
    B.label("Thin filament (actin)", at([left + 40, 0, 25]), { side: "left", x: L }),
    B.label("Thick filament (myosin)", at([-half + 10, 0, -50 + 5.5]), { side: "left", x: L }),
    B.label("Myosin heads", anchor.head, { side: "right", x: R }),
    B.label("M line", at([0, 0, -60]), { side: "right", x: R, drop: y(-92) - at([0, 0, -60])[1] }),
  ];
  return { art: art.join(""), annotations: dims.join("") + labels.join("") };
}
