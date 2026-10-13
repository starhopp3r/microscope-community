import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as bio from "../../../../.skill/kit/bio.mjs";
import { kitScript, bioScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { THICK_UM, THIN_UM, BARE_UM, SL_RELAXED, SL_CONTRACTED, SOURCES, readoutOf } from "./model.mjs";
import { WINDOW, sarcomereSvg } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 760;
const H = 400;
const SIDE = 170;

const fitted = k.fitProjection([[-WINDOW, 0, 150], [WINDOW, 0, -130]], W - SIDE * 2, H - 30, { pad: 0, azimuth: 90, elevation: 0 });
const P = { ...fitted, origin: [fitted.origin[0] + SIDE, fitted.origin[1] + 15] };
const B = { ...bio, iso: k.iso, depthOf: k.depthOf, cameraOf: k.cameraOf };
const L = SIDE - 8;
const R = W - SIDE + 8;
const left = k.iso([-WINDOW, 0, 0], P)[0];
const right = k.iso([WINDOW, 0, 0], P)[0];
const fade = 34;
const mask = `<defs><linearGradient id="sarc-fade" x1="${left.toFixed(1)}" x2="${right.toFixed(1)}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${(fade / (right - left)).toFixed(3)}" stop-color="#fff"/><stop offset="${(1 - fade / (right - left)).toFixed(3)}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="sarc-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="${left.toFixed(1)}" y="0" width="${(right - left).toFixed(1)}" height="${H}" fill="url(#sarc-fade)"/></mask></defs>`;
const first = sarcomereSvg(0.6, P, B, { L, R });
const svg = bio.bioSvg({
  width: W,
  height: H,
  label:
    "A textbook-style drawing of a sarcomere, the contractile unit of frog skeletal muscle, between two zig-zag Z discs. Orange thin filaments of actin, drawn as twisted strings of beads, run from each Z disc toward the middle; blue thick filaments of myosin with heads pointing away from the central M line sit between them. Brackets above mark the sarcomere, the A band and the H zone, and one below marks the I band across a Z disc. As the muscle contracts the thin filaments slide toward the M line: the sarcomere, I band and H zone shorten while the A band stays the same length.",
  body: [mask, `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--bio-cytoplasm)"/>`, `<g data-live="art" mask="url(#sarc-mask)">${first.art}</g>`, `<g data-live="notes">${first.annotations}</g>`, bio.region("SKELETAL MUSCLE FIBRE, ONE SARCOMERE", 22, 24)],
});
const caption = `One sarcomere of frog skeletal muscle, the classic vertebrate model. Thin actin filaments, about ${THIN_UM} µm long, are anchored at the Z discs; thick myosin filaments, about ${THICK_UM} µm long with a bare zone of about ${BARE_UM} µm at the M line, sit between them with their heads pointing away from the middle. When the muscle contracts, myosin heads bind actin and pull the thin filaments toward the M line, so the filaments slide past each other: here the sarcomere shortens from ${SL_RELAXED} to ${SL_CONTRACTED} µm, the I band and H zone shorten, and the A band, the length of the thick filaments, stays the same. Lengths are to scale; filament widths, spacing and the number of heads are simplified for clarity. Sources: ${[...new Set(SOURCES.map((entry) => entry.source))].join("; ")}.`;

const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const DATA = { P, L, R };
const live = `const DATA = ${JSON.stringify(DATA)};\n${strip("model.mjs")}\n${strip("scene.mjs")}\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = bio.figurePage({
  fig: "Figure 5",
  title: "The sarcomere and the sliding filaments",
  svg,
  aria: "Sarcomere: the filaments slide as the muscle contracts and relaxes; right arrow to contract or relax, space to pause",
  readout: readoutOf(0.6),
  hint: "→ contract or relax · space to pause",
  caption,
  theme,
  script: kitScript() + bioScript() + live,
});
const file = theme === "light" ? "sarcomere-light.html" : "sarcomere.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file);
