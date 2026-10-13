import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTHOR } from "./changed.mjs";
import { checkPoster } from "./previews.mjs";
import { ID } from "./schema.mjs";

export const MARKER = "<!-- microscope-preview -->";

export function readPrNumber(artifact) {
  const file = join(artifact, "pr.txt");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8").trim();
  return /^[1-9]\d{0,6}$/.test(text) ? Number(text) : null;
}

export function collect(artifact) {
  const found = [];
  const problems = [];
  for (const author of readdirSync(artifact)) {
    if (!statSync(join(artifact, author)).isDirectory()) continue;
    for (const id of readdirSync(join(artifact, author))) {
      const poster = join(artifact, author, id, "poster.png");
      if (!AUTHOR.test(author) || !ID.test(id)) {
        problems.push(`${author}/${id}: not a figure folder name`);
        continue;
      }
      if (!existsSync(poster)) continue;
      const problem = checkPoster(readFileSync(poster));
      if (problem) problems.push(`${author}/${id}: poster ${problem}`);
      else found.push({ author, id, poster });
    }
  }
  return { found, problems };
}

export function commentBody({ number, found, conclusion, runUrl, repo }) {
  const status = conclusion === "success" ? "✅ All checks passed." : `❌ The checks did not pass (${conclusion}). See the [run](${runUrl}) for what failed.`;
  const images = found.map(({ author, id }) => `**${author}/${id}**\n\n<img src="https://github.com/${repo}/raw/pr-previews/pr/${number}/${author}/${id}.png" width="600" alt="Preview of ${author}/${id}">`).join("\n\n");
  return `${MARKER}\n### Preview\n\n${status}\n\n${images || "No preview was made: the figure did not get as far as the browser checks."}\n\nBuilt from this pull request's source in the locked sandbox, light theme. The built pages and screenshots are in the run's \`built\` artifact.`;
}

if (process.argv[1]?.endsWith("pr-preview.mjs")) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const artifact = arg("--artifact");
  const out = arg("--out");
  const number = readPrNumber(artifact);
  if (!number) {
    console.error("pr-preview: no valid pull request number in the artifact");
    process.exit(1);
  }
  const { found, problems } = collect(artifact);
  for (const problem of problems) console.log(`pr-preview: ${problem}`);
  for (const { author, id, poster } of found) {
    mkdirSync(join(out, "pr", String(number), author), { recursive: true });
    cpSync(poster, join(out, "pr", String(number), author, `${id}.png`));
  }
  writeFileSync(join(out, "number.txt"), String(number));
  writeFileSync(join(out, "comment.md"), commentBody({ number, found, conclusion: arg("--conclusion"), runUrl: arg("--run-url"), repo: arg("--repo") }));
  console.log(`pr-preview: PR #${number}, ${found.length} preview${found.length === 1 ? "" : "s"}`);
}
