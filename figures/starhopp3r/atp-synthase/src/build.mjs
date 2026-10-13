import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../../.skill/kit/iso-kit.mjs";
import * as bio from "../../../../.skill/kit/bio.mjs";
import { kitScript, bioScript } from "../../../../.skill/scripts/inline-kit.mjs";
import { SPECIES, C_SUBUNITS, ATP_PER_TURN, H_PER_ATP, REV_PER_S, SLOWER, SOURCES, readoutOf } from "./model.mjs";
import { VIEW_DEG, VIEW_ELEVATION, AXIS, MEMBRANE, RING, ASUB, ROD, KNOB, OSCP, STALK, STALK_R, ENTRY, EXIT, PROTON_R, SPIN, polar, proteinSvg, protonGlyph } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 760;
const H = 560;
const SIDE = 150;
const TOP = 38;

const fitted = k.fitProjection(
  [[MEMBRANE.x0, MEMBRANE.y0, MEMBRANE.z1], [MEMBRANE.x1, MEMBRANE.y1, MEMBRANE.z0], [MEMBRANE.x1, MEMBRANE.y0, MEMBRANE.z1], [MEMBRANE.x0, MEMBRANE.y1, MEMBRANE.z0], [0, AXIS[1], 100], [0, AXIS[1] + 30, -160]],
  W - SIDE * 2,
  H - TOP - 20,
  { pad: 0, azimuth: VIEW_DEG, elevation: VIEW_ELEVATION },
);
const P = { ...fitted, origin: [fitted.origin[0] + SIDE, fitted.origin[1] + TOP] };
const B = { ...bio, iso: k.iso, depthOf: k.depthOf };
const at = (point) => k.iso(point, P);
const THETA0 = 0;

const midY = at([0, MEMBRANE.y1, 0])[1];
const background = `<rect x="0" y="0" width="${W}" height="${midY.toFixed(1)}" fill="var(--bio-ims)"/><rect x="0" y="${midY.toFixed(1)}" width="${W}" height="${(H - midY).toFixed(1)}" fill="var(--bio-matrix)"/>`;
const membrane = bio.bilayer(P, MEMBRANE, { spacing: 9, head: 3.6 });

const queue = [[AXIS[0] + 56, AXIS[1] + 4, 96], [AXIS[0] + 72, AXIS[1] - 6, 112], [AXIS[0] + 40, AXIS[1] - 10, 118]];
const highH = [[AXIS[0] + 112, AXIS[1] - 30, 120], [AXIS[0] - 40, AXIS[1] - 30, 96], [AXIS[0] - 96, AXIS[1] - 50, 120], [AXIS[0] + 16, AXIS[1] - 52, 134], [AXIS[0] - 6, AXIS[1] + 6, 72]];
const lowH = [[AXIS[0] + 96, AXIS[1] + 10, -44]];
const spin = bio.rotationArrow(P, [AXIS[0], AXIS[1], SPIN.z], SPIN.r, VIEW_DEG - 200, VIEW_DEG + 60);
const rodDepth = k.depthOf(polar(0, 0, -80), P);
const arrows = [bio.arrow(ENTRY.map(at), { flow: true }), bio.arrow(EXIT.map(at), { flow: true }), spin.front];

const LEFT = VIEW_DEG + 90;
const RIGHT = VIEW_DEG - 90;
const toward = (point, r, deg) => [point[0] + r * Math.cos((deg * Math.PI) / 180), point[1] + r * Math.sin((deg * Math.PI) / 180), point[2]];
const statorR = ASUB.across * Math.sqrt(1 - ((28 - ASUB.at[2]) / ASUB.tall) ** 2);
const anchors = {
  rotor: at(polar(RING.R + RING.r, LEFT, 8)),
  rod: at(polar(ROD.r, LEFT, -46)),
  head: at(polar(KNOB.R + KNOB.across, LEFT, KNOB.z)),
  stator: at(toward([ASUB.at[0], ASUB.at[1], 28], statorR, RIGHT)),
  membraneTop: at([MEMBRANE.x0 + 40, -6, MEMBRANE.z1]),
  proton: at(toward(highH[0], PROTON_R * 0.6, RIGHT)),
  membrane: at([MEMBRANE.x1, 0, 0]),
  stalk: at(toward(STALK[2], STALK_R, RIGHT)),
  oscp: at(polar(OSCP.across * 0.5, VIEW_DEG - 25, OSCP.z - OSCP.tall * 0.7)),
};
const L = SIDE - 8;
const R = W - SIDE + 8;
const labels = [
  bio.region("INTERMEMBRANE SPACE", 22, 26),
  bio.region("MITOCHONDRIAL MATRIX", 22, H - 18),
  bio.label("Rotor (ring of 8 c)", anchors.rotor, { side: "left", x: L }),
  bio.label("Central stalk (γ, rotates)", anchors.rod, { side: "left", x: L }),
  bio.label("Catalytic head (α₃β₃)", anchors.head, { side: "left", x: L }),
  bio.label("H⁺ (high concentration)", anchors.proton, { side: "right", x: R }),
  bio.label("Stator: a subunit", anchors.stator, { side: "right", x: R, drop: -38 }),
  bio.label("Inner mitochondrial\nmembrane", anchors.membraneTop, { side: "left", x: L, drop: -40 }),
  bio.label("Peripheral stalk (stator)", anchors.stalk, { side: "right", x: R }),
  bio.label("OSCP", anchors.oscp, { side: "right", x: R, drop: 22 }),
];
const knobLeft = at(polar(KNOB.R + KNOB.across, LEFT, KNOB.z - 22));
const textX = knobLeft[0] - 86;
const adpY = knobLeft[1] - 8;
const atpY = adpY + 50;
const reaction =
  `<text class="bio-label" x="${textX.toFixed(1)}" y="${adpY.toFixed(1)}" text-anchor="end">ADP + Pᵢ</text>` +
  `<text class="bio-label" x="${textX.toFixed(1)}" y="${atpY.toFixed(1)}" text-anchor="end" font-weight="700">ATP</text>` +
  bio.arrow([[textX + 8, adpY - 4], [textX + 8, atpY - 4]], { bend: -30, size: 6.5 });

