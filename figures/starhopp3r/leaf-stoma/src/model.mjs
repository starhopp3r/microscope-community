export const SPECIES = "Vicia faba";
export const MAX_APERTURE_UM = 10;
export const CYCLE_S = 9;
export const PHASES = [
  { name: "Opening", from: 0, to: 2.6 },
  { name: "Open", from: 2.6, to: 4.5 },
  { name: "Closing", from: 4.5, to: 7.1 },
  { name: "Closed", from: 7.1, to: 9 },
];

export const SOURCES = [
  { value: "eudicot leaf layers: cuticle, epidermis, palisade and spongy mesophyll, veins with xylem above phloem in a bundle sheath", source: "Evert 2006, Esau's Plant Anatomy, 3rd ed." },
  { value: "stomata open as guard cells take up K⁺ and water and swell", source: "Humble & Raschke 1971, Plant Physiol 48:447" },
  { value: "stomata close as guard cells lose K⁺ and water", source: "Kim et al. 2010, Annu Rev Plant Biol 61:561" },
  { value: "Vicia faba apertures about 8–16 µm when open", source: "Jezek & Blatt 2017, Plant Physiol 174:487" },
  { value: "broad bean has stomata on both leaf surfaces, slightly more on the lower", source: "Pekşen et al. 2006, J Biol Sci 6:360" },
  { value: "kidney-shaped guard cells bow apart as they swell, shaped by radially arranged cellulose microfibrils and stiff guard-cell ends", source: "Evert 2006, Esau's Plant Anatomy, 3rd ed.; Carter et al. 2017, Curr Biol 27:2974" },
];

const ease = (t) => t * t * (3 - 2 * t);

export function openAt(time) {
  const t = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  if (t < 2.6) return ease(t / 2.6);
  if (t < 4.5) return 1;
  if (t < 7.1) return 1 - ease((t - 4.5) / 2.6);
  return 0;
}

export function readoutOf(time) {
  const t = ((time % CYCLE_S) + CYCLE_S) % CYCLE_S;
  const phase = PHASES.find((p) => t >= p.from && t < p.to) ?? PHASES[0];
  return `${phase.name} · pore ${(openAt(time) * MAX_APERTURE_UM).toFixed(1)} µm wide`;
}
