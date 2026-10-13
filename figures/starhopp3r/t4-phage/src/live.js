const P = DATA.P;
const B = { capsule, ellipsoid, sphere, rope, label, smoothPath, screenScale, iso, depthOf, cameraOf };
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const phageLayer = svg.querySelector('[data-live="phage"]');
const labelLayer = svg.querySelector('[data-live="labels"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let clock = still.matches ? 6.4 : 0;
let paused = still.matches;
let visible = false;
let frame = 0;
let last = 0;

function draw() {
  const state = stateAt(clock);
  const view = phageSvg(state, P, B, DATA.PATH);
  const alpha = state.alpha.toFixed(3);
  phageLayer.setAttribute("opacity", alpha);
  labelLayer.setAttribute("opacity", alpha);
  phageLayer.innerHTML = view.svg;
  labelLayer.innerHTML = labelsSvg(view, P, B, DATA);
  const text = readoutOf(clock);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(state.inject * GENOME_KBP)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (!paused) clock = (clock + dt) % CYCLE_S;
  draw();
  frame = visible && !paused ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible && !paused) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  run();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    const t = stateAt(clock).t;
    const next = STAGES.find((s) => s.at > t + 0.05);
    clock = next ? next.at : 0;
    draw();
  } else if (event.key === " ") {
    event.preventDefault();
    paused = !paused;
    run();
  }
});
draw();
