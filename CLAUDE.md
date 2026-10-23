# Working on polyjuice

## Language

- All documentation is written in English: `README.md`, everything under `docs/` and `spikes/`, commit messages, pull request titles and descriptions.
- The user interface is in French and German (its users are French and German speakers). French is the reference: every text lives in a catalog, `src/i18n/` for messages produced by the engine (warnings, reports, errors) and `src/app/messages/` for the interface, and any new or changed text must be added to both languages. When documentation quotes a UI label, keep the French label and gloss it in English the first time, e.g. the « Anonymiser » (anonymize) tab.
- Conversations with the maintainer are in French: short, plain and easy to follow.

## Interface text

The interface is translated: every UI string exists in each locale (today French and German). UI texts live in `src/app/messages/<locale>.tsx`, engine and adapter messages (warnings, reports) in `src/i18n/<locale>.ts`.

- Any task that adds or changes a user-facing string updates every locale in the same change, never French alone. The `UiMessages` and `Messages` types catch a missing key, not a stale translation: reread the other locales' wording too.
- Keep texts short. The interface should stay light: one idea per sentence, no repetition of what a label, a step title or a neighbouring text already says, details in a « En savoir plus » link or a collapsible rather than in always-visible help. Before finishing, reread every string you added or changed, in every locale, and cut what the user does not need to act.

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
