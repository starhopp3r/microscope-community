const P = DATA.P;
const B = { rope, label, dimension, smoothPath, screenScale, iso, depthOf, cameraOf };
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const artLayer = svg.querySelector('[data-live="art"]');
const notesLayer = svg.querySelector('[data-live="notes"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let clock = still.matches ? 4.4 : 0.6;
let paused = still.matches;
let visible = false;
let frame = 0;
let last = 0;

function draw() {
  const view = sarcomereSvg(still.matches ? Math.floor(clock * 4) / 4 + 0.001 : clock, P, B, DATA);
  artLayer.innerHTML = view.art;
  notesLayer.innerHTML = view.annotations;
  const text = readoutOf(clock);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(bandsAt(clock).sl * 100)));
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
    const t = ((clock % CYCLE_S) + CYCLE_S) % CYCLE_S;
    clock = t < 1.2 || t >= 5.2 ? 1.2 : 5.2;
    draw();
  } else if (event.key === " ") {
    event.preventDefault();
    paused = !paused;
    run();
  }
});
draw();
