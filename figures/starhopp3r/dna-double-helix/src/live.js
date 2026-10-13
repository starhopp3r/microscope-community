const P = DATA.P;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector('[data-live="helix"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let index = 0;
let touring = !still.matches;
let visible = false;
let timer = 0;
let idle = 0;

function draw() {
  layer.innerHTML = sortedSvg(doubleHelix(P, DATA.START, DATA.END, { ...DATA.OPTIONS, highlight: index }));
  const text = readoutOf(index);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(index + 1));
  stage.setAttribute("aria-valuetext", text);
}
function show(next) {
  const clamped = Math.max(0, Math.min(DATA.PAIRS - 1, next));
  if (clamped === index) return;
  index = clamped;
  draw();
}
function tour() {
  clearTimeout(timer);
  if (!touring || !visible) return;
  timer = setTimeout(() => {
    show((index + 1) % DATA.PAIRS);
    tour();
  }, STEP_S * 1000);
}
function rest() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    tour();
  }, 3600);
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  tour();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * svg.viewBox.baseVal.width;
  touring = false;
  clearTimeout(timer);
  show(Math.floor(((x - DATA.left) / (DATA.right - DATA.left)) * DATA.PAIRS));
});
stage.addEventListener("pointerleave", rest);
stage.addEventListener("keydown", (event) => {
  const moves = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  if (event.key in moves) {
    event.preventDefault();
    touring = false;
    clearTimeout(timer);
    show(index + moves[event.key]);
    rest();
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    touring = false;
    show(event.key === "Home" ? 0 : DATA.PAIRS - 1);
    rest();
  }
});
draw();
