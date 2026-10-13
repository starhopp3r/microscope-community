export const VIEW_DEG = 72;
export const VIEW_ELEVATION = 16;
export const AXIS = [0, 62];
export const MEMBRANE = { x0: -150, x1: 150, y0: -36, y1: 36, z0: -22, z1: 22 };
export const RING = { n: 8, R: 20, r: 7, z0: -20, len: 40 };
export const SITE_R = RING.R + RING.r - 1.4;
export const A_DEG = 0;
export const ASUB = { at: [AXIS[0] + 39, AXIS[1], 2], across: 12, tall: 32 };
export const HUB = { z: -32, across: 13, tall: 7 };
export const ROD = { z0: -110, len: 74, r: 5.5 };
export const KNOB = { R: 25, across: 20, tall: 33, z: -112 };
export const LOBES = Array.from({ length: 6 }, (_, index) => ({ angle: 42 + index * 60, kind: index % 2 ? "alpha" : "beta" }));
export const OSCP = { z: -150, across: 15, tall: 8 };
export const STALK = [[AXIS[0] + 39, AXIS[1], -26], [AXIS[0] + 50, AXIS[1], -58], [AXIS[0] + 54, AXIS[1], -110], [AXIS[0] + 42, AXIS[1], -146], [AXIS[0] + 14, AXIS[1], -152]];
export const STALK_R = 4;
export const ENTRY = [[AXIS[0] + 47, AXIS[1] + 8, 78], [AXIS[0] + 43, AXIS[1] + 7, 38]];
export const EXIT = [[AXIS[0] + 27, AXIS[1] + 16, -27], [AXIS[0] + 25, AXIS[1] + 23, -32], [AXIS[0] + 22, AXIS[1] + 31, -37]];
export const PROTON_R = 4.2;
export const SPIN = { z: -66, r: 24 };

const TO_RAD = Math.PI / 180;
export const wrapDeg = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
export const polar = (r, deg, z = 0) => [AXIS[0] + r * Math.cos(deg * TO_RAD), AXIS[1] + r * Math.sin(deg * TO_RAD), z];

export function protonated(phi) {
  const rel = wrapDeg(phi - A_DEG);
  const half = 180 / RING.n;
  return rel <= -half || rel >= half;
}

const fade = (svg, alpha) => (alpha < 0.999 ? `<g opacity="${Math.max(0, alpha).toFixed(3)}">${svg}</g>` : svg);

export function protonGlyph(P, B, centre, alpha = 1) {
  const [x, y] = B.iso(centre, P);
  return fade(`${B.sphere(P, centre, PROTON_R, "proton")}<text class="bio-glyph" x="${x.toFixed(1)}" y="${(y + 0.3).toFixed(1)}">H⁺</text>`, alpha);
}

export function atpGlyph(P, B, centre, alpha = 1) {
  const [x, y] = B.iso(centre, P);
  return fade(`${B.ellipsoid(P, centre, 8.5, 5, "atp")}<text class="bio-glyph" x="${x.toFixed(1)}" y="${(y + 0.3).toFixed(1)}">ATP</text>`, alpha);
}

export function proteinSvg(theta, P, B, extras = []) {
  const parts = [...extras];
  const depth = (point) => B.depthOf(point, P);
  for (let index = 0; index < RING.n; index++) {
    const phi = theta + (index * 360) / RING.n;
    const base = polar(RING.R, phi, RING.z0);
    parts.push({ d: depth(polar(RING.R, phi, 0)), svg: B.capsule(P, base, RING.r, RING.len, "rotor") });
    if (protonated(phi)) {
      const site = polar(SITE_R, phi, 0);
      parts.push({ d: depth(site) + 0.6, svg: protonGlyph(P, B, site) });
    }
  }
  parts.push({ d: depth(ASUB.at), svg: B.ellipsoid(P, ASUB.at, ASUB.across, ASUB.tall, "stator") });
  parts.push({ d: depth(polar(0, 0, HUB.z)) + 3, svg: B.ellipsoid(P, polar(0, 0, HUB.z), HUB.across, HUB.tall, "hub") });
  parts.push({ d: depth(polar(0, 0, -80)), svg: B.capsule(P, polar(0, 0, ROD.z0), ROD.r, ROD.len, "rod") });
  for (const lobe of LOBES) {
    const centre = polar(KNOB.R, lobe.angle, KNOB.z);
    parts.push({ d: depth(centre), svg: B.ellipsoid(P, centre, KNOB.across, KNOB.tall, lobe.kind) });
  }
  parts.push({ d: depth(polar(0, 0, OSCP.z)), svg: B.ellipsoid(P, polar(0, 0, OSCP.z), OSCP.across, OSCP.tall, "stator") });
  parts.push({ d: depth(polar(0, 0, -100)) + 0.5, svg: B.rope(P, STALK, STALK_R, "stator") });
  return parts.sort((a, b) => a.d - b.d).map((part) => part.svg).join("");
}
