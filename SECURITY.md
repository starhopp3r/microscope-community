# Security

Figures here are code from many people, so the checks that run them matter. If you find a way around them, please tell us privately first.

## Report a vulnerability

Use **Security → Report a vulnerability** on this repository (GitHub's private reporting). Please include:

- what the problem is and what it lets someone do;
- the steps or a minimal figure that shows it;
- which check or workflow is involved.

Don't open a public issue or pull request that demonstrates the problem. We aim to answer within a week and to fix serious problems before anything is made public, with credit to you if you'd like it.

## What counts

- Code that runs outside the locked sandbox, reaches the network, reads secrets or tokens, or writes outside its own figure folder.
- A pull request that changes anything outside the contributor's own folder and still passes Scope.
- Ways to make the checker, previews or submission bot run untrusted code with write access.
- Figures whose built pages can attack, track or mislead the people who view them while passing the checks.

## What's out of scope

- Problems that need a maintainer to merge something unreviewed.
- A figure that looks wrong but does no harm: use [Report a figure](../../issues/new?template=report-figure.yml).