const svg = k.figureSvg({
  width: W,
  height: H,
  label:
    "A textbook-style drawing of mitochondrial ATP synthase in the inner mitochondrial membrane, shown as a phospholipid bilayer with orange heads and pale tails. Above is the intermembrane space, below is the matrix. Protons, drawn as red H+ spheres, flow down through the blue stator a subunit, ride the teal rotor ring of eight c subunits and leave into the matrix, turning the ring and the yellow central stalk. The stalk turns inside the catalytic head of three pale purple alpha and three dark purple beta subunits, held by the blue peripheral stalk and OSCP, and ADP plus phosphate becomes ATP.",
  body: [
    bio.bioDefs(),
    background,
    membrane,
    `<g data-live="protein">${proteinSvg(THETA0, P, B, [{ d: rodDepth - 0.5, svg: spin.back }])}</g>`,
    arrows.join(""),
    `<g class="bio-ions">${[...highH, ...lowH].map((p) => protonGlyph(P, B, p)).join("")}</g>`,
    `<g data-live="transit">${queue.map((p) => protonGlyph(P, B, p)).join("")}</g>`,
    labels.join(""),
    reaction,
  ],
  className: "bio-svg",
});

const caption = `Bovine (${SPECIES}) mitochondrial ATP synthase. Protons flow down their gradient from the intermembrane space through a half-channel in the a subunit, bind the ring of ${C_SUBUNITS} c subunits, ride it almost a full turn and leave into the matrix. The ring and central stalk turn clockwise seen from the intermembrane space (anticlockwise seen from the matrix), and every 120° of the γ stalk changes the β subunits so that one releases ATP: ${C_SUBUNITS} H⁺ and ${ATP_PER_TURN} ATP per turn, about ${H_PER_ATP.toFixed(1)} H⁺ per ATP. The enzyme turns about ${REV_PER_S} times a second; here it is shown about ${SLOWER}× slower, and the elastic coupling between 45° steps in F₀ and 120° steps in F₁ is drawn as one rigid rotor. Sources: ${[...new Set(SOURCES.map((entry) => entry.source))].join("; ")}.`;

const stage = `<div class="iso-stage bio-stage" tabindex="0" role="slider" aria-label="ATP synthase: hover to drive protons through, right arrow for one proton, space to pause" aria-valuemin="0" aria-valuemax="1000000" aria-valuenow="0" aria-valuetext="${readoutOf(0)}">${svg}</div>`;
const body = `<figure class="iso-figure bio-figure"><div class="iso-plate bio-plate"><p class="bio-title"><span class="bio-fig">Figure 1</span>ATP synthase, a rotary motor driven by protons</p>${stage}<div class="bio-foot"><span>Hover to drive · → one proton · space to pause</span><span data-readout>${readoutOf(0)}</span></div></div><figcaption class="iso-legend"><span class="iso-caption">${caption}</span></figcaption></figure>`;

const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const DATA = { P, THETA0, queue, backArc: { d: rodDepth - 0.5, svg: spin.back } };
const live = `const DATA = ${JSON.stringify(DATA)};\n${strip("model.mjs")}\n${strip("scene.mjs")}\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const css = bio.bioCss() + readFileSync(join(HERE, "atp.css"), "utf8");
const page = k.pageHtml({ title: "ATP synthase", theme, body: `<style>${css}</style><div class="bio" data-theme="${theme}">${body}</div>`, script: kitScript() + bioScript() + live, width: 800 });
const file = theme === "light" ? "atp-synthase-light.html" : "atp-synthase.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file);
