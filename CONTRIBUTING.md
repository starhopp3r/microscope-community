# Contributing a figure

By contributing you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

Thank you for sharing one. A figure here is a textbook-quality, interactive drawing of a biological structure or process, made with the [Microscope](https://github.com/starhopp3r/microscope) skill in Claude Code, OpenCode, Codex or Antigravity.

## What can be published

- **Plain HTML figures:** a build script (usually `build.mjs`) that writes standalone pages next to itself, as the skill's examples do. It is the one format the gallery takes: it rebuilds with no installs, runs sandboxed and can be checked line by line. React and Next.js figures can't be submitted; the gallery can offer React versions of every figure later, generated from the HTML.
- **Any theme:** one page or several, light, dark or your own colours. Name the one to show as the preview with `preview`, or the gallery uses the light page, else the first.
- **Your own work,** in your own folder, `figures/<your-github-name>/<id>/`, shared under the license you pick (MIT or CC-BY-4.0).
- **The skill's quality bar:** it looks like a figure from a good biology textbook, never like an engineering drawing: the real structure in soft, colour-coded shapes, membranes as bilayers, tinted compartments, labels with leader lines and process arrows. Every count, direction and number it shows is biologically true, and the caption names its sources.

## Steps

1. **Clone** this repository (`gh repo clone starhopp3r/microscope-community -- --single-branch`, which leaves out the previews branch and its images). You don't need to fork it yourself: `--submit` makes a fork for you if you need one. No terminal? Use the [Submit a figure](https://github.com/starhopp3r/microscope-community/issues/new?template=submit-figure.yml) form with a Gist instead.
2. **Build your figure** with the skill and check it looks right.
3. **Publish it into your clone.** Ask your agent ("publish this figure to the Microscope community gallery"), or run:

   ```sh
   node <microscope skill>/scripts/publish.mjs path/to/figure --into . --id <kebab-id> \
     --title "..." --author <your GitHub name> --prompt "the request that made it"
   ```

   Options: `--agent "Claude Code"|OpenCode|Codex|Antigravity|Other`, `--model "..."`, `--license MIT|CC-BY-4.0`, `--tags a,b`, `--audit` (for figures with pipes, cables or round parts), `--pages dark.html,light.html` (if it can't tell which pages are the figure).

   It copies only the source into `figures/<author>/<id>/src/`, points its kit imports at `.skill/`, records the skill's kit fingerprint, checks the build works, and removes the pages it built. It also links `.skill` to your installed skill (git ignores that link).
4. **Check it.** With [Docker](https://www.docker.com/) running, build the same locked sandbox CI uses, once:

   ```sh
   docker build --platform linux/amd64 -t microscope-sandbox:local sandbox
   ```

   Then:

   ```sh
   node scripts/validate.mjs figures/<author>/<id>
   ```

   It has to end with `passed`. Without Docker it still runs, but the build isn't network-isolated, and the code analysis needs `acorn` on `NODE_PATH`; CI runs everything. The built pages, the poster and screenshots go to `shots/<author>-<id>/`.
5. **Send it:** run the publish command again with `--submit` (it asks first; `--dry-run` only shows the plan). Or open the pull request yourself with the commands it printed. After the checks run, a comment on your pull request shows the preview CI made of your figure.

## figure.json

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | kebab-case, the same as the folder name |
| `title` | yes | at most 80 characters |
| `author` | yes | your GitHub username; the folder above `id` is the same name in lowercase |
| `prompt` | yes | the request that made the figure, at most 600 characters |
| `kind` | yes | `SVG`, `SVG + WebGL`, `SVG + 3D` or `SVG + WebGL + 3D` |
| `agent` | yes | `Claude Code`, `OpenCode`, `Codex`, `Antigravity` or `Other` |
| `model` | yes, for new figures | the model that drew it, like `Claude Opus 5.5`; the gallery shows it with its maker's mark |
| `minutes` | no | about how long the agent worked on it, in whole minutes, like `45`; the gallery shows it as the time to make |
| `tokens` | no | about how many tokens the agent used to make it, as a whole number, like `1200000`; the gallery shows it as 1.2M |
| `skill.kit` | yes | the kit fingerprint, written by the publish script |
| `skill.commit` | no | a skill commit with that kit, to skip the search |
| `build` | yes | 1 to 4 commands, each like `["src/build.mjs", "--light"]` |
| `pages` | no | the pages the build writes under `src/`, by name, like `{ "light": "src/a-light.html", "night": "src/a-night.html" }`; if left out, CI takes whatever `.html` pages the build writes |
| `preview` | no | the name of the page to use as the preview |
| `audit` | no | `true` runs the skill's `--audit` in CI |
| `license` | yes | `MIT` or `CC-BY-4.0` |
| `tags` | no | up to 8 kebab-case words |
| `created` | yes | `YYYY-MM-DD` |
| `featured` | no | set by maintainers only |

## Rules the checks enforce

- **Your folder only:** a pull request may only add or change files under `figures/<your-github-name>/`. It may not delete files or touch anything else.
- **Source only:** `figure.json`, an optional `README.md`, and `src/` with `.mjs`, `.js`, `.css`, `.html`, `.json`, `.md`, `.txt` or `.svg` files. No built pages, no poster, no symlinks. Each file at most 1 MB, the folder at most 2 MB; each built page at most 4 MB.
- **Safe code:** nothing may reach the network, environment variables, cookies, other windows or frames, or build code from strings (`eval`, `Function`, string timers), by any route, however it is spelled. Build scripts may import only the skill, files in their own folder and `node:fs`, `node:path`, `node:url`, `node:crypto` or `node:process`.
- **Writes only its pages:** the build may write the pages listed in `pages`, in its own `src/`, and nothing else.
- **Deterministic:** two builds must produce identical bytes. No randomness, clocks or environment.
- **Still under reduced motion:** with `prefers-reduced-motion` set, the figure holds one still pose, as the skill asks.
- **Clean in the browser:** the skill's line check passes on every page, and nothing tries to load from outside.

## Running the repository's own tests

```sh
node --test scripts/units.test.mjs
node scripts/skill.mjs figures/starhopp3r/atp-synthase && node --test scripts/validate.test.mjs
```
