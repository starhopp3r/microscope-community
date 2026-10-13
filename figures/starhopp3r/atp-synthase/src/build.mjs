import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as G from "../../../../.skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../../.skill/kit/tube.mjs";
import * as A from "../../../../.skill/kit/audit.mjs";
import { kitScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { SPECIES, NM, SLOWER, C_SUBUNITS, ATP_PER_TURN, H_PER_ATP, REV_PER_S, SOURCES, readoutOf } from "./model.mjs";
import { VIEW_DEG, RING, RING_R, FOOT, SHAFT, DE, SITE, ASUB, OUTLET, INLET, HOLE_R, polar, backSlot, rotorSvg } from "./rotor.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 600;
const H = 520;
const ELEVATION = 32;

const PLATE = { x: -94, y: -76, w: 188, d: 152, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const MEM = { x0: -70, x1: 70, y0: -54, y1: 54, z0: 40, mid: 55, z1: 70 };
const POSTS = [[-54, -38], [-54, 38], [54, -38], [-12, 44]];
const LOBE = { rc: 21, re: 10.5, z: 99, h: 44, tilt: 8, n: 2.3 };
const LOBES = Array.from({ length: 6 }, (_, index) => ({ angle: 40 + index * 60, kind: index % 2 ? "alpha" : "beta" }));
const OSCP_R = 12;
const STALK_R = 3;
const THETA0 = ASUB.angle;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, 192], [-26, 30, 192], [30, -30, 160]],
  W,
  H,
  { pad: 26, azimuth: VIEW_DEG, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (point) => k.depthOf(point, P);

const R = A.recorder(P);
const record = R.solid;
function put(part, name, centre, svg, shapes = [], bias = 0) {
  R.put({ piece: "figure", name, at: centre, bias, svg, shapes, part });
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function hullOf(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const insideRect = ([x, y]) => x > MEM.x0 + 1e-6 && x < MEM.x1 - 1e-6 && y > MEM.y0 + 1e-6 && y < MEM.y1 - 1e-6;
function rectHit(a, b) {
  let best = 1;
  for (const [axis, value] of [[0, MEM.x0], [0, MEM.x1], [1, MEM.y0], [1, MEM.y1]]) {
    const span = b[axis] - a[axis];
    if (Math.abs(span) < 1e-12) continue;
    const t = (value - a[axis]) / span;
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (p[0] >= MEM.x0 - 1e-6 && p[0] <= MEM.x1 + 1e-6 && p[1] >= MEM.y0 - 1e-6 && p[1] <= MEM.y1 + 1e-6) best = Math.min(best, t);
  }
  return [a[0] + (b[0] - a[0]) * best, a[1] + (b[1] - a[1]) * best];
}
const perimeterOf = ([x, y]) => {
  const w = MEM.x1 - MEM.x0;
  const d = MEM.y1 - MEM.y0;
  if (Math.abs(y - MEM.y0) < 1e-6) return x - MEM.x0;
  if (Math.abs(x - MEM.x1) < 1e-6) return w + (y - MEM.y0);
  if (Math.abs(y - MEM.y1) < 1e-6) return w + d + (MEM.x1 - x);
  return 2 * w + d + (MEM.y1 - y);
};
const signedArea = (ring) => ring.reduce((sum, p, index) => sum + cross([0, 0], p, ring[(index + 1) % ring.length]), 0) / 2;

const arcPoints = (r, from, to, steps) => Array.from({ length: steps + 1 }, (_, index) => polar(r, from + ((to - from) * index) / steps).slice(0, 2));
const sectorOf = (from, to) => [...arcPoints(ASUB.r1, from, to, 18), ...arcPoints(ASUB.r0, to, from, 18)];
const SECTOR = sectorOf(ASUB.angle - ASUB.span, ASUB.angle + ASUB.span);

function membraneRing() {
  const shape = [...arcPoints(RING_R, 0, 360, 96), ...SECTOR];
  const u = polar(600, VIEW_DEG);
  const bay = hullOf([...shape, ...shape.map(([x, y]) => [x + u[0], y + u[1]])]);
  const count = bay.length;
  const start = bay.findIndex((p, index) => !insideRect(p) && insideRect(bay[(index + 1) % count]));
  const chain = [];
  let index = (start + 1) % count;
  while (insideRect(bay[index])) {
    chain.push(bay[index]);
    index = (index + 1) % count;
  }
  const enter = rectHit(bay[(start + 1) % count], bay[start]);
  const leave = rectHit(chain[chain.length - 1], bay[index]);
  const corners = [[MEM.x0, MEM.y0], [MEM.x1, MEM.y0], [MEM.x1, MEM.y1], [MEM.x0, MEM.y1]];
  const total = 2 * (MEM.x1 - MEM.x0 + MEM.y1 - MEM.y0);
  const from = perimeterOf(enter);
  const ahead = (p) => (perimeterOf(p) - from + total) % total;
  const until = ahead(leave);
  const around = corners.filter((c) => ahead(c) > 1e-6 && ahead(c) < until - 1e-6).sort((a, b) => ahead(a) - ahead(b));
  const ring = [leave, ...[...chain].reverse(), enter, ...around];
  const area = signedArea(ring);
  if (Math.abs(area) < 0.6 * (MEM.x1 - MEM.x0) * (MEM.y1 - MEM.y0)) throw new Error(`membrane outline came out the wrong way round (${area.toFixed(0)})`);
  return ring;
}
const MEMBRANE = membraneRing();

function insidePolygon([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function edgeDistance([x, y], ring) {
  let best = Infinity;
  ring.forEach(([ax, ay], index) => {
    const [bx, by] = ring[(index + 1) % ring.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  });
  return best;
}

const HEAD = 4.6;
function mount() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const byDepth = (points) => [...points].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
    record(A.cylinder(x, y, 7, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot", ground: true }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -78, y: PLATE.y + PLATE.d - 15, w: 72, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + 6 + 10 * NM, NM, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.4, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2.4, strip.y + 3.5, 0.6])], { size: 0.45 }));
  const label = { x: 18, y: PLATE.y + PLATE.d - 24, w: 62, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + 7.2], 0.8, P, "x"), SPECIES, { size: 4.2, tone: "mid", anchor: "middle" }));
  out.push(L([0.42, 0.26].map((share, index) => k.lineOnTop([label.x + 6, label.y + 10.4 + index * 2.2], [label.x + 6 + (label.w - 12) * share, label.y + 10.4 + index * 2.2], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 3, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3, label.y + label.d / 2, 0.8])], { size: 0.42 }));
  for (const [x, y] of byDepth(POSTS)) {
    out.push(S(k.cylinder(x, y, 6, 0, 3, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 3.2, 3, MEM.z0 - 4 - 3, P, 24), { tone: "mid", crease: "none" }));
    out.push(L([12, 24].map((z) => k.sideArc(x, y, 3.2, z, P, 14)).join(""), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 6, MEM.z0 - 4, 4, P, 28, 0.4), { tone: "mid" }));
    record(A.cylinder(x, y, 6, 0, 3, { name: "stand.post.collar", ground: true }));
    record(A.cylinder(x, y, 3.2, 3, MEM.z0 - 7, { name: "stand.post", ground: true }));
    record(A.cylinder(x, y, 6, MEM.z0 - 4, 4, { name: "stand.post.cap", ground: true }));
  }
  return out.join("");
}

function membrane() {
  const lower = k.extrude(MEMBRANE, MEM.z0, MEM.mid - MEM.z0, P, { convex: false });
  const upper = k.extrude(MEMBRANE, MEM.mid, MEM.z1 - MEM.mid, P, { convex: false });
  const tails = [];
  const heads = [];
  const toward = k.towardViewer(P);
  MEMBRANE.forEach((a, index) => {
    const b = MEMBRANE[(index + 1) % MEMBRANE.length];
    const onX = Math.abs(a[0] - MEM.x1) < 1e-6 && Math.abs(b[0] - MEM.x1) < 1e-6;
    const onY = Math.abs(a[1] - MEM.y1) < 1e-6 && Math.abs(b[1] - MEM.y1) < 1e-6;
    if (!onX && !onY) return;
    if ((onX ? toward[0] : toward[1]) <= 0) return;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const count = Math.floor((length - HEAD) / HEAD);
    const first = (length - count * HEAD) / 2;
    for (let i = 0; i <= count; i++) {
      const s = first + i * HEAD;
      const p = [a[0] + along[0] * s, a[1] + along[1] * s];
      for (const [zh, zm] of [[MEM.z1 - 1.6, MEM.mid], [MEM.z0 + 1.6, MEM.mid]]) {
        heads.push(at([p[0], p[1], zh]));
        for (const side of [-0.7, 0.7]) tails.push(k.segment([p[0] + along[0] * side, p[1] + along[1] * side, zh], [p[0] + along[0] * side, p[1] + along[1] * side, zm], P));
      }
    }
  });
  const dots = [];
  for (let x = MEM.x0 + HEAD / 2; x < MEM.x1; x += HEAD) {
    for (let y = MEM.y0 + HEAD / 2; y < MEM.y1; y += HEAD) {
      if (insidePolygon([x, y], MEMBRANE) && edgeDistance([x, y], MEMBRANE) > 1.4) dots.push(at([x, y, MEM.z1]));
    }
  }
  const svg =
    `<g class="as-cut">${S(lower, { tone: "mid" })}${S(upper, { tone: "mid", inner: L(tails.join(""), { tone: "faint" }) + D(heads, { size: 0.62, tone: "lo" }) })}</g>` +
    D(dots, { size: 0.4, tone: "lo" });
  put("membrane", "membrane", [0, 0, MEM.mid], svg, [record(A.extruded(MEMBRANE, MEM.z0, MEM.z1 - MEM.z0, { name: "membrane" }))], -40);
}

function voidSvg(d) {
  return `<path class="as-void" d="${d}"/>` + L(d, { tone: "lo" });
}

function asubunit() {
  const halves = [
    ["asub.back", ASUB.angle, ASUB.angle + ASUB.span],
    ["asub.front", ASUB.angle - ASUB.span, ASUB.angle],
  ];
  for (const [name, from, to] of halves) {
    const ring = sectorOf(from, to);
    const paths = k.extrude(ring, ASUB.z0, ASUB.z1 - ASUB.z0, P, { convex: false });
    let extra = "";
    if (name === "asub.back") {
      const [x, y] = polar(OUTLET.r, OUTLET.angle);
      extra = voidSvg(k.ring(x, y, HOLE_R, ASUB.z1, P, 24));
    } else {
      const centre = polar(INLET.r, INLET.angle, INLET.z);
      const normal = polar(1, INLET.angle - 90);
      const helices = [ASUB.r0 + 3.2, ASUB.r1 - 3.2].map((r) => k.segment(polar(r, INLET.angle, ASUB.z0), polar(r, INLET.angle, ASUB.z1), P)).join("");
      extra = L(helices, { tone: "faint" }) + voidSvg(G.circleOf(G.frameAlong(centre, normal), 0, HOLE_R, P, 28));
    }
    const mid = polar((ASUB.r0 + ASUB.r1) / 2, (from + to) / 2, (ASUB.z0 + ASUB.z1) / 2);
    const seam = k.ringSeam(ring, MEM.mid, P);
    put("asub", name, mid, S(paths, { tone: "hi", inner: L(seam, { tone: "faint" }) }) + extra, [record(A.extruded(ring, ASUB.z0, ASUB.z1 - ASUB.z0, { name, owner: "asub" }))]);
  }
}

const SPRITE_H = S(G.sphereOf([0, 0, 0], 1.8, P, { steps: 32 }), { tone: "hi" });
const ATP_BALLS = [[0, 2.6, "hi"], [4.1, 1.5, "mid"], [7.1, 1.5, "mid"], [10.1, 1.5, "mid"]];
const SPRITE_ATP = ATP_BALLS.map(([z, r, tone]) => S(G.sphereOf([0, 0, z], r, P, { steps: 32 }), { tone })).join("");
const sprite = (point) => `<g transform="${k.translateAlong(P, point)}">${SPRITE_H}</g>`;

function rotor() {
  const rest = rotorSvg(THETA0, P, k, sprite);
  const back = [];
  const front = [];
  for (let index = 0; index < RING.n; index++) {
    const phi = THETA0 + (index * 360) / RING.n;
    const [x, y] = polar(RING.rc, phi);
    (backSlot(phi) ? back : front).push(record(A.cylinder(x, y, RING.rs, RING.z0, RING.z1 - RING.z0, { name: "rotor.stave", owner: "rotor" })));
  }
  const [ex, ey] = polar(DE.off, THETA0 + DE.at);
  front.push(
    record(A.cylinder(0, 0, FOOT.r, FOOT.z, FOOT.h, { name: "rotor.foot", owner: "rotor" })),
    record(A.cylinder(0, 0, SHAFT.r, SHAFT.z, SHAFT.top - SHAFT.z, { name: "rotor.gamma", owner: "rotor" })),
    record(A.cylinder(ex, ey, DE.r, DE.z, DE.h, { name: "rotor.delta-epsilon", owner: "rotor" })),
  );
  put("rotor", "rotor.back", polar(RING.rc, ASUB.angle + 90, SITE.z), `<g data-live="rotor-back">${rest.back}</g>`, back);
  put("rotor", "rotor.front", [0, 0, FOOT.z], `<g data-live="rotor-front">${rest.front}</g>`, front);
}

const lobeRadius = (s) => {
  const c = LOBE.h / 2;
  const q = Math.min(1, Math.abs((s - c) / c));
  return LOBE.re * Math.max(0, 1 - q ** LOBE.n) ** (1 / LOBE.n);
};
const lobeSlope = (s) => {
  const c = LOBE.h / 2;
  const signed = Math.max(-0.995, Math.min(0.995, (s - c) / c));
  const q = Math.abs(signed);
  return (-LOBE.re * Math.sign(signed) * q ** (LOBE.n - 1) * (1 - q ** LOBE.n) ** (1 / LOBE.n - 1)) / c;
};
const LOBE_PROFILE = Array.from({ length: 31 }, (_, index) => {
  const t = (Math.PI * (index + 1)) / 32;
  const s = (LOBE.h / 2) * (1 - Math.cos(t));
  return [s, lobeRadius(s), 1];
});
const DOMAINS = [0.3, 0.7].map((share) => share * LOBE.h);
const lobeFrame = (lobe) => {
  const tilt = (LOBE.tilt * Math.PI) / 180;
  const out = polar(1, lobe.angle);
  const axis = [-out[0] * Math.sin(tilt), -out[1] * Math.sin(tilt), Math.cos(tilt)];
  const centre = polar(LOBE.rc, lobe.angle, LOBE.z + LOBE.h / 2);
  return { centre, axis, F: G.frameAlong(G.sub3(centre, G.mul3(axis, LOBE.h / 2)), axis) };
};
const FRAMES = LOBES.map(lobeFrame);
const insideLobes = (p, margin = 0) =>
  FRAMES.some(({ centre, axis }) => {
    const d = G.sub3(p, centre);
    const s = G.dot3(d, axis);
    const q = G.len3(G.sub3(d, G.mul3(axis, s)));
    return Math.abs(s) < LOBE.h / 2 && q < lobeRadius(s + LOBE.h / 2) + margin;
  });
const restingHeight = (radius) => {
  const rim = (z) => Array.from({ length: 180 }, (_, index) => polar(radius, index * 2, z));
  let z = LOBE.z + LOBE.h + 4;
  while (z > LOBE.z && !rim(z).some((p) => insideLobes(p))) z -= 0.02;
  return z + 0.02;
};
const OSCP = { r: OSCP_R, z: restingHeight(OSCP_R) };

function head() {
  LOBES.forEach((lobe, index) => {
    const { centre, F } = FRAMES[index];
    const paths = G.solidOf(LOBE_PROFILE, F, P, { smooth: { slope: lobeSlope, radius: lobeRadius, rows: 5 } });
    const seams = DOMAINS.map((s) => G.arcOf(F, s, lobeRadius(s), P, { slope: lobeSlope(s) })).join("");
    const name = `head.${lobe.kind}${lobe.angle}`;
    put("head", name, centre, S(paths, { tone: lobe.kind === "beta" ? "hi" : "mid", inner: L(seams, { tone: "faint" }) }), [record(A.solid(F, LOBE_PROFILE, { radius: lobeRadius, name, owner: "head" }))]);
  });
}

const capRadius = (s) => Math.sqrt(Math.max(0, OSCP.r * OSCP.r - s * s));
const capSlope = (s) => -Math.min(s, OSCP.r * 0.995) / Math.sqrt(Math.max(1e-6, OSCP.r * OSCP.r - Math.min(s, OSCP.r * 0.995) ** 2));
const CAP_PROFILE = Array.from({ length: 24 }, (_, index) => {
  const t = ((Math.PI / 2) * index) / 24;
  const s = OSCP.r * Math.sin(t);
  return [s, capRadius(s), index ? 1 : 0];
});

function stator() {
  const F = G.frameOf([0, 0, OSCP.z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const paths = G.solidOf(CAP_PROFILE, F, P, { smooth: { slope: capSlope, radius: capRadius, rows: 5 } });
  put("stator", "stator.oscp", [0, 0, OSCP.z + 4], S(paths, { tone: "hi", inner: L(G.arcOf(F, 3.2, capRadius(3.2), P, { slope: capSlope(3.2) }), { tone: "faint" }) }), [record(A.solid(F, CAP_PROFILE, { radius: capRadius, name: "stator.oscp", owner: "oscp" }))]);
  const land = OSCP.z + Math.sqrt(OSCP.r * OSCP.r - STALK_R * STALK_R);
  const STALK_DEG = ASUB.angle - 20;
  const base = polar(ASUB.r1 - 3.4, STALK_DEG);
  const out = polar(38, STALK_DEG);
  const control = [
    [base[0], base[1], ASUB.z1],
    [base[0], base[1], ASUB.z1 + 5],
    [out[0], out[1], ASUB.z1 + 18],
    [out[0], out[1], OSCP.z + OSCP.r + 26],
    [0, 0, OSCP.z + OSCP.r + 26],
    [0, 0, land],
  ];
  const route = G.fillet(control, STALK_R * 2.6, 12, { P, tube: STALK_R });
  R.route("stator.b", route, STALK_R, { owner: "stator", piece: "figure" });
  tubePieces(route, STALK_R, P, { maxLength: 18 }).forEach((piece, index) => {
    put("stator", `stator.b:${index}`, piece.mid, tubeSvg(piece, { tone: "hi" }), [A.tube(piece.points, piece.radii)]);
    R.items[R.items.length - 1].route = "stator.b";
    R.items[R.items.length - 1].chunk = index;
  });
}

const MOUNT = mount();
membrane();
asubunit();
rotor();
head();
stator();

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const slot = (name) => `<g data-live="${name}"></g>`;
const order = [];
const firstHead = R.items.findIndex((item) => item.part === "head");
R.items.forEach((item, index) => {
  if (index === firstHead) order.push(slot("atp-behind"));
  if (item.name === "rotor.back") order.push(slot("matrix"));
  if (item.name === "rotor.front") order.push(slot("ims"));
  order.push(`<g class="it" data-part="${item.part}" data-name="${item.name}">${item.svg}</g>`);
});
order.push(slot("atp-front"));

const LABEL =
  "Bovine mitochondrial ATP synthase standing through a square patch of inner mitochondrial membrane, cut away at the front so the rotor is in view. The patch rests on four posts on a base plate with a 10 nanometre scale bar. In the membrane, a ring of eight c subunits sits against the a-subunit; above it the central stalk rises into the F1 head of three alpha and three beta subunits, capped by OSCP and held by the peripheral stalk. Protons from below enter the a-subunit, ride the ring and leave above, turning the ring and stalk; every third of a turn one ATP leaves the head.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [MOUNT, ...order], className: "as-svg" });

const KEYS = [
  ["rotor", "01", `Rotor: c-ring of ${C_SUBUNITS} and central stalk γ, δ, ε`],
  ["asub", "02", "a-subunit, with the two proton half-channels"],
  ["head", "03", "F₁ head α₃β₃ (α darker, β paler)"],
  ["stator", "04", "Peripheral stalk (b, d, F6) and OSCP"],
  ["membrane", "05", "Inner membrane, about 5 nm"],
];
const keysHtml = `<span class="iso-keys as-keys">${KEYS.map(([part, n, label]) => `<button type="button" class="as-key" data-key="${part}"><span class="as-n">${n}</span>${label}</button>`).join("")}<span class="as-key as-static"><span class="as-dot"></span>H⁺ and ATP</span></span>`;
const caption = `Bovine (${SPECIES}) mitochondrial ATP synthase in a patch of inner membrane, matrix above and intermembrane space below; scale bar 10 nm. Protons enter the a-subunit from below, ride the ${C_SUBUNITS}-subunit c-ring almost a full turn and leave into the matrix. The ring and central stalk turn anticlockwise seen from the matrix, and every 120° of the γ stalk releases one ATP from a β subunit: ${C_SUBUNITS} H⁺ and ${ATP_PER_TURN} ATP per turn, about ${H_PER_ATP.toFixed(1)} H⁺ per ATP. The enzyme turns about ${REV_PER_S} times a second; here each 45° proton step is about ${SLOWER}× slower, and the elastic coupling between 45° steps in F₀ and 120° steps in F₁ is drawn as one rigid rotor. Sources: ${SOURCES.map((entry) => entry.source).filter((value, index, list) => list.indexOf(value) === index).join("; ")}.`;

const stage = `<div class="iso-stage as" tabindex="0" role="slider" aria-label="ATP synthase: hover to drive protons through, right arrow for one proton, space to pause" aria-valuemin="0" aria-valuemax="1000000" aria-valuenow="0" aria-valuetext="${readoutOf(0)}">${svg}</div>`;
const plate = k.plateHtml({ fig: "Fig 1", title: "ATP synthase", hint: "Hover to drive · → one proton", readout: readoutOf(0), caption, body: stage });
const body = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${keysHtml}`);

const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const DATA = { P, THETA0, SPRITE_H, SPRITE_ATP, LOBES, LOBE, SLOWER };
const live = `const DATA = ${JSON.stringify(DATA)};\n${strip("model.mjs")}\n${strip("rotor.mjs")}\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const css = readFileSync(join(HERE, "atp.css"), "utf8");
const page = k.pageHtml({ title: "ATP synthase", theme, body: `<style>${css}</style>${body}`, script: kitScript() + live });
const file = theme === "light" ? "atp-synthase-light.html" : "atp-synthase.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file);
A.auditOrExit(R, P);
