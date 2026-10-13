import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { dockerReady, runSandboxed } from "./sandbox.mjs";
import { validateFolder } from "./validate.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SEED = join(ROOT, "figures", "starhopp3r", "atp-synthase");
const SKILL = existsSync(join(ROOT, ".skill")) ? realpathSync(join(ROOT, ".skill")) : null;
const MODE = process.env.MICROSCOPE_TEST_SANDBOX ?? (dockerReady() ? "docker" : "local");
const ready = existsSync(SEED) && SKILL;

function copy(mutate, author = "starhopp3r") {
  const repo = mkdtempSync(join(tmpdir(), "microscope-community-"));
  const folder = join(repo, "figures", author, "atp-synthase");
  cpSync(SEED, folder, { recursive: true });
  symlinkSync(SKILL, join(repo, ".skill"), "dir");
  if (author !== "starhopp3r") writeFileSync(join(folder, "figure.json"), readFileSync(join(folder, "figure.json"), "utf8"));
  mutate?.(folder, repo);
  return { folder, repo, done: () => rmSync(repo, { recursive: true, force: true }) };
}
const check = (folder, options = {}) => validateFolder(folder, { sandbox: MODE, skill: SKILL, noBrowser: true, ...options });
const edit = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));
const build = (f) => join(f, "src", "build.mjs");
const lastWrite = (t) => t.lastIndexOf("writeFileSync(join(HERE");

test(`the seed figure passes (${MODE})`, { skip: !ready }, () => {
  const { folder, done } = copy();
  try { assert.deepEqual(check(folder).errors, []); } finally { done(); }
});

const faults = [
  ["a committed built page", (f) => writeFileSync(join(f, "src", "atp-synthase-light.html"), "<html></html>"), /files: src\/atp-synthase-light\.html is committed/],
  ["a committed poster", (f) => writeFileSync(join(f, "poster.png"), "x"), /files: unexpected poster\.png/],
  ["a network call hidden in the build", (f) => edit(build(f), (t) => t + '\nconst ping = () => fetch("https://example.org/x");\n'), /safety: .*network request \(fetch\)/],
  ["a disguised global lookup", (f) => edit(build(f), (t) => t + '\nconst g = globalThis["fe" + "tch"];\n'), /safety: .*computed access on globalThis/],
  ["the constructor route to eval", (f) => edit(build(f), (t) => t + '\nconst run = (() => {}).constructor;\n'), /safety: .*reaching a constructor/],
  ["reading environment variables", (f) => edit(build(f), (t) => t + '\nconst token = process["env"];\n'), /safety: .*environment variables/],
  ["a forbidden Node module", (f) => edit(build(f), (t) => 'import { execSync } from "node:child_process";\n' + t), /safety: .*node:child_process is not allowed/],
  ["an import that leaves the folder", (f) => edit(build(f), (t) => 'import "../../../../other/x.mjs";\n' + t), /safety: .*leaves the figure folder/],
  ["a wrong kit fingerprint", (f) => edit(join(f, "figure.json"), (t) => t.replace(/sha256:[0-9a-f]{64}/, "sha256:" + "0".repeat(64))), /skill: \.skill has kit/],
  ["a binary in src", (f) => writeFileSync(join(f, "src", "tool.wasm"), "x"), /files: src\/tool\.wasm: file type not allowed/],
  ["a payload that only appears in the built page", (f) => edit(build(f), (t) => t.replace('k.pageHtml({ title: "ATP synthase", theme, body: `<style>${css}</style>${body}`, script: kitScript() + live })', 'k.pageHtml({ title: "ATP synthase", theme, body: `<style>${css}</style>${body}`, script: kitScript() + live }).replace("</head>", "<scr" + "ipt src=" + "ht" + "tps://cdn.exa" + "mple.com/x.js></scr" + "ipt></head>")')), /output: .*external address/],
  ["a build that is not deterministic", (f) => edit(build(f), (t) => t.replace('title: "ATP synthase", theme', 'title: "ATP synthase " + Math.random(), theme')), /build: .*different on a second build/],
  ["a build that writes an extra file", (f) => edit(build(f), (t) => t + '\nwriteFileSync(join(HERE, "extra.txt"), "x");\n'), /build: the build wrote src\/extra\.txt/],
];
for (const [name, mutate, expected] of faults) test(`rejects ${name}`, { skip: !ready }, () => {
  const { folder, done } = copy(mutate);
  try {
    const result = check(folder);
    assert.ok(result.errors.some((e) => expected.test(e)), `expected ${expected}, got:\n${result.errors.join("\n") || "(passed)"}`);
  } finally { done(); }
});

