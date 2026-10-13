import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTHOR } from "./changed.mjs";
import { decodePng } from "./png.mjs";
import { ID, validateFigure } from "./schema.mjs";

export const PREVIEW_LIMIT = 400 << 10;
export const POSTER_LIMIT = 1536 << 10;
export const LIVE_LIMIT = 4 << 20;

export const isPage = (bytes) => bytes.length <= LIVE_LIMIT && /^\s*<!doctype html>/i.test(bytes.subarray(0, 64).toString("utf8"));

export const isWebp = (bytes) => bytes.length > 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";

export function checkPoster(bytes) {
  if (bytes.length > POSTER_LIMIT) return "over 1.5 MB";
  try {
    const { width, height } = decodePng(bytes);
    if (width < 200 || height < 150 || width > 4000 || height > 4000) return `${width}×${height} is outside the expected size`;
  } catch (error) {
    return error.message;
  }
  return null;
}

export const escapeText = (text) => String(text).replace(/[\\`*_{}\[\]()<>#+!|~&"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\r?\n/g, " ");

export const PER_PAGE = 100;
export const ON_FRONT = 48;
export const LATEST = 6;
export const KINDS = { "SVG": "svg", "SVG + WebGL": "webgl", "SVG + 3D": "3d", "SVG + WebGL + 3D": "webgl-3d" };

const folderOf = (f) => `${f.author.toLowerCase()}/${f.id}`;
const newestFirst = (list) => list.slice().sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "") || folderOf(a).localeCompare(folderOf(b)));

function table(figures, { repo, up }) {
  const rows = figures.map((f) => `| <a href="https://github.com/${repo}/tree/main/figures/${folderOf(f)}"><img src="${up}previews/${folderOf(f)}.webp" width="360" alt="${escapeText(f.title)}"></a> | **${escapeText(f.title)}**<br>by [@${escapeText(f.author)}](${up}by-author/${f.author.toLowerCase()}.md)<br>${escapeText(f.kind)} · ${escapeText(f.agent)} · ${escapeText(f.created)} |`);
  return `| Preview | Figure |\n|---|---|\n${rows.join("\n")}\n`;
}

const NOTE = "Written by CI after every merge to `main`: each preview is the light page of the figure, built from its source in the locked sandbox. Don't edit this branch by hand.";

export function indexPages(figuresIn, { repo }) {
  const figures = newestFirst(figuresIn);
  const pages = new Map();
  const total = Math.max(1, Math.ceil(figures.length / PER_PAGE));
  const nav = (up) => `[Newest](${up}README.md) · [All figures](${up}all/1.md) · By kind: ${Object.entries(KINDS).filter(([kind]) => figures.some((f) => f.kind === kind)).map(([kind, slug]) => `[${kind}](${up}by-kind/${slug}.md)`).join(" · ") || "none yet"}`;
  pages.set("README.md", `# Microscope community: figures\n\n${NOTE}\n\n${figures.length} figure${figures.length === 1 ? "" : "s"} from ${new Set(figures.map((f) => f.author.toLowerCase())).size} author${new Set(figures.map((f) => f.author.toLowerCase())).size === 1 ? "" : "s"}.\n\n${nav("")}\n\n## Newest\n\n${table(figures.slice(0, ON_FRONT), { repo, up: "" })}${figures.length > ON_FRONT ? `\n[See all ${figures.length} figures →](all/1.md)\n` : ""}`);
  for (let page = 1; page <= total; page++) {
    const slice = figures.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const links = [page > 1 ? `[← Page ${page - 1}](${page - 1}.md)` : null, `Page ${page} of ${total}`, page < total ? `[Page ${page + 1} →](${page + 1}.md)` : null].filter(Boolean).join(" · ");
    pages.set(`all/${page}.md`, `# All figures, page ${page} of ${total}\n\n${nav("../")}\n\n${links}\n\n${table(slice, { repo, up: "../" })}\n${links}\n`);
  }
  for (const author of new Set(figures.map((f) => f.author.toLowerCase()))) {
    const mine = figures.filter((f) => f.author.toLowerCase() === author);
    pages.set(`by-author/${author}.md`, `# Figures by @${escapeText(mine[0].author)}\n\n${nav("../")}\n\n${mine.length} figure${mine.length === 1 ? "" : "s"}.\n\n${table(mine, { repo, up: "../" })}`);
  }
  for (const [kind, slug] of Object.entries(KINDS)) {
    const these = figures.filter((f) => f.kind === kind);
    if (these.length) pages.set(`by-kind/${slug}.md`, `# ${kind} figures\n\n${nav("../")}\n\n${these.length} figure${these.length === 1 ? "" : "s"}.\n\n${table(these, { repo, up: "../" })}`);
  }
  return pages;
}

export const FEED_PAGE = 48;
export const SNIPPET = 160;
export const FEED_TAGS = 50;
export const BAND_MIN = 6;

export function tokenBands(figures) {
  const spent = figures.map((f) => f.tokens).filter((t) => Number.isInteger(t) && t > 0).sort((a, b) => a - b);
  if (spent.length < BAND_MIN) return null;
  const at = (q) => spent[Math.min(spent.length - 1, Math.floor(q * spent.length))];
  return [at(1 / 3), at(2 / 3)];
}

const kindFlags = (kind) => ({ svg: kind === "SVG", webgl: kind.includes("WebGL"), "3d": kind.includes("3D") });

export function feedFiles(figuresIn, { branch, updated = new Date().toISOString() }) {
  const figures = newestFirst(figuresIn);
  const has = (dir, f, ext) => existsSync(join(branch, dir, f.author.toLowerCase(), `${f.id}.${ext}`));
  const card = (f) => ({
    id: f.id,
    author: f.author,
    title: f.title,
    snippet: f.prompt.length > SNIPPET ? `${f.prompt.slice(0, SNIPPET - 1).trimEnd()}…` : f.prompt,
    kind: f.kind,
    agent: f.agent,
    model: f.model ?? null,
    minutes: f.minutes ?? null,
    tokens: f.tokens ?? null,
    tags: f.tags ?? [],
    created: f.created,
    image: has("cards", f, "webp") ? `cards/${folderOf(f)}.webp` : `previews/${folderOf(f)}.webp`,
    framed: !has("cards", f, "webp"),
  });
  const cards = figures.map(card);
  const pages = Math.max(1, Math.ceil(cards.length / FEED_PAGE));
  const tags = new Map();
  for (const f of figures) for (const tag of f.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  const kinds = { svg: 0, webgl: 0, "3d": 0 };
  for (const f of figures) for (const [k, on] of Object.entries(kindFlags(f.kind))) if (on) kinds[k]++;
  const files = new Map();
  files.set("index.json", {
    version: 2,
    updated,
    total: cards.length,
    perPage: FEED_PAGE,
    pages,
    authors: new Set(figures.map((f) => f.author.toLowerCase())).size,
    models: new Set(figures.map((f) => f.model).filter(Boolean)).size,
    kinds,
    tags: [...tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, FEED_TAGS),
    tokenBands: tokenBands(figures),
  });
  for (let page = 1; page <= pages; page++) files.set(`feed/page-${page}.json`, { page, pages, figures: cards.slice((page - 1) * FEED_PAGE, page * FEED_PAGE) });
  files.set("feed/search.json", { figures: cards });
  figures.forEach((f, index) => {
    const near = (g) => ({ id: g.id, author: g.author, title: g.title });
    files.set(`feed/figures/${folderOf(f)}.json`, {
      ...cards[index],
      prompt: f.prompt,
      license: f.license,
      live: has("live", f, "html") ? `live/${folderOf(f)}.html` : null,
      source: `figures/${folderOf(f)}`,
      previous: figures.length > 1 ? near(figures[(index - 1 + figures.length) % figures.length]) : null,
      next: figures.length > 1 ? near(figures[(index + 1) % figures.length]) : null,
    });
  });
  return files;
}

export const latestOf = (figures) => newestFirst(figures).slice(0, LATEST);

function walk(dir, out = []) {
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function publishPreviews({ artifact, branch, figuresFile, repo }) {
  const figures = JSON.parse(readFileSync(figuresFile, "utf8")).filter((f) => !validateFigure(f).length && AUTHOR.test(f.author.toLowerCase()) && ID.test(f.id));
  const wanted = new Set(figures.map((f) => `${f.author.toLowerCase()}/${f.id}`));
  const problems = [];
  let copied = 0;
  for (const author of existsSync(artifact) ? readdirSync(artifact) : []) {
    if (!statSync(join(artifact, author)).isDirectory()) continue;
    for (const id of readdirSync(join(artifact, author))) {
      const folder = `${author}/${id}`;
      if (!AUTHOR.test(author) || !ID.test(id) || !wanted.has(folder)) {
        problems.push(`${folder}: not a figure on main, skipped`);
        continue;
      }
      for (const [file, dir, ext, ok, rule] of [
        ["preview.webp", "previews", "webp", (b) => isWebp(b) && b.length <= PREVIEW_LIMIT, "a WebP under 400 KB"],
        ["card.webp", "cards", "webp", (b) => isWebp(b) && b.length <= PREVIEW_LIMIT, "a WebP under 400 KB"],
        ["live.html", "live", "html", isPage, "an HTML page under 4 MB"],
      ]) {
        const from = join(artifact, author, id, file);
        if (!existsSync(from)) continue;
        if (!ok(readFileSync(from))) {
          problems.push(`${folder}: ${file} is not ${rule}, skipped`);
          continue;
        }
        mkdirSync(join(branch, dir, author), { recursive: true });
        cpSync(from, join(branch, dir, author, `${id}.${ext}`));
        if (dir === "previews") copied++;
      }
    }
  }
  for (const dir of ["previews", "cards", "live"]) for (const file of walk(join(branch, dir))) {
    const match = file.slice(join(branch, dir).length + 1).match(/^([^/]+)\/([^/]+)\.(?:webp|html)$/);
    if (!match || !wanted.has(`${match[1]}/${match[2]}`)) rmSync(file);
  }
  const shown = figures.filter((f) => existsSync(join(branch, "previews", f.author.toLowerCase(), `${f.id}.webp`)));
  for (const dir of ["all", "by-author", "by-kind", "latest"]) rmSync(join(branch, dir), { recursive: true, force: true });
  for (const [path, text] of indexPages(shown, { repo })) {
    mkdirSync(join(branch, path, ".."), { recursive: true });
    writeFileSync(join(branch, path), text);
  }
  rmSync(join(branch, "feed"), { recursive: true, force: true });
  for (const [path, data] of feedFiles(shown, { branch })) {
    mkdirSync(join(branch, path, ".."), { recursive: true });
    writeFileSync(join(branch, path), JSON.stringify(data) + "\n");
  }
  const latest = latestOf(shown);
  if (latest.length) {
    mkdirSync(join(branch, "latest"), { recursive: true });
    for (let slot = 0; slot < LATEST; slot++) {
      const f = latest[slot % latest.length];
      cpSync(join(branch, "previews", f.author.toLowerCase(), `${f.id}.webp`), join(branch, "latest", `${slot + 1}.webp`));
    }
  }
  return { copied, shown: shown.length, problems };
}

if (process.argv[1]?.endsWith("previews.mjs")) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const result = publishPreviews({ artifact: arg("--artifact"), branch: arg("--branch"), figuresFile: arg("--figures"), repo: arg("--repo") });
  for (const problem of result.problems) console.log(`previews: ${problem}`);
  console.log(`previews: ${result.copied} updated, ${result.shown} in the index`);
}
