# Running two AI tools at once

## The problem this solves

On 27 Sep, Claude and Codex were both pointed at
`~/Desktop/Loane-code` at the same time. Codex committed its work to a
branch called `admin-dashboard` and left the folder sitting on that branch.
Claude's half-finished Phase 1 work was loose in the same folder, so it was
about to be committed to the wrong branch.

Nothing was lost that time, because the two happened to touch different
folders. Next time they might not.

**One folder, one agent.** If you want two agents working at once, give each
one its own folder.

## How to do it

A **git worktree** is a second folder that shares the same project history
but sits on its own branch. Same repo, two desks.

### Starting a second agent

From the main folder:

```bash
npm run worktree -- listings
```

That creates `~/Desktop/Loane-code-listings`, on a new branch called
`listings`, starting from whatever `main` is right now.

Then:

```bash
cd ~/Desktop/Loane-code-listings && npm install
```

Each folder needs its own `node_modules` — they aren't shared.

Now open **that folder** in the second tool. The two agents cannot touch the
same files, cannot switch each other's branch, and cannot commit over each
other.

### Finishing up

The second agent commits and pushes its branch as normal. You review it,
merge it into `main` on GitHub, then clean up the extra folder:

```bash
npm run worktree:remove -- listings
```

That deletes the folder only. The branch and every commit stay.

## Rules of thumb

- **Main folder = the main line of work.** Keep `~/Desktop/Loane-code` on
  `main` and use it for whatever you consider the primary task.
- **One worktree per parallel task**, named after the work: `listings`,
  `admin-dashboard`, `payments`.
- **Give the two agents non-overlapping work.** Worktrees stop them
  clobbering each other's files, but if both edit `shared/src/brand.ts` you
  still get a merge conflict later. Split by folder where you can — one on
  `mobile/`, one on `admin/`.
- **`shared/` is the shared spine.** If a task needs to change a type in
  `shared/`, it should be the only task doing so at that moment.
- **Check the branch before you trust a commit.** `git branch --show-current`
  answers "where am I?" in one line.

## If it goes wrong anyway

Uncommitted work follows you between branches; it is not tied to one. So if
you find yourself on the wrong branch with good work in progress:

```bash
git stash push -u -m "work in progress"
```

```bash
git switch main
```

```bash
git stash pop
```

Park it, move, unpark it. If the last step fails, the stash still holds
everything — nothing is lost.

## Agent instruction files

`CLAUDE.md` is the single source of truth. `AGENTS.md` is a short pointer to
it, because different tools look for different filenames. Do not let the two
grow into separate copies — two agents reading two different sets of rules
is exactly how this goes wrong.
