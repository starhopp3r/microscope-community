import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as bio from "../../../../.skill/kit/bio.mjs";
import { kitScript, bioScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { PAIRS, RISE_NM, BP_PER_TURN, DIAMETER_NM, PITCH_NM, SEQUENCE, SOURCES, readoutOf } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 800;
const H = 270;
const SIDE = 160;
const NM = 10;
const RADIUS = (DIAMETER_NM / 2) * NM;
const RISE = RISE_NM * NM;
const LENGTH = PAIRS * RISE;
const START = [-LENGTH / 2, 0, 0];
const END = [LENGTH / 2, 0, 0];
const AZIMUTH = 90;
const ELEVATION = 12;

const fitted = k.fitProjection(
  [[START[0], 0, RADIUS], [END[0], 0, -RADIUS], [START[0], RADIUS, 0], [END[0], -RADIUS, 0]],
  W - SIDE * 2,
  H - 100,
  { pad: 0, azimuth: AZIMUTH, elevation: ELEVATION },
);
const P = { ...fitted, origin: [fitted.origin[0] + SIDE, fitted.origin[1] + 36] };
const at = (point) => k.iso(point, P);
const OPTIONS = { radius: RADIUS, rise: RISE, perTurn: BP_PER_TURN, groove: 140, sequence: SEQUENCE, r: 1.45, baseR: 1.15, phase: 270 };
const helix = bio.doubleHelix(P, START, END, OPTIONS);

const view = [0, Math.cos((ELEVATION * Math.PI) / 180), Math.sin((ELEVATION * Math.PI) / 180)];
const facing = (along, which) => {
  const point = helix.point(along, which);
  return point[1] * view[1] + point[2] * view[2];
};
const best = (from, to, score) => {
  let pick = from;
  for (let s = from; s <= to; s += 0.05) if (score(s) > score(pick)) pick = s;
  return pick;
};
const pairAt = (along) => helix.pairs[Math.max(0, Math.min(PAIRS - 1, Math.round(along / RISE - 0.5)))];
const openness = (along) => -(facing(along, 0) + facing(along, 1)) / RADIUS;
const spread = (along) => Math.abs(facing(along, 0) - facing(along, 1)) / RADIUS;
const majorAt = best(RISE, LENGTH * 0.3, (s) => openness(s) + spread(s));
const minorAt = best(LENGTH * 0.6, LENGTH - RISE, (s) => openness(s) - spread(s));
const backboneAt = best(LENGTH * 0.34, LENGTH * 0.5, (s) => facing(s, 0));
const pairIndex = Math.round(best(LENGTH * 0.12, LENGTH * 0.38, (s) => openness(s) - Math.abs(s - majorAt) * -0.05) / RISE - 0.5);

const L = SIDE - 30;
const R = W - SIDE + 62;
const top = at([0, 0, RADIUS])[1];
const bottom = at([0, 0, -RADIUS])[1];
const anchors = {
  major: at(pairAt(majorAt).mid),
  pair: (() => {
    const chosen = helix.pairs[Math.min(PAIRS - 1, pairIndex + 3)];
    const [e0, e1] = chosen.ends.map(at);
    const low = e0[1] > e1[1] ? e0 : e1;
    const mid = at(chosen.mid);
    return [mid[0] + (low[0] - mid[0]) * 0.6, mid[1] + (low[1] - mid[1]) * 0.6];
  })(),
  backbone: at(helix.point(backboneAt, 0)),
  minor: at(pairAt(minorAt).mid),
};
const labels = [
  bio.label("Major groove", anchors.major, { side: "left", x: L }),
  bio.label("Base pair", anchors.pair, { side: "left", x: L, drop: bottom + 22 - anchors.pair[1] }),
  bio.label("Sugar–phosphate\nbackbone", anchors.backbone, { side: "left", x: L, drop: top - 30 - anchors.backbone[1] }),
  bio.label("Minor groove", anchors.minor, { side: "right", x: R, drop: bottom + 22 - anchors.minor[1] }),
];

const end = (along, which) => at(helix.point(along, which));
const ends = [
  [end(0, 0), "5′", "end"],
  [end(0, 1), "3′", "end"],
  [end(LENGTH, 0), "3′", "start"],
  [end(LENGTH, 1), "5′", "start"],
].map(([p, text, anchor]) => `<text class="bio-label" font-weight="700" x="${(p[0] + (anchor === "end" ? -9 : 9)).toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="${anchor}">${text}</text>`);

const turnTo = at([END[0] - RISE * 0.5, 0, 0])[0];
const turnFrom = at([END[0] - RISE * 0.5 - BP_PER_TURN * RISE, 0, 0])[0];
const riseFrom = at([0, 0, 0])[0];
const riseTo = at([RISE, 0, 0])[0];
const rightEnd = at(END)[0];
const dims = [
  bio.dimension([turnFrom, top - 10], [turnTo, top - 10], `One turn: ${PITCH_NM.toFixed(1)} nm, ${BP_PER_TURN} base pairs`, { offset: 0 }),
  bio.dimension([rightEnd + 40, top], [rightEnd + 40, bottom], `${DIAMETER_NM.toFixed(0)} nm`, { offset: 0, gap: 6 }),
  bio.dimension([riseTo, bottom + 12], [riseFrom, bottom + 12], `${RISE_NM} nm per base pair`, { offset: 0, gap: 4 }),
];
const KEY = [["baseA", "Adenine (A)"], ["baseT", "Thymine (T)"], ["baseG", "Guanine (G)"], ["baseC", "Cytosine (C)"]];
const keyRow = bio.key(KEY, 190, H - 16);

const svg = bio.bioSvg({
  width: W,
  height: H,
  label:
    "A textbook-style drawing of a B-DNA double helix lying across the page: two blue sugar-phosphate backbones wind round each other in a right-handed helix, joined by base pairs coloured by base, adenine with thymine and guanine with cytosine. The strands run antiparallel, 5 prime to 3 prime in opposite directions. Labels mark the major and minor grooves, a backbone and a base pair; brackets give one turn of 3.5 nanometres and 10.4 base pairs, the 2 nanometre width and the 0.34 nanometre rise per base pair; a key names the four bases.",
  body: [`<g data-live="helix">${bio.sortedSvg(helix)}</g>`, ...ends, ...dims, ...labels, keyRow],
});

const caption = `B-DNA, the main form of DNA in cells. Two sugar–phosphate backbones wind round a common axis in a right-handed double helix and run antiparallel, one 5′→3′ and the other 3′→5′. Bases pair across the helix, adenine with thymine by two hydrogen bonds and guanine with cytosine by three (shown on the highlighted pair). Each pair rises ${RISE_NM} nm along the axis, the helix is about ${DIAMETER_NM} nm across and makes one turn every ${BP_PER_TURN} base pairs (${PITCH_NM.toFixed(1)} nm), and the uneven spacing of the backbones leaves a major and a minor groove. The sequence shown is an example. Sources: ${[...new Set(SOURCES.map((entry) => entry.source))].join("; ")}.`;

const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const DATA = { P, START, END, OPTIONS, PAIRS, left: at(START)[0], right: at(END)[0] };
const live = `const DATA = ${JSON.stringify(DATA)};\n${strip("model.mjs")}\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = bio.figurePage({
  fig: "Figure 2",
  title: "The DNA double helix",
  svg,
  aria: "DNA double helix: hover along the helix or use the arrow keys to inspect each base pair",
  readout: readoutOf(0),
  hint: "Hover along the helix · ← → step through the pairs",
  caption,
  theme,
  script: kitScript() + bioScript() + live,
});
const file = theme === "light" ? "dna-double-helix-light.html" : "dna-double-helix.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file);
