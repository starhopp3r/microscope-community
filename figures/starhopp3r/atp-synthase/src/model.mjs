export const SPECIES = "Bos taurus";
export const C_SUBUNITS = 8;
export const ATP_PER_TURN = 3;
export const STEP_DEG = 360 / C_SUBUNITS;
export const ATP_DEG = 360 / ATP_PER_TURN;
export const H_PER_ATP = C_SUBUNITS / ATP_PER_TURN;
export const REV_PER_S = 100;
export const DWELL_S = 0.58;
export const STEP_S = 0.36;
export const SLOWER = Math.round(((DWELL_S + STEP_S) * REV_PER_S * C_SUBUNITS) / 10) * 10;
export const NM = 6;

export const SOURCES = [
  { value: "c-ring of 8 c subunits; 8 H+ and 3 ATP per turn; about 2.7 H+ per ATP; about 100 turns per second", source: "Watt et al. 2010, PNAS 107:16823" },
  { value: "F1 head α3β3 about 11 nm across, facing the matrix; three domains per α and β", source: "Abrahams et al. 1994, Nature 370:621" },
  { value: "γ turns in 120° steps, one ATP per step", source: "Yasuda et al. 1998, Cell 93:1117" },
  { value: "peripheral stalk of one b subunit with d, F6 and OSCP", source: "Rees et al. 2009, PNAS 106:21597" },
  { value: "protons enter from the intermembrane space through one a-subunit half-channel and leave into the matrix through the other", source: "Kühlbrandt 2019, Annu Rev Biochem 88:515" },
  { value: "synthesis turns the rotor opposite to hydrolysis: anticlockwise seen from F1", source: "Noji et al. 1997, Nature 386:299; Diez et al. 2004, Nat Struct Mol Biol 11:135" },
];

export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dwellOf = (rand, scale = 1) => Math.min(2.2, Math.max(0.22, -Math.log(1 - rand()) * DWELL_S * scale));

export const atpOf = (turned) => Math.floor(turned / ATP_DEG + 1e-6);

export const protonsOf = (turned) => Math.floor(turned / STEP_DEG + 0.5 + 1e-6);

export function readoutOf(turned) {
  return `${protonsOf(turned)} H⁺ · ${Math.round(turned)}° · ${atpOf(turned)} ATP · ${SLOWER}× slower`;
}
