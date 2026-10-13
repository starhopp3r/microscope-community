const P = DATA.P;
const B = { sphere, ellipsoid, capsule, rope, iso, depthOf };
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const proteinLayer = svg.querySelector('[data-live="protein"]');
const transitLayer = svg.querySelector('[data-live="transit"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const REST_S = 2.4;
const BETAS = LOBES.filter((lobe) => lobe.kind === "beta").map((lobe) => lobe.angle);
const rand = seeded(7);

const ease = (t) => t * t * (3 - 2 * t);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const along = (points, t) => {
  const spans = points.length - 1;
  const at = Math.min(spans - 1e-9, Math.max(0, t * spans));
  const index = Math.floor(at);
  return lerp3(points[index], points[index + 1], at - index);
};
const envelope = (t) => (t < 0.12 ? t / 0.12 : 1) * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);

let theta = DATA.THETA0;
let target = DATA.THETA0;
let rate = 0;
let crossed = 0;
let released = 0;
let wait = 1.2;
let tourSteps = 0;
let touring = !still.matches;
let driving = false;
let paused = false;
let visible = false;
let frame = 0;
let last = 0;
let idle = 0;
let transits = [];
let queue = DATA.queue.map((point, index) => ({ slot: index, at: index, alpha: 1 }));
const slotPoint = (slot) => {
  const index = Math.max(0, Math.min(DATA.queue.length - 1, slot));
  const low = Math.floor(index);
  const high = Math.min(DATA.queue.length - 1, low + 1);
  return lerp3(DATA.queue[low], DATA.queue[high], index - low);
};

function step() {
  target += STEP_DEG;
  const head = queue.shift();
  if (head) transits.push({ kind: "in", t: 0, dur: STEP_S * 0.6, from: slotPoint(head.at) });
  queue.forEach((proton) => { proton.slot -= 1; });
  queue.push({ slot: DATA.queue.length - 1, at: DATA.queue.length - 1, alpha: 0 });
}

function draw() {
  const extras = [];
  const moving = [];
  for (const item of transits) {
    const t = Math.min(1, item.t / item.dur);
    if (item.kind === "in") moving.push(protonGlyph(P, B, lerp3(item.from, ENTRY[1], ease(t)), t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3));
    if (item.kind === "out") moving.push(protonGlyph(P, B, along([polar(SITE_R, A_DEG - 22.5, 0), EXIT[0], EXIT[1]], ease(t)), envelope(t)));
    if (item.kind === "atp") {
      const drop = Math.sin(((VIEW_DEG - item.angle) * Math.PI) / 180) > 0 ? 0 : 17;
      const point = lerp3(polar(KNOB.R + KNOB.across + 4, item.angle, KNOB.z - drop), polar(KNOB.R + KNOB.across + 12, item.angle + 6, KNOB.z - drop - 10), ease(t));
      extras.push({ d: depthOf(point, P) + 1, svg: atpGlyph(P, B, point, envelope(t)) });
    }
  }
  proteinLayer.innerHTML = proteinSvg(theta, P, B, [...extras, DATA.backArc]);
  transitLayer.innerHTML = queue.map((proton) => protonGlyph(P, B, slotPoint(proton.at), proton.alpha)).join("") + moving.join("");
  const turned = Math.max(0, theta - DATA.THETA0);
  const text = readoutOf(turned);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(protonsOf(turned)));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  const settled = Math.abs(target - theta) < 0.02 && Math.abs(rate) < 0.02;
  if (!paused && (touring || driving)) {
    wait -= dt;
    if (wait <= 0 && settled) {
      step();
      tourSteps += 1;
      wait = STEP_S + dwellOf(rand, driving ? 0.4 : 1);
      if (touring && tourSteps % RING.n === 0) wait += REST_S;
    }
  }
  if (calm) {
    theta = target;
    rate = 0;
  } else {
    const stiff = 220;
    const drag = 2 * Math.sqrt(stiff);
    for (let i = 0; i < 4; i++) {
      rate += ((target - theta) * stiff - rate * drag) * (dt / 4);
      theta += rate * (dt / 4);
    }
    if (Math.abs(target - theta) < 0.01 && Math.abs(rate) < 0.01) {
      theta = target;
      rate = 0;
    }
  }
  const turned = theta - DATA.THETA0;
  while (crossed < protonsOf(turned)) {
    crossed += 1;
    if (!calm) transits.push({ kind: "out", t: 0, dur: 1.5 });
  }
  while (released < atpOf(turned)) {
    if (!calm) transits.push({ kind: "atp", t: 0, dur: 2.4, angle: BETAS[released % BETAS.length] });
    released += 1;
  }
  for (const item of transits) item.t += dt;
  transits = calm ? [] : transits.filter((item) => item.t < item.dur);
  for (const proton of queue) {
    proton.at = calm ? proton.slot : proton.at + (proton.slot - proton.at) * (1 - Math.exp(-dt / 0.25));
    proton.alpha = calm ? 1 : Math.min(1, proton.alpha + dt / 0.6);
  }
  draw();
  const busy = touring || driving || transits.length || theta !== target || queue.some((proton) => proton.alpha < 1 || Math.abs(proton.slot - proton.at) > 0.002);
  frame = visible && busy && !paused ? requestAnimationFrame(tick) : 0;
}

const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const rest = () => {
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    run();
  }, 3600);
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointerenter", () => {
  touring = false;
  driving = !still.matches;
  clearTimeout(idle);
  run();
});
stage.addEventListener("pointerleave", () => {
  driving = false;
  rest();
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    touring = false;
    if (Math.abs(target - theta) < STEP_DEG * 0.6) step();
    rest();
    run();
  } else if (event.key === " ") {
    event.preventDefault();
    paused = !paused;
    if (paused) touring = false;
    else rest();
    run();
  }
});
draw();