test("a figure with no pages listed and only a dark page passes", { skip: !ready }, () => {
  const { folder, done } = copy((f) => edit(join(f, "figure.json"), (t) => { const j = JSON.parse(t); delete j.pages; delete j.preview; j.build = [["src/build.mjs"]]; return JSON.stringify(j, null, 2); }));
  try { assert.deepEqual(check(folder).errors, []); } finally { done(); }
});

test("a build cannot write outside its own folder", { skip: !ready }, () => {
  const { folder, repo, done } = copy((f) => edit(build(f), (t) => t + '\nwriteFileSync(join(HERE, "..", "..", "..", "escaped.txt"), "x");\n'));
  try {
    const result = check(folder);
    assert.ok(result.errors.some((e) => /build: .*failed/.test(e)), result.errors.join("\n") || "(passed)");
    assert.ok(!existsSync(join(repo, "figures", "starhopp3r", "escaped.txt")));
  } finally { done(); }
});

test("a figure filed under someone else's name is rejected", { skip: !ready }, () => {
  const { folder, done } = copy(undefined, "someone-else");
  try { assert.ok(check(folder).errors.some((e) => /author "starhopp3r" must match the folder figures\/someone-else/.test(e))); } finally { done(); }
});

test("a contributor cannot mark a figure featured", { skip: !ready }, () => {
  const { folder, done } = copy((f) => edit(join(f, "figure.json"), (t) => t.replace('"license"', '"featured": true,\n  "license"')));
  try {
    assert.ok(check(folder, { contributor: true }).errors.some((e) => /only maintainers set featured/.test(e)));
  } finally { done(); }
});

const sandboxed = MODE === "docker" && SKILL;
function probe(code) {
  const workspace = mkdtempSync(join(tmpdir(), "microscope-probe-"));
  try {
    mkdirSync(join(workspace, "figures", "x", "y", "src"), { recursive: true });
    writeFileSync(join(workspace, "figures", "x", "y", "src", "probe.mjs"), code);
    return runSandboxed({ mode: "docker", workspace, skill: SKILL, cwd: "figures/x/y", args: ["src/probe.mjs"], timeout: 120000, locked: ["figures/x/y/src"] }).output;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
test("the sandbox has no network", { skip: !sandboxed && "needs the docker sandbox" }, () => {
  const out = probe('import http from "node:http"; http.get("http://example.com", () => console.log("REACHED")).on("error", (e) => console.log("blocked " + e.code));');
  assert.match(out, /blocked/);
  assert.doesNotMatch(out, /REACHED/);
});
test("the sandbox blocks child processes, workers and reads outside", { skip: !sandboxed && "needs the docker sandbox" }, () => {
  const out = probe('import cp from "node:child_process"; import fs from "node:fs"; import wt from "node:worker_threads";\nfor (const [n, f] of [["child", () => cp.execSync("id")], ["read", () => fs.readFileSync("/etc/passwd")], ["worker", () => new wt.Worker("1", { eval: true })], ["system", () => fs.writeFileSync("/usr/x", "1")]]) { try { f(); console.log("ALLOWED " + n); } catch (e) { console.log("blocked " + n); } }');
  for (const what of ["child", "read", "worker", "system"]) assert.match(out, new RegExp(`blocked ${what}`), out);
  assert.doesNotMatch(out, /ALLOWED/);
});

test(`the seed figure passes the browser checks (${MODE})`, { skip: !ready || (MODE === "local" && !process.env.CHROME_PATH && process.platform !== "darwin") }, () => {
  const out = mkdtempSync(join(tmpdir(), "microscope-out-"));
  const { folder, done } = copy();
  try {
    const result = check(folder, { noBrowser: false, out });
    assert.deepEqual(result.errors, []);
    for (const file of ["poster.png", "light.png", "dark.png", "atp-synthase-light.html", "atp-synthase.html"]) assert.ok(existsSync(join(out, file)), file);
  } finally { done(); rmSync(out, { recursive: true, force: true }); }
});

test(`a figure that keeps moving under reduced motion is rejected (${MODE})`, { skip: !ready || (MODE === "local" && process.platform !== "darwin") }, () => {
  const out = mkdtempSync(join(tmpdir(), "microscope-out-"));
  const { folder, done } = copy((f) => edit(build(f), (t) => t.replace('k.pageHtml({ title: "ATP synthase", theme, body: `<style>${css}</style>${body}`, script: kitScript() + live })', 'k.pageHtml({ title: "ATP synthase", theme, body: `<style>${css}</style>${body}`, script: kitScript() + live }).replace("</head>", "<style>@keyframes spin{to{transform:rotate(360deg)}}.iso-plate svg{animation:spin 3s linear infinite}</style></head>")')));
  try {
    const result = check(folder, { noBrowser: false, out });
    assert.ok(result.errors.some((e) => /keeps moving with reduced motion/.test(e)), result.errors.join("\n") || "(passed)");
  } finally { done(); rmSync(out, { recursive: true, force: true }); }
});
