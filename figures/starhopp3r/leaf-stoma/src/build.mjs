import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as bio from "../../../../.skill/kit/bio.mjs";
import { kitScript, bioScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { SPECIES, MAX_APERTURE_UM, SOURCES, readoutOf } from "./model.mjs";
import { LEAF, STOMA_X, VEIN, stomaLayer } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 760;
const H = 390;
const SIDE = 165;
const BELOW = -44;

const fitted = k.fitProjection([[LEAF.x0, 0, LEAF.top], [LEAF.x1, 0, BELOW]], W - SIDE * 2, H - 30, { pad: 0, azimuth: 90, elevation: 6 });
const P = { ...fitted, origin: [fitted.origin[0] + SIDE, fitted.origin[1] + 15] };
const B = { ...bio, iso: k.iso, depthOf: k.depthOf, cameraOf: k.cameraOf };
const at = (point) => k.iso(point, P);
const kScale = bio.screenScale(P);
const yAt = (z) => at([0, 0, z])[1];
const xAt = (x) => at([x, 0, 0])[0];

let seed = 5;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const parts = [];
const anchors = {};
const leafPath = `M${xAt(LEAF.x0).toFixed(1)} ${yAt(206).toFixed(1)}L${xAt(LEAF.x1).toFixed(1)} ${yAt(206).toFixed(1)}L${xAt(LEAF.x1).toFixed(1)} ${yAt(29).toFixed(1)}L${xAt(LEAF.x0).toFixed(1)} ${yAt(29).toFixed(1)}Z`;
parts.push(`<path d="${leafPath}" fill="var(--bio-air)"/>`);

const epidermis = (z, skip) => {
  const step = 26.4;
  const count = Math.floor((LEAF.x1 - LEAF.x0) / step);
  const cells = [];
  for (let i = 0; i < count; i++) {
    const x = LEAF.x0 + step / 2 + i * step + ((LEAF.x1 - LEAF.x0) - count * step) / 2;
    if (skip(x)) continue;
    cells.push(x);
    parts.push(bio.cell(P, [x, 0, z], 25, 20, "epidermis", { radius: 5 }));
  }
  return cells;
};
const upper = epidermis(217, () => false);
anchors.upper = at([upper[0] - 12.5, 0, 217]);
anchors.upperR = at([upper[upper.length - 1] + 12.5, 0, 221]);

const palisadeStep = 17;
const palisadeCount = Math.floor((LEAF.x1 - LEAF.x0 - 6) / palisadeStep);
for (let i = 0; i < palisadeCount; i++) {
  const x = LEAF.x0 + 3 + palisadeStep / 2 + i * palisadeStep;
  parts.push(bio.capsule(P, [x, 0, 141], 7.2, 52, "palisade"));
  for (const side of [-1, 1]) {
    for (let j = 0; j < 4; j++) parts.push(bio.ellipsoid(P, [x + side * 4.3, 0, 146 + j * 13 + (side > 0 ? 6 : 0)], 1.5, 2.6, "chlorophyll"));
  }
  if (i === 0) anchors.palisade = at([x - 7.2, 0, 175]);
  if (i === 1) anchors.chloroplast = at([x - 4.3 - 1.4, 0, 159]);
}

const spongy = [];
const rows = [122, 98, 74, 50];
rows.forEach((z, row) => {
  for (let x = LEAF.x0 + 14 + (row % 2) * 13; x < LEAF.x1 - 12; x += 27) {
    const cx = x + (rand() - 0.5) * 6;
    const cz = z + (rand() - 0.5) * 6;
    if (Math.hypot(cx - VEIN.x, (cz - VEIN.z) * 1.1) < 50) continue;
    if (Math.abs(cx - STOMA_X) < 32 && cz < 80) continue;
    const across = 10 + rand() * 3;
    const tall = 8 + rand() * 3;
    spongy.push([cx, cz, across, tall]);
  }
});
for (const [x, z, across, tall] of spongy) {
  parts.push(bio.ellipsoid(P, [x, 0, z], across, tall, "spongy"));
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * Math.PI * 2 + 0.6;
    parts.push(bio.ellipsoid(P, [x + Math.cos(a) * across * 0.62, 0, z + Math.sin(a) * tall * 0.6], 1.4, 2.2, "chlorophyll"));
  }
}
const leftSpongy = spongy.filter(([, z]) => Math.abs(z - 98) < 8).sort((a, b) => a[0] - b[0])[0];
anchors.spongy = at([leftSpongy[0] - leftSpongy[2] * 0.98, 0, leftSpongy[1]]);
anchors.air = at([STOMA_X - 6, 0, 64]);

