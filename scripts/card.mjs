import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { decodePng } from "./png.mjs";

export const CARD = { width: 1200, height: 900, scale: 4 / 3, margin: 0.09, ground: "#fafafa" };

const HIDE = `
html,body,.iso-page,.iso-figure,.iso-plate{background:${CARD.ground}!important;box-shadow:none!important;border-color:transparent!important;outline:none!important}
html{overflow:hidden!important}
.iso-plate{--microscope-card:${CARD.ground}!important;--microscope-paper:${CARD.ground}!important}
.iso-legend,.iso-plate-corners,[data-card-hidden]{visibility:hidden!important}
*:focus,*:focus-visible{outline:none!important}
`;

const STAGE = `(()=>{const plate=document.querySelector(".iso-plate");if(!plate)return null;let best=null,area=0;for(const child of plate.children){const r=child.getBoundingClientRect();const a=child.querySelector("svg,canvas")||child.matches("svg,canvas")?r.width*r.height:0;if(a>area){area=a;best=child}}for(const child of plate.children)if(child!==best)child.setAttribute("data-card-hidden","");if(!best)return null;const r=best.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`;

function chromePath() {
  return [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean).find((path) => existsSync(path));
}

function inkBox(png, ground) {
  const { width, height, bpp, pixels } = decodePng(png);
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(ground.slice(at, at + 2), 16));
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp;
      if (Math.abs(pixels[i] - r) + Math.abs(pixels[i + 1] - g) + Math.abs(pixels[i + 2] - b) <= 6) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, top, right: right + 1, bottom: bottom + 1, width, height };
}

export async function card(target, out, { wait = 2500 } = {}) {
  const binary = chromePath();
  if (!binary) throw new Error("No Chrome found. Set CHROME_PATH.");
  const profile = mkdtempSync(join(tmpdir(), "microscope-card-"));
  const chrome = spawn(binary, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"]);
  try {
    const port = await new Promise((done, fail) => {
      let text = "";
      const timer = setTimeout(() => fail(new Error("Chrome did not start")), 20000);
      chrome.stderr.on("data", (chunk) => {
        text += chunk;
        const match = text.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
        if (match) {
          clearTimeout(timer);
          done(Number(match[1]));
        }
      });
      chrome.on("exit", (code) => fail(new Error(`Chrome exited: ${code}`)));
    });
    const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const pending = new Map();
    let id = 0;
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    };
    await new Promise((done) => (socket.onopen = done));
    const send = (method, params = {}) => new Promise((done) => {
      const call = ++id;
      pending.set(call, done);
      socket.send(JSON.stringify({ id: call, method, params }));
    });
    const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
    const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
    const shot = async (clip, scale) => Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...clip, scale } })).result.data, "base64");

    await send("Page.enable");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: "light" }] });
    await send("Emulation.setDeviceMetricsOverride", { width: CARD.width, height: CARD.height, deviceScaleFactor: 2, mobile: false });
    const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(target)).href;
    const navigation = await send("Page.navigate", { url });
    if (navigation.result?.errorText) throw new Error(`Navigation failed: ${navigation.result.errorText}`);
    await sleep(wait);
    await evaluate(`(()=>{const s=document.createElement("style");s.textContent=${JSON.stringify(HIDE)};document.head.append(s);document.activeElement?.blur?.()})()`);
    const stage = await evaluate(STAGE);
    if (!stage) throw new Error("no .iso-plate with a drawing in it");
    await sleep(300);

    const probe = 2;
    const ink = inkBox(await shot({ x: stage.x, y: stage.y, width: stage.w, height: stage.h }, 1), CARD.ground);
    if (!ink) throw new Error("the stage drew nothing");
    const box = { x: stage.x + ink.left / probe, y: stage.y + ink.top / probe, w: (ink.right - ink.left) / probe, h: (ink.bottom - ink.top) / probe };
    const room = { w: CARD.width * (1 - 2 * CARD.margin), h: CARD.height * (1 - 2 * CARD.margin) };
    const s = Math.min(room.w / box.w, room.h / box.h);
    const to = { x: (CARD.width - box.w * s) / 2, y: (CARD.height - box.h * s) / 2 };
    await evaluate(`(()=>{scrollTo(0,0);const b=document.body,r=b.getBoundingClientRect(),l=r.left+scrollX,t=r.top+scrollY;b.style.transformOrigin="0 0";b.style.transform="translate("+(${to.x}-l-(${box.x}-l)*${s})+"px,"+(${to.y}-t-(${box.y}-t)*${s})+"px) scale(${s})"})()`);
    await sleep(400);
    const png = await shot({ x: 0, y: 0, width: CARD.width, height: CARD.height }, CARD.scale / 2);
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, png);
    socket.close();
    return { box, scale: s };
  } finally {
    chrome.kill("SIGKILL");
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }
}

function main() {
  const [target, ...rest] = process.argv.slice(2);
  const at = rest.indexOf("--out");
  if (!target) {
    console.error("usage: node scripts/card.mjs <page.html> [--out card.png]");
    process.exit(1);
  }
  const out = at >= 0 ? rest[at + 1] : "card.png";
  card(target, out).then(({ box, scale }) => {
    console.log(`saved ${out}: drawing ${Math.round(box.w)}×${Math.round(box.h)} at ×${scale.toFixed(2)}`);
    process.exit(0);
  }, (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

if (typeof WebSocket === "undefined" && !process.execArgv.includes("--experimental-websocket") && process.argv[1]?.endsWith("card.mjs")) {
  const child = spawn(process.execPath, ["--experimental-websocket", ...process.argv.slice(1)], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else if (process.argv[1]?.endsWith("card.mjs")) main();
