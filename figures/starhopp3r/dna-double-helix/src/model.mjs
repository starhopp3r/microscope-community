export const PAIRS = 31;
export const RISE_NM = 0.34;
export const BP_PER_TURN = 10.4;
export const DIAMETER_NM = 2.0;
export const PITCH_NM = RISE_NM * BP_PER_TURN;
export const SEQUENCE = "ATGGCCTTAACGCGATATCCGGTACAGTCAT";
export const PARTNER = { A: "T", T: "A", G: "C", C: "G" };
export const BONDS = { A: 2, T: 2, G: 3, C: 3 };
export const STEP_S = 0.9;

export const SOURCES = [
  { value: "antiparallel right-handed double helix; A pairs with T, G with C", source: "Watson & Crick 1953, Nature 171:737" },
  { value: "B-form diffraction: 0.34 nm per base pair, about 2 nm across", source: "Franklin & Gosling 1953, Nature 171:740" },
  { value: "about 10.4 bp per turn in solution", source: "Wang 1979, PNAS 76:200" },
  { value: "A–T pairs have two hydrogen bonds and G–C pairs three", source: "Pauling & Corey 1956, Arch Biochem Biophys 65:164" },
];

export function readoutOf(index) {
  const base = SEQUENCE[index];
  const partner = PARTNER[base];
  const from5 = ((index + 0.5) * RISE_NM).toFixed(2);
  return `Pair ${index + 1} of ${PAIRS} · ${base}–${partner} · ${BONDS[base]} hydrogen bonds · ${from5} nm from the 5′ end`;
}
