export const MAINTAINERS = ["OWNER", "MEMBER", "COLLABORATOR"];

export function scopeProblems({ files, login, association }) {
  if (MAINTAINERS.includes(association)) return [];
  const own = `figures/${String(login).toLowerCase()}/`;
  const problems = [];
  for (const file of files) {
    const path = file.filename;
    if (file.status === "removed") problems.push(`${path}: contributors cannot delete files; ask a maintainer`);
    else if (file.previous_filename && !file.previous_filename.startsWith(own)) problems.push(`${file.previous_filename}: contributors can only change their own figures, under ${own}`);
    else if (!path.startsWith(own)) problems.push(`${path}: contributors can only add or change files under ${own}`);
  }
  return problems;
}

if (process.argv[1]?.endsWith("scope-pr.mjs")) {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const text = Buffer.concat(chunks).toString().trim();
    const files = !text ? [] : text.startsWith("[") ? JSON.parse(text).flat() : text.split("\n").map((line) => JSON.parse(line));
    const login = process.env.PR_AUTHOR ?? "";
    const association = process.env.PR_ASSOCIATION ?? "";
    const problems = scopeProblems({ files, login, association });
    if (problems.length) {
      for (const problem of problems) console.error(`scope: ${problem}`);
      process.exit(1);
    }
    console.log(MAINTAINERS.includes(association) ? `scope: ${association.toLowerCase()}, any file may change` : `scope: ok, ${files.length} file${files.length === 1 ? "" : "s"} under figures/${login.toLowerCase()}/`);
  });
}
