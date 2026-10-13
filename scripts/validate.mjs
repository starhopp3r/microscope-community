import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSource, loadParser } from "./analyze.mjs";
import { fingerprintOfSkill } from "./fingerprint.mjs";
import { changedFraction } from "./png.mjs";
import { checkImports, isSourceType, relativeTo, scanText } from "./safety.mjs";
import { dockerReady, runSandboxed } from "./sandbox.mjs";
import { ID, validateFigure } from "./schema.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const STILL = 0.0001;
export const LIMITS = { folder: 2 << 20, file: 1 << 20, page: 4 << 20 };
const TOP_LEVEL = ["figure.json", "README.md", "src"];

function listFiles(dir, root = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) out.push({ path: relativeTo(root, full), link: true });
    else if (stat.isDirectory()) listFiles(full, root, out);
    else out.push({ path: relativeTo(root, full), size: stat.size });
  }
  return out;
}

const tail = (text, lines) => text.trim().split("\n").filter((line) => !/ExperimentalWarning|--trace-warnings/.test(line)).slice(-lines).join("\n");
const pageName = (path) => path.replace(/^.*\//, "").replace(/\.html$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "page";
const consoleClean = (output) => /console: clean/.test(output) && !/net::ERR_|Failed to load resource|Refused to (?:load|connect)|blocked:/i.test(output);

export function locate(folderArg) {
  const folder = resolve(folderArg);
  const id = basename(folder);
  const author = basename(dirname(folder));
  const figures = dirname(dirname(folder));
  return { folder, id, author, inFigures: basename(figures) === "figures" };
}

export function validateFolder(folderArg, options = {}) {
  const { folder, id, author, inFigures } = locate(folderArg);
  const skillPath = resolve(options.skill ?? join(ROOT, ".skill"));
  const skill = existsSync(skillPath) ? realpathSync(skillPath) : skillPath;
  const mode = options.sandbox ?? (dockerReady() ? "docker" : "local");
  const errors = [];
  const notes = [];
  const step = (name, problems, detail) => {
    if (problems.length) errors.push(...problems.map((p) => `${name}: ${p}`));
    else notes.push(`${name}: ok${detail ? ` (${detail})` : ""}`);
    return problems.length === 0;
  };
  const result = () => ({ id: `${author}/${id}`, errors, notes, mode });

  if (!inFigures || !ID.test(id) || !/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/.test(author)) {
    errors.push(`location: a figure lives at figures/<author>/<id>/, lowercase (got ${relativeTo(ROOT, folder)})`);
    return result();
  }
  let figure;
  try {
    figure = JSON.parse(readFileSync(join(folder, "figure.json"), "utf8"));
  } catch (error) {
    errors.push(`figure.json: ${error.message}`);
    return result();
  }
  const schemaOk = step("schema", [...validateFigure(figure, { author, id, requireModel: options.contributor }), ...(options.contributor && figure.featured ? ["only maintainers set featured"] : [])]);

  const layout = [];
  const files = [];
  for (const name of readdirSync(folder)) if (!TOP_LEVEL.includes(name)) layout.push(`unexpected ${name} (allowed: ${TOP_LEVEL.join(", ")}; pages and the poster are built by CI, not committed)`);
  if (!existsSync(join(folder, "src"))) layout.push("src/ is missing");
  else for (const file of listFiles(join(folder, "src"))) {
    files.push(file);
    if (file.link) layout.push(`src/${file.path} is a symlink`);
    else if (!isSourceType(file.path)) layout.push(`src/${file.path}: file type not allowed`);
    else if (file.size > LIMITS.file) layout.push(`src/${file.path} is over ${LIMITS.file >> 20} MB`);
  }
  const total = listFiles(folder).reduce((sum, f) => sum + (f.size ?? 0), 0);
  if (total > LIMITS.folder) layout.push(`the folder is ${(total / 1048576).toFixed(2)} MB; the source may be at most ${LIMITS.folder >> 20} MB`);
  if (schemaOk) {
    for (const page of Object.values(figure.pages ?? {})) if (existsSync(join(folder, page))) layout.push(`${page} is committed: built pages are made by CI from the source; delete it`);
    for (const [script] of figure.build) if (!existsSync(join(folder, script))) layout.push(`build script ${script} does not exist`);
  }
  step("files", layout, `${(total / 1024).toFixed(0)} KB of source`);

  const acorn = loadParser();
  const safety = [];
  if (!acorn) {
    if (mode === "docker" || options.strict) safety.push("the JavaScript parser (acorn) is not available; the code analysis cannot run");
    else notes.push("analysis: skipped locally (acorn not installed); CI runs it");
  }
  for (const file of files) {
    if (file.link || !isSourceType(file.path) || file.size > LIMITS.file) continue;
    const text = readFileSync(join(folder, "src", file.path), "utf8");
    const path = `src/${file.path}`;
    safety.push(...scanText(path, text), ...checkImports(path, text, { folder, skill: join(dirname(dirname(dirname(folder))), ".skill") }));
    if (acorn && /\.m?js$/.test(file.path)) safety.push(...analyzeSource(path, text, acorn));
  }
  const safe = step("safety", [...new Set(safety)]);
  if (!schemaOk || !safe || errors.some((e) => e.startsWith("files:"))) return { ...result(), stopped: "fix the problems above first; nothing was run" };

  const kit = [];
  if (!existsSync(skill)) kit.push("no .skill: run node scripts/skill.mjs <figure folder> first");
  else if (fingerprintOfSkill(skill) !== figure.skill.kit) kit.push(`.skill has kit ${fingerprintOfSkill(skill)}, the figure needs ${figure.skill.kit}`);
  if (!step("skill", kit)) return result();
  if (mode !== "docker") notes.push("sandbox: local mode, the build is NOT network-isolated; CI runs it in the locked container");
  if (options.requireDocker && mode !== "docker") {
    errors.push("sandbox: the locked container is required (build it with docker build -t microscope-sandbox:local sandbox)");
    return result();
  }

  const rel = `figures/${author}/${id}`;
  let pages = figure.pages ? Object.entries(figure.pages) : null;
  const builds = [];
  const work = [];
  const build = [];
  for (let round = 0; round < 2; round++) {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "microscope-check-")));
    work.push(workspace);
    cpSync(folder, join(workspace, rel), { recursive: true });
    if (mode !== "docker") symlinkSync(skill, join(workspace, ".skill"), process.platform === "win32" ? "junction" : "dir");
    const before = new Map(listFiles(join(workspace, rel, "src")).map((f) => [f.path, readFileSync(join(workspace, rel, "src", f.path))]));
    for (const command of figure.build) {
      const run = runSandboxed({ mode, workspace, skill, cwd: rel, args: command, timeout: (options.buildTimeout ?? 600) * 1000, locked: [`${rel}/src`] });
      if (run.code !== 0) build.push(`${command.join(" ")} failed${run.timedOut ? " (timed out)" : ""}:\n${tail(run.output, 12)}`);
    }
    if (build.length) break;
    const produced = new Map();
    for (const file of listFiles(join(workspace, rel, "src"))) {
      const bytes = readFileSync(join(workspace, rel, "src", file.path));
      if (!before.has(file.path)) produced.set(`src/${file.path}`, bytes);
      else if (!before.get(file.path).equals(bytes)) build.push(`the build changed its own source src/${file.path}`);
    }
    for (const path of before.keys()) if (!existsSync(join(workspace, rel, "src", path))) build.push(`the build deleted src/${path}`);
    if (!pages) {
      const html = [...produced.keys()].filter((path) => path.endsWith(".html")).sort();
      for (const path of produced.keys()) if (!path.endsWith(".html")) build.push(`the build wrote ${path}; it may only write .html pages`);
      if (!html.length) build.push("the build wrote no .html page");
      if (html.length > 6) build.push(`the build wrote ${html.length} pages; at most 6`);
      const names = new Map();
      for (const path of html) {
        let name = pageName(path);
        while (names.has(name)) name = `${name}-2`;
        names.set(name, path);
      }
      pages = [...names.entries()];
    } else {
      for (const path of produced.keys()) if (!pages.some(([, page]) => page === path)) build.push(`the build wrote ${path}, which is not one of its pages`);
      for (const [key, page] of pages) if (!produced.has(page)) build.push(`the build did not write pages.${key} ${page}`);
    }
    builds.push(produced);
    if (build.length) break;
  }
  if (!build.length && builds.length === 2) {
    const first = [...builds[0].keys()].sort().join(",");
    const second = [...builds[1].keys()].sort().join(",");
    if (first !== second) build.push(`the two builds wrote different files (${first} / ${second}): the build must be deterministic`);
    else for (const [, page] of pages) if (!builds[0].get(page).equals(builds[1].get(page))) build.push(`${page} came out different on a second build: the build must be deterministic (no randomness, clocks or environment)`);
  }
  step("build", [...new Set(build)], mode === "docker" ? "built twice in the locked container, identical" : "built twice, identical");

  const output = [];
  if (!build.length) for (const [key, page] of pages) {
    const bytes = builds[0].get(page);
    if (bytes.length > LIMITS.page) output.push(`${page} is ${(bytes.length / 1048576).toFixed(1)} MB, over ${LIMITS.page >> 20} MB`);
    const html = bytes.toString("utf8");
    output.push(...scanText(page, html));
  }
  const outputOk = !build.length && step("output", [...new Set(output)]);

  if (outputOk && figure.audit && !options.skipAudit) {
    const [script, ...flags] = figure.build[0];
    const audit = runSandboxed({ mode, workspace: work[0], skill, cwd: rel, args: [script, ...flags.filter((f) => f !== "--light"), "--audit"], timeout: (options.auditTimeout ?? 2700) * 1000, locked: [`${rel}/src`] });
    step("audit", audit.code === 0 && /\baudit passed\b/.test(audit.output) ? [] : [`--audit did not end with "audit passed":\n${tail(audit.output, 15)}`]);
  } else if (figure.audit) notes.push("audit: skipped");

  if (outputOk && !options.noBrowser) {
    const browser = [];
    const out = resolve(options.out ?? join(ROOT, "shots", `${author}-${id}`));
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    for (const [key, page] of pages) {
      const target = `/work/${rel}/${page}`;
      const lines = runSandboxed({ mode, workspace: work[0], skill, out, cwd: rel, args: ["/work/.skill/scripts/lines.mjs", target, "--reduced"], timeout: 180000 });
      if (lines.code !== 0) browser.push(`line check on ${page} (with reduced motion):\n${tail(lines.output, 10)}`);
      else if (!consoleClean(lines.output)) browser.push(`${page} logged errors in the browser (a blocked network request or a script error):\n${tail(lines.output, 8)}`);
      const shot = runSandboxed({ mode, workspace: work[0], skill, out, cwd: rel, args: ["/work/.skill/scripts/capture.mjs", target, "--reduced", "--width", "1200", "--times", "1500", "--out", `/out/${key}.png`], timeout: 180000 });
      if (shot.code !== 0) browser.push(`screenshot of ${page} failed:\n${tail(shot.output, 6)}`);
      else if (!existsSync(join(out, `${key}.png`)) || !existsSync(join(out, `${key}-1500.png`))) browser.push(`screenshot of ${page} produced no image`);
      else {
        const moved = changedFraction(readFileSync(join(out, `${key}.png`)), readFileSync(join(out, `${key}-1500.png`)));
        if (moved.fraction > STILL) browser.push(`${page} keeps moving with reduced motion on (${moved.changed} pixels changed in 1.5 s): a figure must hold one still pose when prefers-reduced-motion is set`);
        else rmSync(join(out, `${key}-1500.png`));
      }
      writeFileSync(join(out, basename(page)), builds[0].get(page));
    }
    const chosen = figure.preview ?? (pages.some(([name]) => name === "light") ? "light" : pages[0][0]);
    if (existsSync(join(out, `${chosen}.png`))) cpSync(join(out, `${chosen}.png`), join(out, "poster.png"));
    const cardPage = pages.find(([name]) => name === "light")?.[1] ?? pages[0][1];
    if (!browser.length) {
      writeFileSync(join(out, "live.html"), builds[0].get(cardPage));
      const made = runSandboxed({ mode, workspace: work[0], skill, out, tools: join(ROOT, "scripts"), cwd: rel, args: ["/work/.tools/card.mjs", `/work/${rel}/${cardPage}`, "--out", "/out/card.png"], timeout: 180000 });
      if (made.code !== 0 || !existsSync(join(out, "card.png"))) notes.push(`card: not made, the gallery falls back to the poster (${tail(made.output, 1).trim()})`);
    }
    writeFileSync(join(out, "pages.json"), JSON.stringify(Object.fromEntries(pages)));
    step("browser", browser, `screenshots, poster and built pages in ${relativeTo(ROOT, out) || out}`);
  } else if (options.noBrowser) notes.push("browser: skipped");

  for (const workspace of work) rmSync(workspace, { recursive: true, force: true });
  return result();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0].startsWith("--")) {
    console.error("usage: node scripts/validate.mjs figures/<author>/<id> [--contributor] [--docker|--local] [--require-docker] [--out dir] [--no-browser] [--skip-audit]");
    process.exit(1);
  }
  const at = argv.indexOf("--out");
  const sandbox = argv.includes("--docker") ? "docker" : argv.includes("--local") ? "local" : undefined;
  const res = validateFolder(argv[0], { contributor: argv.includes("--contributor"), sandbox, requireDocker: argv.includes("--require-docker"), strict: argv.includes("--require-docker"), noBrowser: argv.includes("--no-browser"), skipAudit: argv.includes("--skip-audit"), out: at >= 0 ? argv[at + 1] : undefined });
  console.log(`figure ${res.id}  [sandbox: ${res.mode}]`);
  for (const note of res.notes) console.log(`  ✓ ${note}`);
  for (const error of res.errors) console.log(`  ✗ ${error.replace(/\n/g, "\n      ")}`);
  if (res.stopped) console.log(`  ${res.stopped}`);
  console.log(res.errors.length ? `failed: ${res.errors.length} problem${res.errors.length === 1 ? "" : "s"}` : "passed");
  process.exit(res.errors.length ? 1 : 0);
}
