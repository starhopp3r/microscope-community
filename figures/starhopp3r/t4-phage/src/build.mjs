import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as bio from "../../../../.skill/kit/bio.mjs";
import { kitScript, bioScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { GENOME_KBP, HEAD_NM, SHEATH_NM, TUBE_NM, FIBRES, SOURCES, stateAt, readoutOf, dnaPath } from "./model.mjs";
import { VIEW_DEG, VIEW_ELEVATION, ENVELOPE, phageSvg, labelsSvg } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 760;
const H = 540;
const SIDE = 150;
const E = ENVELOPE;

const fitted = k.fitProjection(
  [[E.x0, E.y1, E.bottom], [E.x1, E.y1, E.bottom], [E.x0, E.y0, 0], [E.x1, E.y0, 0], [0, 0, 272]],
  W - SIDE * 2,
  H - 40,
  { pad: 0, azimuth: VIEW_DEG, elevation: VIEW_ELEVATION },
);
const P = { ...fitted, origin: [fitted.origin[0] + SIDE, fitted.origin[1] + 22] };
const B = { ...bio, iso: k.iso, depthOf: k.depthOf, cameraOf: k.cameraOf };
const at = (point) => k.iso(point, P);
const PATH = dnaPath();

const y = (z) => at([0, E.y1, z])[1];
const tints = `<rect x="0" y="0" width="${W}" height="${y(-3.5).toFixed(1)}" fill="var(--bio-outside)"/><rect x="0" y="${y(-3.5).toFixed(1)}" width="${W}" height="${(y(-31) - y(-3.5)).toFixed(1)}" fill="var(--bio-periplasm)"/><rect x="0" y="${y(-31).toFixed(1)}" width="${W}" height="${(H - y(-31)).toFixed(1)}" fill="var(--bio-cytoplasm)"/>`;

function wall() {
  const [z0, z1] = E.pg;
  const quad = (pts, fill) => `<path class="bio-body" data-swatch="peptidoglycan" d="M${pts.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L")}Z" fill="${fill}"/>`;
  const topFace = quad([[E.x0, E.y0, z1], [E.x1, E.y0, z1], [E.x1, E.y1, z1], [E.x0, E.y1, z1]], "var(--bio-peptidoglycan-hi)");
  const front = quad([[E.x0, E.y1, z1], [E.x1, E.y1, z1], [E.x1, E.y1, z0], [E.x0, E.y1, z0]], "url(#bio-v-peptidoglycan)");
  const strands = [z0 + 1.2, (z0 + z1) / 2, z1 - 1.2].map((z) => `M${at([E.x0, E.y1, z]).map((v) => v.toFixed(1)).join(" ")}L${at([E.x1, E.y1, z]).map((v) => v.toFixed(1)).join(" ")}`).join("");
  const links = [];
  for (let x = E.x0 + 4, i = 0; x < E.x1 - 2; x += 6, i++) {
    const [za, zb] = i % 2 ? [z0 + 1.2, (z0 + z1) / 2] : [(z0 + z1) / 2, z1 - 1.2];
    links.push(`M${at([x, E.y1, za]).map((v) => v.toFixed(1)).join(" ")}L${at([x, E.y1, zb]).map((v) => v.toFixed(1)).join(" ")}`);
  }
  return topFace + front + `<path d="${strands}" fill="none" stroke="var(--bio-peptidoglycan-edge)" stroke-width=".7"/><path d="${links.join("")}" fill="none" stroke="var(--bio-peptidoglycan-lo)" stroke-width=".7"/>`;
}

const membrane = (range) => bio.bilayer(P, { x0: E.x0, x1: E.x1, y0: E.y0, y1: E.y1, z0: range[0], z1: range[1] }, { spacing: 5.2, head: 1.75 });
const envelope = membrane(E.im) + wall() + membrane(E.om);

const R = W - SIDE + 8;
const L = SIDE - 8;
const right = (z) => at([E.x1 - 14, E.y1, z]);
const staticLabels = [
  bio.region("OUTSIDE THE CELL", 22, 26),
  bio.region("CYTOPLASM", 22, H - 18),
  bio.label("Outer membrane", right(-3.5), { side: "right", x: R, drop: -16 }),
  bio.label("Peptidoglycan", right(-12), { side: "right", x: R }),
  bio.label("Inner membrane", right(-31), { side: "right", x: R, drop: 16 }),
];

const start = stateAt(0.0001 + 6.4);
const first = phageSvg(start, P, B, PATH);
const svg = bio.bioSvg({
  width: W,
  height: H,
  label:
    "A textbook-style drawing of bacteriophage T4 infecting E. coli. Below, the Gram-negative envelope is shown in section: the outer membrane and inner membrane as phospholipid bilayers with a thin peptidoglycan mesh in the periplasm between them, and the cytoplasm under them. Above, the phage has a blue elongated icosahedral head holding its DNA, a green striped tail sheath, a yellow tail tube inside it, an orange baseplate and six purple long tail fibres. The fibres attach to the outer membrane, the baseplate lands, the sheath contracts and drives the tube through the envelope, and the phage DNA passes into the cytoplasm.",
  body: [tints, envelope, `<g data-live="phage">${first.svg}</g>`, `<g data-live="labels">${labelsSvg(first, P, B, { L, R })}</g>`, ...staticLabels],
});

const caption = `Bacteriophage T4 infecting E. coli. The six long tail fibres bind the outer membrane, the baseplate settles and its short tail fibres bind, and the tail sheath contracts from about ${SHEATH_NM.extended.length} to ${SHEATH_NM.contracted.length} nm, widening from ${SHEATH_NM.extended.diameter} to ${SHEATH_NM.contracted.diameter} nm. That drives the ${TUBE_NM.diameter} nm tail tube through the outer membrane, the peptidoglycan and the periplasm to the outer face of the inner membrane, and the ${GENOME_KBP} kbp genome passes from the ${HEAD_NM.length} × ${HEAD_NM.width} nm head into the cytoplasm. Drawn to scale in one frame, about 1 nm to 1.2 px; the stages are shown much faster than in life, and the injected DNA is drawn as a short strand. Sources: ${[...new Set(SOURCES.map((entry) => entry.source))].join("; ")}.`;

const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const DATA = { P, PATH, L, R };
const live = `const DATA = ${JSON.stringify(DATA)};\n${strip("model.mjs")}\n${strip("scene.mjs")}\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = bio.figurePage({
  fig: "Figure 3",
  title: "Bacteriophage T4 infecting E. coli",
  svg,
  aria: "Bacteriophage T4 infecting E. coli: right arrow for the next stage, space to pause",
  readout: readoutOf(6.4),
  hint: "→ next stage · space to pause",
  caption,
  theme,
  script: kitScript() + bioScript() + live,
});
const file = theme === "light" ? "t4-phage-light.html" : "t4-phage.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file, FIBRES);
