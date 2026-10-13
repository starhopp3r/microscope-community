export const VIEW_DEG = 80;
export const VIEW_ELEVATION = 12;
export const ENVELOPE = { x0: -165, x1: 165, y0: -60, y1: 60, om: [-7, 0], pg: [-15, -9], im: [-34, -28], bottom: -80 };
export const PHAGE = { head: 120, headR: 43, collar: 5, sheathL: [92.5, 42], sheathR: [12, 16.5], tubeR: 4.5, tubeL: 79, plateR: 26, plateH: 9 };
export const FIBRE_ANGLES = Array.from({ length: 6 }, (_, index) => 30 + index * 60);

const TO_RAD = Math.PI / 180;
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const around = (r, deg, z) => [r * Math.cos(deg * TO_RAD), r * Math.sin(deg * TO_RAD), z];

export function geometryOf(state) {
  const off = state.offset;
  const sheathL = mix(PHAGE.sheathL[0], PHAGE.sheathL[1], state.contract);
  const sheathR = mix(PHAGE.sheathR[0], PHAGE.sheathR[1], state.contract);
  const plateTop = off + PHAGE.plateH;
  const sheathTop = plateTop + sheathL;
  const headBottom = sheathTop + PHAGE.collar;
  return { off, sheathL, sheathR, plateTop, sheathTop, headBottom, headMid: headBottom + PHAGE.head / 2, tubeBottom: sheathTop - PHAGE.tubeL };
}

function headSvg(P, B, g, state) {
  const k = B.screenScale(P);
  const [cx] = B.iso([0, 0, g.headMid], P);
  const y = (z) => B.iso([0, 0, z], P)[1];
  const w = PHAGE.headR * k;
  const top = g.headBottom + PHAGE.head;
  const cap = 26;
  const pts = { T: [cx, y(top)], UL: [cx - w, y(top - cap)], LL: [cx - w, y(g.headBottom + cap)], B: [cx, y(g.headBottom)], LR: [cx + w, y(g.headBottom + cap)], UR: [cx + w, y(top - cap)], C1: [cx, y(top - cap * 0.62)], C2: [cx, y(g.headBottom + cap * 0.62)] };
  const path = (names) => `M${names.map((n) => `${pts[n][0].toFixed(1)} ${pts[n][1].toFixed(1)}`).join("L")}Z`;
  const line = (a, b) => `M${pts[a][0].toFixed(1)} ${pts[a][1].toFixed(1)}L${pts[b][0].toFixed(1)} ${pts[b][1].toFixed(1)}`;
  const outline = path(["T", "UR", "LR", "B", "LL", "UL"]);
  const coils = [];
  const amount = 1 - state.inject;
  if (amount > 0.02) {
    for (let i = 0; i < 7; i++) {
      const z = g.headBottom + 20 + i * 12.5;
      const r = PHAGE.headR * 0.78 * Math.sin(Math.PI * (0.18 + (0.64 * (i + 0.5)) / 7));
      const ring = Array.from({ length: 25 }, (_, j) => B.iso(around(r, (j / 24) * 360, z), P));
      coils.push(B.smoothPath(ring, true));
    }
  }
  return {
    d: B.depthOf([0, 0, g.headMid], P),
    svg:
      `<clipPath id="t4-head-clip"><path d="${outline}"/></clipPath>` +
      `<path class="bio-body" data-swatch="capsid" d="${outline}" fill="url(#bio-l-capsid)"/>` +
      (coils.length ? `<g clip-path="url(#t4-head-clip)" opacity="${(0.7 * amount).toFixed(3)}"><path d="${coils.join("")}" fill="none" stroke="var(--bio-dna-lo)" stroke-width="1.6"/></g>` : "") +
      `<path d="${line("UL", "C1")}${line("C1", "UR")}${line("LL", "C2")}${line("C2", "LR")}${line("C1", "C2")}${line("T", "C1")}${line("B", "C2")}" fill="none" stroke="var(--bio-capsid-edge)" stroke-width=".8" opacity=".55"/>` +
      `<path d="${outline}" fill="none" stroke="var(--bio-capsid-edge)" stroke-width=".9" stroke-linejoin="round"/>`,
  };
}

function sheathSvg(P, B, g) {
  const r = g.sheathR;
  const body = B.capsule(P, [0, 0, g.plateTop + r * 0.35], r, g.sheathL - r * 0.7, "sheath");
  const { cosA, sinA } = B.cameraOf(P);
  const view = Math.atan2(sinA, cosA) / TO_RAD;
  const rings = [];
  const count = 15;
  for (let i = 1; i < count; i++) {
    const z = g.plateTop + (g.sheathL * i) / count;
    const arc = Array.from({ length: 13 }, (_, j) => B.iso(around(r, view - 90 + (j / 12) * 180, z), P));
    rings.push(B.smoothPath(arc));
  }
  return { d: B.depthOf([0, 0, g.plateTop + g.sheathL / 2], P), svg: body + `<path d="${rings.join("")}" fill="none" stroke="var(--bio-sheath-edge)" stroke-width=".7" opacity=".55"/>` };
}

