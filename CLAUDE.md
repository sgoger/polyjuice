# Working on polyjuice

## Language

- All documentation is written in English: `README.md`, everything under `docs/` and `spikes/`, commit messages, pull request titles and descriptions.
- The user interface stays in French (its users are French speakers). When documentation quotes a UI label, keep the French label and gloss it in English the first time, e.g. the « Anonymiser » (anonymize) tab.
- Conversations with the maintainer are in French: short, plain and easy to follow.

## One worktree per session

Several sessions may run on this repository at the same time. To avoid collisions (one session switching branches, stashing or overwriting files under another), each session works in its own git worktree, never directly in the main checkout.

- At the start of a session, create a worktree from an up-to-date `main` with its own branch, under `.claude/worktrees/` (ignored by git):
  ```bash
  git fetch origin
  git worktree add .claude/worktrees/<topic> -b <type>/<topic> origin/main
  cd .claude/worktrees/<topic> && npm ci
  ```
  In Claude Code, `EnterWorktree` does the same thing.
- Make all edits, commits, tests and pushes from that worktree. Leave the main checkout and other sessions' worktrees alone.
- To resume an existing branch, add a worktree for it (`git worktree add .claude/worktrees/<topic> <branch>`) rather than switching branches in a shared folder.
- Once the branch is merged or abandoned, remove the worktree: `git worktree remove .claude/worktrees/<topic>`.
