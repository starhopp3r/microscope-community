<h1 align="center">Microscope community</h1>

<p align="center"><b>Figures the community made with <a href="https://github.com/starhopp3r/microscope">Microscope</a>.</b><br>Biology figures: molecules, cells, microbes, plants and animals, each built as a precise, working model of the real specimen.</p>

<p align="center">
  <a href="https://github.com/starhopp3r/microscope-community/tree/previews"><img src="https://github.com/starhopp3r/microscope-community/raw/previews/latest/1.webp" width="32%" alt="Newest figure"></a>
  <a href="https://github.com/starhopp3r/microscope-community/tree/previews"><img src="https://github.com/starhopp3r/microscope-community/raw/previews/latest/2.webp" width="32%" alt="Second newest figure"></a>
  <a href="https://github.com/starhopp3r/microscope-community/tree/previews"><img src="https://github.com/starhopp3r/microscope-community/raw/previews/latest/3.webp" width="32%" alt="Third newest figure"></a>
  <a href="https://github.com/starhopp3r/microscope-community/tree/previews"><img src="https://github.com/starhopp3r/microscope-community/raw/previews/latest/4.webp" width="32%" alt="Fourth newest figure"></a>
  <a href="https://github.com/starhopp3r/microscope-community/tree/previews"><img src="https://github.com/starhopp3r/microscope-community/raw/previews/latest/5.webp" width="32%" alt="Fifth newest figure"></a>
  <a href="https://github.com/starhopp3r/microscope-community/tree/previews"><img src="https://github.com/starhopp3r/microscope-community/raw/previews/latest/6.webp" width="32%" alt="Sixth newest figure"></a>
</p>

<p align="center"><b><a href="https://github.com/starhopp3r/microscope-community/tree/previews">Browse every figure →</a></b><br>newest first, all of them page by page, by author and by kind</p>

## What this is

A shared collection of biology figures made with the Microscope skill, in any theme and colours. Each figure is stored as its **source**: the `build.mjs` the skill wrote, plus a `figure.json` that says who made it, with what prompt and with which skill version. There are no built pages or images in `main`.

