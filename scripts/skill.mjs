import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprintOf, fingerprintOfSkill, KIT_FILES } from "./fingerprint.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, ".skill");
const CACHE = join(ROOT, ".skill-cache");
const REPO = "https://github.com/starhopp3r/microscope.git";

const git = (args, input) => execFileSync("git", ["-C", CACHE, ...args], { input, maxBuffer: 1 << 30 });

function fingerprintAt(commit) {
  const listing = git(["ls-tree", "-r", commit, "--", "kit", "scripts/inline-kit.mjs"]).toString().trim().split("\n").filter(Boolean);
  const files = listing.map((line) => {
    const [meta, path] = line.split("\t");
    return { path, blob: meta.split(" ")[2] };
  }).filter(({ path }) => KIT_FILES(path));
  if (!files.length) return null;
  const batch = git(["cat-file", "--batch"], files.map((file) => file.blob).join("\n") + "\n");
  const entries = [];
  let at = 0;
  for (const file of files) {
    const end = batch.indexOf(10, at);
    const size = Number(batch.subarray(at, end).toString().split(" ")[2]);
    entries.push([file.path, batch.subarray(end + 1, end + 1 + size)]);
    at = end + 1 + size + 1;
  }
  return fingerprintOf(entries);
}

function ensureCache() {
  if (!existsSync(join(CACHE, ".git"))) execFileSync("git", ["clone", "--quiet", "--filter=blob:none", REPO, CACHE], { stdio: "inherit" });
  else git(["fetch", "--quiet", "origin"]);
}

export function findCommit({ kit, commit }) {
  ensureCache();
  if (commit) {
    const found = fingerprintAt(commit);
    if (found !== kit) throw new Error(`skill.commit ${commit} has kit ${found}, not ${kit}`);
    return commit;
  }
  const commits = git(["log", "--format=%H", "origin/HEAD", "--", "kit", "scripts/inline-kit.mjs"]).toString().trim().split("\n").filter(Boolean);
  for (const candidate of commits) if (fingerprintAt(candidate) === kit) return candidate;
  throw new Error(`no published version of the skill has kit ${kit}; publish from a released skill, or add skill.commit`);
}

function extract(commit) {
  rmSync(SKILL, { recursive: true, force: true });
  mkdirSync(SKILL, { recursive: true });
  const archive = git(["archive", "--format=tar", commit]);
  execFileSync("tar", ["-x", "-C", SKILL], { input: archive });
  writeFileSync(join(SKILL, ".commit"), commit + "\n");
}

function linkLocal(path, kit) {
  const local = resolve(path);
  const found = fingerprintOfSkill(local);
  if (found !== kit) throw new Error(`the skill at ${local} has kit ${found}, not ${kit}`);
  if (existsSync(SKILL) || (() => { try { return lstatSync(SKILL).isSymbolicLink(); } catch { return false; } })()) rmSync(SKILL, { recursive: true, force: true });
  symlinkSync(local, SKILL, process.platform === "win32" ? "junction" : "dir");
  return local;
}

export function latest() {
  ensureCache();
  const commit = git(["rev-parse", "origin/HEAD"]).toString().trim();
  return { commit, kit: fingerprintAt(commit) };
}

const argv = process.argv.slice(2);
if (argv[0] === "--latest") {
  console.log(JSON.stringify(latest()));
} else if (argv[0] && !argv[0].startsWith("--")) {
  const folder = resolve(argv[0]);
  const figure = JSON.parse(readFileSync(join(folder, "figure.json"), "utf8"));
  const localAt = argv.indexOf("--local");
  try {
    if (localAt >= 0) console.log(`skill: linked ${linkLocal(argv[localAt + 1], figure.skill?.kit)} as .skill`);
    else {
      const commit = findCommit(figure.skill ?? {});
      extract(commit);
      console.log(`skill: ${commit.slice(0, 12)} extracted to .skill (kit ${figure.skill.kit.slice(7, 19)})`);
    }
  } catch (error) {
    console.error(`skill: ${error.message}`);
    process.exit(1);
  }
} else if (argv.length) {
  console.error("usage: node scripts/skill.mjs figures/<id> [--local path/to/microscope]");
  process.exit(1);
}
