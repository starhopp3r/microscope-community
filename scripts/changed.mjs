import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { ID } from "./schema.mjs";

export const AUTHOR = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;

export function figuresOf(paths) {
  const found = new Set();
  const bad = [];
  for (const path of paths) {
    if (!path.startsWith("figures/")) continue;
    const match = path.match(/^figures\/([^/]+)\/([^/]+)\//);
    if (!match) {
      bad.push(path);
      continue;
    }
    if (AUTHOR.test(match[1]) && ID.test(match[2])) found.add(`${match[1]}/${match[2]}`);
    else bad.push(`${match[1]}/${match[2]}`);
  }
  return { ids: [...found].sort(), bad: [...new Set(bad)] };
}

const dirs = (path) => (existsSync(path) ? readdirSync(path).filter((name) => statSync(`${path}/${name}`).isDirectory()) : []);

if (process.argv[1]?.endsWith("changed.mjs")) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--base");
  let paths;
  if (argv.includes("--all")) paths = dirs("figures").flatMap((author) => dirs(`figures/${author}`).map((id) => `figures/${author}/${id}/`));
  else if (at >= 0) paths = execFileSync("git", ["diff", "--name-only", "--no-renames", `${argv[at + 1]}...HEAD`]).toString().split("\n").filter(Boolean);
  else {
    console.error("usage: node scripts/changed.mjs --base <sha> | --all");
    process.exit(1);
  }
  const { ids, bad } = figuresOf(paths);
  if (bad.length) {
    console.error(`figures live at figures/<author>/<id>/, lowercase: ${bad.join(", ")}`);
    process.exit(1);
  }
  for (const id of ids) if (existsSync(`figures/${id}/figure.json`)) console.log(id);
}
