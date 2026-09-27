# AGENTS.md

**Read [CLAUDE.md](./CLAUDE.md).** It is the single source of truth for how
we work on Loane: the product, the hard rules, the engineering standards,
and what is deliberately not built yet.

This file exists only because some tools look for `AGENTS.md` and others
look for `CLAUDE.md`. Keeping the guidance in one file means the two can
never drift apart and give two agents different instructions.

## If you are a second agent working in parallel

Do not work in the same folder as another agent. Use a git worktree so each
tool gets its own directory and its own branch:

```bash
npm run worktree -- <branch-name>
```

See [docs/parallel-agents.md](./docs/parallel-agents.md).
