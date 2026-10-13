export const GENOME_KBP = 169;
export const HEAD_NM = { length: 120, width: 86 };
export const SHEATH_NM = { extended: { length: 92.5, diameter: 24 }, contracted: { length: 42, diameter: 33 } };
export const TUBE_NM = { diameter: 9, length: 95 };
export const FIBRES = 6;
export const CYCLE_S = 12;
export const STAGES = [
  { name: "Attachment", at: 0 },
  { name: "Tail contraction", at: 3.2 },
  { name: "DNA injection", at: 4.4 },
  { name: "Genome injected", at: 9.4 },
];

export const SOURCES = [
  { value: "head about 120 by 86 nm, an elongated icosahedron", source: "Fokine et al. 2004, PNAS 101:6003" },
  { value: "sheath contracts from about 92.5 to 42 nm long and widens from 24 to 33 nm; the tail tube is about 9 nm across", source: "Leiman et al. 2004, Cell 118:419" },
  { value: "six long tail fibres bind the outer membrane, then the baseplate and short tail fibres bind and the sheath contracts", source: "Leiman et al. 2010, Virol J 7:355" },
  { value: "genome about 169 kbp of double-stranded DNA", source: "Miller et al. 2003, Microbiol Mol Biol Rev 67:86" },
  { value: "the tail tube crosses the outer membrane and periplasm and stops at the outer face of the inner membrane", source: "Hu et al. 2015, PNAS 112:E4919" },
  { value: "E. coli envelope: outer membrane about 7 nm, peptidoglycan about 6 nm, inner membrane about 6 nm, about 21 nm between the membranes", source: "Matias et al. 2003, J Bacteriol 185:6112" },
];

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (t) => t * t * (3 - 2 * t);

export function stateAt(time) {
  const t = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  return {
    t,
    offset: 46 * (1 - ease(clamp(t / 2.6))),
    unfold: ease(clamp((t - 0.6) / 2.0)),
    short: ease(clamp((t - 2.6) / 0.6)),
    contract: ease(clamp((t - 3.2) / 1.2)),
    inject: ease(clamp((t - 4.4) / 5.0)),
    alpha: t > 11.2 ? 1 - (t - 11.2) / 0.8 : t < 0.4 ? t / 0.4 : 1,
  };
}

export function stageOf(t) {
  return [...STAGES].reverse().find((stage) => t >= stage.at) ?? STAGES[0];
}

export function readoutOf(time) {
  const state = stateAt(time);
  return `${stageOf(state.t).name} · ${Math.round(state.inject * GENOME_KBP)} of ${GENOME_KBP} kbp of DNA injected`;
}

export function dnaPath(seed = 11, steps = 70) {
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const points = [[0, 0, -36]];
  let heading = -Math.PI / 2;
  for (let i = 1; i < steps; i++) {
    const [x, , z] = points[i - 1];
    heading += (rand() - 0.5) * 1.5;
    if (z < -66) heading = Math.abs(heading) * 0.6 + 0.4;
    if (z > -42 && i > 3) heading = -Math.abs(heading) - 0.4;
    if (Math.abs(x) > 105) heading = Math.PI - heading;
    points.push([x + Math.cos(heading) * 7, 6 + 10 * Math.sin(i * 0.7), Math.max(-70, Math.min(-40, z + Math.sin(heading) * 7))]);
  }
  return points;
}
