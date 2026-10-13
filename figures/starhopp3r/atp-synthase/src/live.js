const P = DATA.P;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const figure = stage.closest(".iso-figure");
const layer = (name) => svg.querySelector(`[data-live="${name}"]`);
const rotorBack = layer("rotor-back");
const rotorFront = layer("rotor-front");
const imsLayer = layer("ims");
const matrixLayer = layer("matrix");
const atpBehind = layer("atp-behind");
const atpFront = layer("atp-front");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const K = { cylinder, solidSvg, depthOf };
const REST_S = 2.4;
const QUEUE = 3;
const TOUR = RING.n;
const BETAS = DATA.LOBES.filter((lobe) => lobe.kind === "beta").map((lobe) => lobe.angle).sort((a, b) => b - a);
const rand = seeded(7);

const place = (point, markup, alpha = 1) => `<g transform="${translateAlong(P, point)}"${alpha < 0.999 ? ` opacity="${Math.max(0, alpha).toFixed(3)}"` : ""}>${markup}</g>`;
const ease = (t) => t * t * (3 - 2 * t);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const HOLE_IN = polar(INLET.r, INLET.angle, INLET.z);
const NORMAL_IN = polar(1, INLET.angle - 90);
const queueAt = (slot) => [HOLE_IN[0] + NORMAL_IN[0] * (6 + slot * 6.5), HOLE_IN[1] + NORMAL_IN[1] * (6 + slot * 6.5) + slot * 2.4, INLET.z - 5 - slot * 4.2];

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
let lit = "";
let visible = false;
let frame = 0;
let last = 0;
let idle = 0;
let transits = [];
let queue = Array.from({ length: QUEUE }, (_, index) => ({ at: index, alpha: 1 }));

function step() {
  target -= STEP_DEG;
  if (queue.length) {
    queue.shift();
    transits.push({ kind: "in", t: 0, dur: STEP_S * 0.55 });
    queue.forEach((proton) => { proton.slot = (proton.slot ?? proton.at) - 1; });
    queue.push({ at: QUEUE, slot: QUEUE - 1, alpha: 0 });
  }
}

function spawnOut() {
  transits.push({ kind: "out", t: 0, dur: 1.6, spin: rand() * 16 - 8 });
}

function spawnAtp(index) {
  transits.push({ kind: "atp", t: 0, dur: 2.6, angle: BETAS[index % BETAS.length] });
}

function draw() {
  const rotor = rotorSvg(theta, P, K, (point) => place(point, DATA.SPRITE_H));
  const dim = lit && lit !== "rotor";
  rotorBack.innerHTML = dim ? rotor.back.replaceAll(' data-lit=""', "") : rotor.back;
  rotorFront.innerHTML = dim ? rotor.front.replaceAll(' data-lit=""', "") : rotor.front;
  const ims = queue.map((proton) => place(queueAt(proton.at), DATA.SPRITE_H, proton.alpha));
  const matrix = [];
  const behind = [];
  const front = [];
  for (const item of transits) {
    const t = Math.min(1, item.t / item.dur);
    if (item.kind === "in") ims.push(place(lerp3(queueAt(0), HOLE_IN, ease(t)), DATA.SPRITE_H, t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4));
    if (item.kind === "out") {
      const point = polar(OUTLET.r + 12 * t, OUTLET.angle + item.spin * t, OUTLET.z + 2 + 24 * ease(t));
      matrix.push(place(point, DATA.SPRITE_H, (t < 0.12 ? t / 0.12 : 1) * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45)));
    }
    if (item.kind === "atp") {
      const from = polar(DATA.LOBE.rc + DATA.LOBE.re + 3, item.angle, DATA.LOBE.z + 16);
      const to = polar(DATA.LOBE.rc + DATA.LOBE.re + 24, item.angle + 8, DATA.LOBE.z + 40);
      const markup = place(lerp3(from, to, ease(t)), DATA.SPRITE_ATP, (t < 0.12 ? t / 0.12 : 1) * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45));
      (Math.cos(((item.angle - VIEW_DEG) * Math.PI) / 180) >= 0 ? front : behind).push(markup);
    }
  }
  imsLayer.innerHTML = ims.join("");
  matrixLayer.innerHTML = matrix.join("");
  atpBehind.innerHTML = behind.join("");
  atpFront.innerHTML = front.join("");
  const turned = DATA.THETA0 - theta;
  const text = readoutOf(Math.max(0, turned));
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(protonsOf(Math.max(0, turned))));
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
      if (touring && tourSteps % TOUR === 0) wait += REST_S;
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
  const turned = DATA.THETA0 - theta;
  while (crossed < protonsOf(turned)) {
    crossed += 1;
    if (!calm) spawnOut();
  }
  while (released < atpOf(turned)) {
    if (!calm) spawnAtp(released);
    released += 1;
  }
  for (const item of transits) item.t += dt;
  transits = transits.filter((item) => item.t < item.dur);
  for (const proton of queue) {
    const goal = proton.slot ?? proton.at;
    proton.at = calm ? goal : proton.at + (goal - proton.at) * (1 - Math.exp(-dt / 0.25));
    proton.alpha = calm ? 1 : Math.min(1, proton.alpha + dt / 0.6);
  }
  if (calm) transits = [];
  draw();
  const busy = touring || driving || transits.length || theta !== target || queue.some((proton) => proton.alpha < 1 || Math.abs((proton.slot ?? proton.at) - proton.at) > 0.002);
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

function show(part) {
  lit = part;
  figure.querySelectorAll(".it[data-on]").forEach((node) => {
    node.removeAttribute("data-on");
    node.querySelectorAll(".iso-solid[data-shown]").forEach((solid) => {
      solid.removeAttribute("data-lit");
      solid.removeAttribute("data-shown");
    });
  });
  figure.querySelectorAll(".as-key[data-on]").forEach((key) => key.removeAttribute("data-on"));
  if (part) {
    figure.querySelector(`.as-key[data-key="${part}"]`)?.setAttribute("data-on", "");
    if (part !== "rotor") {
      figure.querySelectorAll(`.it[data-part="${part}"]`).forEach((node) => {
        node.setAttribute("data-on", "");
        node.querySelectorAll(".iso-solid:not([data-lit])").forEach((solid) => {
          solid.setAttribute("data-lit", "");
          solid.setAttribute("data-shown", "");
        });
      });
    }
  }
  draw();
}
figure.querySelectorAll(".as-key[data-key]").forEach((key) => {
  const part = key.getAttribute("data-key");
  key.addEventListener("pointerenter", () => show(part));
  key.addEventListener("focus", () => show(part));
  key.addEventListener("pointerleave", () => show(""));
  key.addEventListener("blur", () => show(""));
});
svg.querySelectorAll(".it[data-part]").forEach((node) => {
  const part = node.getAttribute("data-part");
  node.addEventListener("pointerenter", () => show(part));
  node.addEventListener("pointerleave", () => show(""));
});
draw();