Because every Microscope figure rebuilds byte for byte from its source, CI rebuilds each one on every check, in a locked sandbox, and makes the pages and the preview image itself. The previews live on the [`previews`](https://github.com/starhopp3r/microscope-community/tree/previews) branch, which CI rewrites after every merge. Next to each preview, CI also makes a **card**: the light page photographed again with its frame, corner text, legend and controls hidden, the drawing fitted to the same 1600×1200 frame on one ground, so every figure sits at the same size in a gallery. The light page itself is kept too, under `live/`, so a site can let people play with the figure in a sandboxed frame. For sites that show the collection, that branch also has a small `index.json` (counts, kinds, popular tags), `feed/page-N.json` (48 figures a page, newest first), `feed/search.json` (every figure, short form) and `feed/figures/<author>/<id>.json` (one figure in full), so no file grows past a couple of megabytes however many figures there are. `BUILT_FROM` records the last `main` commit it was built from, so each run builds everything merged since, and a full rebuild runs in batches of 30 that start each other.

```
figures/<author>/<id>/
  figure.json      title, author, prompt, kind, agent, skill version, license
  src/build.mjs    the source the skill wrote, plus any helper files it reads
  README.md        optional: the idea, in a few lines
```

## Upload a figure

There are two ways. Neither needs you to fork or use git by hand.

### With your agent (Claude Code, OpenCode, Codex or Antigravity)

**You need** the [Microscope skill](https://github.com/starhopp3r/microscope) in a version with `scripts/publish.mjs`, and the [GitHub CLI](https://cli.github.com/) signed in (`gh auth login`). [Docker](https://www.docker.com/) is optional, for running the same locked checks before you send.

1. **Make your figure** with Microscope, as usual: `/microscope show how stomata open and close in a leaf, interactive`. The gallery takes **plain HTML** figures (a `build.mjs` that writes standalone pages), in any theme and colours.
2. **Ask your agent:** *"publish this figure to the Microscope community gallery"*. It asks for a title, a short id and your GitHub name, then shows exactly what it will send.
3. **Say yes.** It opens the pull request for you and gives you the link. If you don't have push access, it makes a fork for you first.

Or run the same thing yourself, from a clone of this repository (`gh repo clone starhopp3r/microscope-community -- --single-branch`, which leaves out the previews branch and its images):

```sh
node <microscope skill folder>/scripts/publish.mjs <your figure folder> --into . \
  --id stomata-leaf-block --title "Stomata in a leaf block" --author <your-github-name> \
  --prompt "/microscope show how stomata open and close in a leaf, interactive" --submit
```

It copies **only the source** into `figures/<your-github-name>/stomata-leaf-block/`, records which skill version made it, checks it builds, saves a quick preview to `shots/`, then asks before it pushes and opens the pull request. `--dry-run` shows the plan without doing anything; `--force` sends an updated version to the same pull request.

To run the CI checks on your machine first:

```sh
docker build --platform linux/amd64 -t microscope-sandbox:local sandbox
node scripts/validate.mjs figures/<your-github-name>/stomata-leaf-block
```

### Without a terminal: the form

1. Put your figure's source files in a [GitHub Gist](https://gist.github.com/) under your own account: `build.mjs`, plus any file it reads (`live.js`, a `.css`, …). Leave out the built `.html` pages.
2. Open a [**Submit a figure**](https://github.com/starhopp3r/microscope-community/issues/new?template=submit-figure.yml) issue, and fill in the Gist link, an id, a title and the prompt.
3. A bot puts the files in the right folder, opens the pull request for you and links it in a comment. If something's missing, it says what; edit the issue to try again.

### Then

The checks run on the pull request (next section). When they finish, a comment shows the preview CI made of your figure. A maintainer reviews and merges, and your figure appears on the [`previews`](https://github.com/starhopp3r/microscope-community/tree/previews) branch and, while it is among the six newest, at the top of this page.

## What happens to your pull request

Your figure's `build.mjs` is code from someone else, so it is checked before it runs, and it runs where it can't reach anything.

| | Check | What it does |
|---|---|---|
| 1 | **Scope** | Runs from `main`, never from your pull request. It reads the list of changed files and fails unless every file is under `figures/<your-github-name>/`: no deletions, no changes to CI, scripts or other people's figures. |
| 2 | **Files** | `figure.json` is complete and matches its folder; only source files (`.mjs`, `.js`, `.css`, `.html`, `.json`, `.md`, `.txt`, `.svg`), at most 1 MB each and 2 MB in all; no built pages, no images, no symlinks. |
| 3 | **Code analysis** | Every source file is parsed and refused if it reaches the network, environment variables, cookies, other windows, `eval` or `Function`, by any route however disguised, or imports anything except the skill, its own files, `node:fs`, `node:path`, `node:url`, `node:crypto` and `node:process`. |
| 4 | **Skill version** | The exact Microscope version that made the figure is found from its kit fingerprint, and that version is used. |
| 5 | **Locked build** | The build runs **twice** in a pinned container (Node 22.23.3, Chrome for Testing 155) with no network, a read-only system, no privileges, limited memory, processes and time, and write access only to its own `src/`. Both runs must write the same `.html` pages (the ones listed in `figure.json`, or whatever the build writes if none are listed) and nothing else, byte for byte the same. |
| 6 | **Output** | The built pages get the same safety scan, so a payload the source hides is still caught. Each page is at most 4 MB. |
| 7 | **Browser** | Chrome loads every page in the same locked container. The skill's line check must pass, nothing may try to load from outside, and the figure must hold still with reduced motion on. |
| 8 | **Preview** | The page named in `preview` (or the light page, or the first one) becomes the poster and the preview posted on your pull request. |

The checker always comes from `main`, never from the pull request. Figure code only ever runs inside the sandbox, with a read-only token and no secrets, and the jobs that write previews never run figure code. A check takes about 2 minutes for a simple figure and 10–20 for a heavy one with `--audit`.

## Run the tests yourself

The repository tests its own checker, including planted attacks that every check must catch:

```sh
node --test scripts/units.test.mjs
node scripts/skill.mjs figures/starhopp3r/atp-synthase
node --test scripts/validate.test.mjs
```

The second test file uses the Docker sandbox when it's there (build it as in step 4) and runs its sandbox-escape tests only then. The code-analysis tests need `acorn` on `NODE_PATH`:

```sh
npm install --prefix /tmp/microscope-tools acorn@8.19.0
NODE_PATH=/tmp/microscope-tools/node_modules node --test scripts/units.test.mjs
```

## Rules in short

Your own work, in your own folder, under MIT or CC-BY-4.0. A real object built from many small precise parts, not boxes and arrows, and every number it shows is true. Plain HTML, any theme. Deterministic, still under reduced motion, and nothing that talks to the outside. [CONTRIBUTING.md](CONTRIBUTING.md) has the full rules and every field of `figure.json`.

## Reporting and takedowns

- A figure that's copied, unsafe, abusive or broken: [Report a figure](https://github.com/starhopp3r/microscope-community/issues/new?template=report-figure.yml).
- A security problem in the checks: privately, as [SECURITY.md](SECURITY.md) explains.
- Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md).

To take a figure down, a maintainer deletes its folder in a pull request. After the merge, the Previews workflow drops its preview and its place in the index on its own.

## For maintainers

- Protect `main`: require a pull request with a review, and require the **Scope** and **Check figures** checks.
- In Actions settings: require approval before workflows run for outside contributors, and allow GitHub Actions to create pull requests (the form's bot opens them).
- Turn on "Automatically delete head branches" (Settings → General), so merged branches go away; submission branches are deleted by CI when their pull request closes.
- Turn on private vulnerability reporting (Settings → Code security), which SECURITY.md relies on, and create a `report` label for the report form.
- Optional: secrets `SITE_REVALIDATE_URL` (the site's `/api/revalidate`, e.g. `https://<your site>/api/revalidate`) and `SITE_REVALIDATE_SECRET` (the site's `REVALIDATE_SECRET`), so the gallery refreshes a minute after each merge instead of within five.
- Optional: a secret `MICROSCOPE_GIST_TOKEN` (a token with no scopes is enough) lifts the 60-an-hour limit on reading gists for the submit form.
- The form needs a `submission` label: `gh label create submission -R starhopp3r/microscope-community --color 0E8A16 --description "Figure submitted through the form"`.
- The **Previews** workflow can be run by hand (Actions → Previews → Run workflow) to rebuild every preview.

## License

MIT, unless a figure's `figure.json` says `CC-BY-4.0`. Every figure credits its author.
