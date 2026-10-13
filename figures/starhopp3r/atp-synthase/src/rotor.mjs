export const VIEW_DEG = 40;
export const RING = { n: 8, rc: 12, rs: 4.4, z0: 36, z1: 74 };
export const RING_R = RING.rc + RING.rs;
export const FOOT = { r: 10, z: RING.z1, h: 4 };
export const SHAFT = { r: 4, z: FOOT.z + FOOT.h, top: 132 };
export const DE = { r: 3.6, off: SHAFT.r + 3.6, z: FOOT.z + FOOT.h, h: 12, at: 20 };
export const SITE = { z: 55, r: RING_R - 0.6 };
export const ASUB = { angle: 130, span: 34, r0: RING_R, r1: RING_R + 13, z0: 34, z1: 76 };
export const OUTLET = { angle: ASUB.angle + 28, r: (ASUB.r0 + ASUB.r1) / 2, z: ASUB.z1 };
export const INLET = { angle: ASUB.angle - ASUB.span, r: (ASUB.r0 + ASUB.r1) / 2, z: 38.5 };
export const HOLE_R = 1.7;

const RAD = Math.PI / 180;
export const wrapDeg = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
export const polar = (r, deg, z = 0) => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD), z];

export function protonated(phi) {
  const rel = wrapDeg(phi - ASUB.angle);
  const half = 180 / RING.n;
  return rel <= -half || rel >= half;
}

export function backSlot(phi) {
  const rel = wrapDeg(phi - ASUB.angle);
  return Math.cos((phi - VIEW_DEG) * RAD) < 0 || (rel >= -ASUB.span && rel <= ASUB.span);
}

export function rotorSvg(theta, P, K, sprite) {
  const back = [];
  const front = [];
  const depth = (point) => K.depthOf(point, P);
  for (let index = 0; index < RING.n; index++) {
    const phi = theta + (index * 360) / RING.n;
    const [x, y] = polar(RING.rc, phi);
    const slot = backSlot(phi) ? back : front;
    slot.push({ d: depth([x, y, SITE.z]), svg: K.solidSvg(K.cylinder(x, y, RING.rs, RING.z0, RING.z1 - RING.z0, P, 28), { tone: "hi", lit: true }) });
    if (protonated(phi)) {
      const site = polar(SITE.r, phi, SITE.z);
      slot.push({ d: depth(site) + 0.05, svg: sprite(site) });
    }
  }
  const order = (list) => list.sort((a, b) => a.d - b.d).map((entry) => entry.svg).join("");
  const [ex, ey] = polar(DE.off, theta + DE.at);
  const top = [
    { d: depth([0, 0, DE.z]), svg: K.solidSvg(K.cylinder(0, 0, SHAFT.r, SHAFT.z, SHAFT.top - SHAFT.z, P, 24), { tone: "hi", lit: true }) },
    { d: depth([ex, ey, DE.z]), svg: K.solidSvg(K.cylinder(ex, ey, DE.r, DE.z, DE.h, P, 24), { tone: "hi", lit: true }) },
  ];
  return {
    back: order(back),
    front: order(front) + K.solidSvg(K.cylinder(0, 0, FOOT.r, FOOT.z, FOOT.h, P, 40), { tone: "hi", lit: true }) + order(top),
  };
}