const ring = 36;
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  parts.push(bio.ellipsoid(P, [VEIN.x + Math.cos(a) * ring, 0, VEIN.z + Math.sin(a) * ring * 0.9], 7, 6.3, "sheathcell"));
}
anchors.sheath = at([VEIN.x + Math.cos(0.75) * ring + 6.5, 0, VEIN.z + Math.sin(0.75) * ring * 0.9]);
const xylem = [[-15, 13], [0, 17], [15, 13], [-7, 3], [8, 3]];
for (const [dx, dz] of xylem) {
  const c = [VEIN.x + dx, 0, VEIN.z + dz];
  const [cx, cy] = at(c);
  const r = 6.6 * kScale;
  parts.push(`<circle class="bio-body" data-swatch="xylem" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--bio-xylem-hi)" stroke="var(--bio-xylem-lo)" stroke-width="${(2.2 * kScale).toFixed(1)}"/>`);
}
anchors.xylem = at([VEIN.x + 15 + 6.6 + 1.1, 0, VEIN.z + 13]);
const phloem = [[-10, -12], [-2, -10], [6, -12], [-6, -19], [2, -19], [10, -18], [-12, -20]];
for (const [dx, dz] of phloem) parts.push(bio.ellipsoid(P, [VEIN.x + dx, 0, VEIN.z + dz], 3.6, 3.4, "phloem"));
anchors.phloem = at([VEIN.x + 10 + 3.5, 0, VEIN.z - 18]);

const lower = epidermis(20, (x) => Math.abs(x - STOMA_X) < 31);
anchors.lower = at([lower[lower.length - 1] + 12.5, 0, 18]);
parts.push(bio.rope(P, [[LEAF.x0, 0, 229.5], [LEAF.x1, 0, 229.5]], 1.6, "cuticle"));
parts.push(bio.rope(P, [[LEAF.x0, 0, 9], [STOMA_X - 28, 0, 9]], 1.1, "cuticle"));
parts.push(bio.rope(P, [[STOMA_X + 28, 0, 9], [LEAF.x1, 0, 9]], 1.1, "cuticle"));
anchors.cuticle = at([LEAF.x1 - 4, 0, 230.5]);

const initial = 0.62;
const L = SIDE - 10;
const R = W - SIDE + 10;
const staticLabels = [
  bio.region("AIR OUTSIDE THE LEAF", 22, 24),
  bio.label("Upper epidermis", anchors.upper, { side: "left", x: L }),
  bio.label("Palisade mesophyll", anchors.palisade, { side: "left", x: L }),
  bio.label("Chloroplast", anchors.chloroplast, { side: "left", x: L }),
  bio.label("Spongy mesophyll", anchors.spongy, { side: "left", x: L }),
  bio.label("Air space", anchors.air, { side: "left", x: L }),
  bio.label("Cuticle", anchors.cuticle, { side: "right", x: R }),
  bio.label("Bundle sheath", anchors.sheath, { side: "right", x: R, drop: -12 }),
  bio.label("Xylem", anchors.xylem, { side: "right", x: R }),
  bio.label("Phloem", anchors.phloem, { side: "right", x: R }),
  bio.label("Lower epidermis", anchors.lower, { side: "right", x: R }),
];

const bands = `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--bio-outside)"/>`;
const first = stomaLayer(initial, P, B, { L, MAX: MAX_APERTURE_UM });
const svg = bio.bioSvg({
  width: W,
  height: H,
  label:
    "A textbook-style cross-section of a broad bean leaf. From the top: a waxy cuticle, a row of clear upper epidermis cells, a row of tall palisade cells packed with green chloroplasts, and loose spongy mesophyll cells with air spaces between them. On the right a vein: a ring of bundle sheath cells around thick-walled xylem above and small phloem cells below. In the lower epidermis two green guard cells flank a stoma over an air space; as they swell the pore opens, carbon dioxide enters and water vapour and oxygen leave.",
  body: [bands, ...parts, `<g data-live="stoma">${first}</g>`, ...staticLabels],
});

const caption = `A cross-section of a broad bean (${SPECIES}) leaf, a eudicot. Light is taken up mainly by the chloroplasts of the palisade mesophyll; the spongy mesophyll's air spaces connect to the outside through stomata, which in broad bean occur on both surfaces, slightly more on the lower; one is drawn here in the lower epidermis. Each stoma is a pore between two guard cells. When they take up K⁺ and then water, their turgor rises and, shaped by radially arranged cellulose microfibrils and stiff ends, they bow apart and the pore opens, here to about ${MAX_APERTURE_UM} µm; CO₂ diffuses in for photosynthesis and water vapour and O₂ diffuse out. When they lose K⁺ and water the pore closes. In a leaf this takes tens of minutes; it is shown much faster here. Sources: ${[...new Set(SOURCES.map((entry) => entry.source))].join("; ")}.`;

const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const DATA = { P, L, R, MAX: MAX_APERTURE_UM, initial };
const live = `const DATA = ${JSON.stringify(DATA)};\n${strip("model.mjs")}\n${strip("scene.mjs")}\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = bio.figurePage({
  fig: "Figure 4",
  title: "A leaf in cross-section, and a stoma opening",
  svg,
  aria: "Leaf cross-section: the stoma opens and closes; right arrow to open or close it, space to pause",
  readout: readoutOf(1.6),
  hint: "→ open or close the stoma · space to pause",
  caption,
  theme,
  script: kitScript() + bioScript() + live,
});
const file = theme === "light" ? "leaf-stoma-light.html" : "leaf-stoma.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file);