export function phageSvg(state, P, B, path) {
  const g = geometryOf(state);
  const items = [];
  const depth = (p) => B.depthOf(p, P);
  items.push({ d: depth([0, 0, g.tubeBottom]) - 2, svg: B.capsule(P, [0, 0, g.tubeBottom + PHAGE.tubeR], PHAGE.tubeR, PHAGE.tubeL - PHAGE.tubeR * 2, "rod") });
  if (state.inject > 0 && state.inject < 0.999) items.push({ d: depth([0, 0, g.tubeBottom]) - 1.9, svg: `<g opacity="${(0.9 * Math.min(1, state.inject * 8, (1 - state.inject) * 8)).toFixed(3)}">${B.rope(P, [[0, 0, g.sheathTop], [0, 0, g.tubeBottom + 2]], 1.1, "dna")}</g>` });
  items.push(sheathSvg(P, B, g));
  items.push({ d: depth([0, 0, g.sheathTop + 2]) + 1, svg: B.ellipsoid(P, [0, 0, g.sheathTop + PHAGE.collar / 2], 19, 3.2, "capsid") });
  items.push(headSvg(P, B, g, state));
  items.push({ d: depth([0, 0, g.plateTop + g.sheathL / 2]) + 0.5, svg: B.ellipsoid(P, [0, 0, g.off + PHAGE.plateH / 2], PHAGE.plateR, PHAGE.plateH / 2, "hub") });
  const anchors = {};
  for (const angle of FIBRE_ANGLES) {
    const base = around(PHAGE.plateR * 0.9, angle, g.off + PHAGE.plateH * 0.6);
    const knee = mix3(around(17, angle, g.off + 80), around(70, angle, g.off + 58), state.unfold);
    const tip = mix3(around(20, angle, g.off + 24), around(110, angle, 0.8), state.unfold);
    items.push({ d: depth(mix3(base, knee, 0.5)), svg: B.rope(P, [base, knee], 1.5, "fibre") });
    items.push({ d: depth(mix3(knee, tip, 0.5)), svg: B.rope(P, [knee, tip], 1.3, "fibre") });
    items.push({ d: depth(knee) + 0.1, svg: B.sphere(P, knee, 2.1, "fibre") });
    anchors[`knee${angle}`] = knee;
    if (state.short > 0.01) {
      const from = around(13, angle + 30, g.off + 1);
      const to = mix3(around(15, angle + 30, g.off - 0.5), around(30, angle + 30, 0.6), state.short);
      items.push({ d: depth(to) + 0.5, svg: `<g opacity="${state.short.toFixed(3)}">${B.rope(P, [from, to], 1.1, "fibre")}</g>` });
    }
  }
  const injected = Math.floor(state.inject * (path.length - 1));
  if (injected > 0) {
    const shown = path.slice(0, injected + 1);
    const tail = state.inject * (path.length - 1) - injected;
    if (injected + 1 < path.length) shown.push(mix3(path[injected], path[injected + 1], tail));
    items.push({ d: depth([0, 0, -50]) + 40, svg: B.rope(P, [[0, 0, g.tubeBottom + 2], ...shown], 1.5, "dna") });
  }
  const left = VIEW_DEG + 90;
  anchors.head = around(PHAGE.headR * 0.97, left, g.headMid);
  anchors.sheath = around(g.sheathR * 0.97, left, g.plateTop + g.sheathL * 0.5);
  anchors.plate = around(PHAGE.plateR * 0.95, left, g.off + PHAGE.plateH / 2);
  anchors.tube = g.tubeBottom < -20 ? around(PHAGE.tubeR * 0.9, left, -19) : null;
  anchors.dna = injected > 20 ? path[18] : null;
  return { svg: items.sort((a, b) => a.d - b.d).map((item) => item.svg).join(""), anchors, g };
}

export function labelsSvg(frame, P, B, { L, R }) {
  const at = (p) => B.iso(p, P);
  const a = frame.anchors;
  const out = [
    B.label("Head (capsid)", at(a.head), { side: "left", x: L }),
    B.label("Tail sheath", at(a.sheath), { side: "left", x: L }),
    B.label("Baseplate", at(a.plate), { side: "left", x: L }),
    B.label("Long tail fibre", at(a.knee330), { side: "right", x: R }),
  ];
  if (a.tube) out.push(B.label("Tail tube", at(a.tube), { side: "left", x: L }));
  if (a.dna) out.push(B.label("Phage DNA", at(a.dna), { side: "left", x: L }));
  return out.join("");
}
