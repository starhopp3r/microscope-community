export const LEAF = { x0: -185, x1: 185, top: 232, bottom: 8 };
export const STOMA_X = -70;
export const VEIN = { x: 70, z: 88 };
export const GUARD = { across: 21, tall: 21, z: 20 };

export function guardSvg(open, P, B, maxAperture) {
  const aperture = open * maxAperture;
  const across = GUARD.across * (1 + 0.16 * open);
  const tall = GUARD.tall * (1 + 0.06 * open);
  const gap = Math.max(0.2, aperture);
  const centres = [-1, 1].map((side) => [STOMA_X + side * (across + gap) / 2, 0, GUARD.z]);
  const k = B.screenScale(P);
  const out = [];
  const [px, py] = B.iso([STOMA_X, 0, GUARD.z], P);
  const pw = (gap * k) / 2;
  const ph = GUARD.tall * k * 0.42;
  const pore = `<path class="bio-pore" d="M${(px - pw).toFixed(1)} ${(py - ph).toFixed(1)}L${(px + pw).toFixed(1)} ${(py - ph).toFixed(1)}L${(px + pw).toFixed(1)} ${(py + ph).toFixed(1)}L${(px - pw).toFixed(1)} ${(py + ph).toFixed(1)}Z" fill="var(--bio-air)"/>`;
  out.push(pore);
  centres.forEach((c, index) => {
    out.push(B.ellipsoid(P, c, across / 2, tall / 2, "guard"));
    const [cx, cy] = B.iso(c, P);
    const rx = (across / 2) * k;
    const ry = (tall / 2) * k * 0.99;
    const side = index ? -1 : 1;
    const wall = Array.from({ length: 13 }, (_, j) => {
      const a = (-65 + (j / 12) * 130) * (Math.PI / 180);
      return [cx + side * rx * Math.cos(a) * 0.96, cy + ry * Math.sin(a) * 0.96];
    });
    out.push(`<path d="${B.smoothPath(wall)}" fill="none" stroke="var(--bio-guard-edge)" stroke-width="${(2.4 * k * 0.6).toFixed(1)}" stroke-linecap="round" opacity=".85"/>`);
    for (const [dx, dz] of [[-0.18, 0.2], [0.05, -0.22], [-0.05, 0.02]]) out.push(B.ellipsoid(P, [c[0] + dx * across - side * 0.8, 0, c[2] + dz * tall], 1.5, 2.2, "chlorophyll"));
  });
  return { svg: out.join(""), left: centres[0], across, tall, aperture };
}

export function stomaLayer(open, P, B, { L, MAX }) {
  const g = guardSvg(open, P, B, MAX);
  const at = (p) => B.iso(p, P);
  const offset = Math.max(1.1, g.aperture / 4);
  const fade = (svg, alpha) => `<g opacity="${alpha.toFixed(3)}">${svg}</g>`;
  const show = Math.max(0, Math.min(1, (open - 0.15) / 0.35));
  const inward = B.arrow([at([STOMA_X - offset, 0, -30]), at([STOMA_X - offset, 0, 50])], { size: 6 });
  const outward = B.arrow([at([STOMA_X + offset, 0, 50]), at([STOMA_X + offset, 0, -30])], { size: 6, tone: "dna" });
  const [cx, cy] = at([STOMA_X, 0, -38]);
  const words = `<text class="bio-label" data-small x="${(cx - 6).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="end">CO₂</text><text class="bio-label" data-small x="${(cx + 6).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="start">H₂O, O₂</text>`;
  const left = g.left;
  const guardAnchor = at([left[0] - (g.across / 2) * 0.96, 0, GUARD.z]);
  const stomaAnchor = at([left[0] + (g.across / 2) * 0.5, 0, GUARD.z - (g.tall / 2) * 0.8]);
  const labels =
    B.label("Guard cells", guardAnchor, { side: "left", x: L, drop: at([0, 0, 40])[1] - guardAnchor[1] }) +
    B.label("Stoma", stomaAnchor, { side: "left", x: L, drop: at([0, 0, -14])[1] - stomaAnchor[1] });
  return g.svg + (show > 0.01 ? fade(inward + outward, show) : "") + fade(words, Math.max(0.35, show)) + labels;
}
