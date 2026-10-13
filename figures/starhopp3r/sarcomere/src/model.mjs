export const THICK_UM = 1.6;
export const THIN_UM = 1.0;
export const BARE_UM = 0.16;
export const THIN_SPAN_UM = 2.05;
export const SL_RELAXED = 2.5;
export const SL_CONTRACTED = 2.05;
export const CYCLE_S = 8;
export const PHASES = [
  { name: "Relaxed", from: 0, to: 1.2 },
  { name: "Contracting", from: 1.2, to: 3.8 },
  { name: "Contracted", from: 3.8, to: 5.2 },
  { name: "Relaxing", from: 5.2, to: 8 },
];

export const SOURCES = [
  { value: "the filaments slide past each other: the A band keeps its length while the I band and H zone shorten", source: "Huxley & Niedergerke 1954, Nature 173:971; Huxley & Hanson 1954, Nature 173:973" },
  { value: "frog skeletal muscle: thick filaments about 1.6 µm, thin filaments 2.05 µm across the Z disc (about 1.0 µm each side), bare zone about 0.16 µm; tension plateaus at 2.05–2.2 µm", source: "Gordon, Huxley & Julian 1966, J Physiol 184:170" },
];

const ease = (t) => t * t * (3 - 2 * t);

export function contractionAt(time) {
  const t = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  if (t < 1.2) return 0;
  if (t < 3.8) return ease((t - 1.2) / 2.6);
  if (t < 5.2) return 1;
  return 1 - ease((t - 5.2) / 2.8);
}

export function bandsAt(time) {
  const sl = SL_RELAXED + (SL_CONTRACTED - SL_RELAXED) * contractionAt(time);
  return { sl, a: THICK_UM, i: sl - THICK_UM, h: Math.max(0, sl - THIN_SPAN_UM) };
}

export function readoutOf(time) {
  const t = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  const phase = PHASES.find((p) => t >= p.from && t < p.to) ?? PHASES[0];
  const b = bandsAt(time);
  return `${phase.name} · sarcomere ${b.sl.toFixed(2)} µm · A band ${b.a.toFixed(2)} µm · I band ${b.i.toFixed(2)} µm · H zone ${b.h.toFixed(2)} µm`;
}
