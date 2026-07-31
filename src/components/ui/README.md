# UI Components

This directory contains **forks** of [shadcn/ui](https://ui.shadcn.com/) components. shadcn is a
copy-paste pattern, not a versioned npm package — these files were ejected from upstream and then
customized in place (relative imports, `rounded-ui`/`shadow-ui`/`border-ui` shape tokens,
`data-slot` attributes, occasional added props).

## Standards and Guidelines

### This folder is exclusively for forked shadcn/ui components

- **DO** keep customizations limited to our conventions (shape tokens, `data-slot`, relative imports).
- **DO NOT** create custom, non-shadcn components here — put those in `src/components/`.

### Adding a NEW component

```bash
npx shadcn@latest add <component-name>
```

Then apply our conventions (relative `../../lib/utils` import, `rounded-ui`/`shadow-ui` tokens) and
seed its merge baseline: `node .claude/skills/sync-shadcn/sync.mjs sync <component-name>`.

### Updating a component from upstream — use the 3-way merge

Because these files are customized in place, do **not** re-run `npx shadcn add` to update — it would
clobber our changes. Instead use the **`sync-shadcn`** skill, which 3-way merges upstream's changes
onto our fork while preserving customizations:

```bash
S=.claude/skills/sync-shadcn/sync.mjs
node $S status            # which primitives have drifted behind upstream
node $S sync button       # pull upstream updates into one fork (preserving our edits)
node $S diff button       # show exactly what we customized (baseline -> fork)
node $S advance button    # promote the baseline after a clean, verified merge
```

- **Customizations are preserved** because they live as the fork↔baseline diff; upstream's delta is
  replayed on top. Conflicts appear **only** where upstream changed a line we also customized.
- **After a merge**, run `pnpm lint && pnpm typecheck`. Lint is the safety net — it **errors** on any
  `@/*` import in this folder, catching an alias import pulled in from upstream.
- The pristine "last-known-good" baselines live in `../../../.shadcn-baseline/` (ignored by ESLint
  and TypeScript). See `.claude/skills/sync-shadcn/SKILL.md` for the full workflow, conflict handling,
  and the registry-URL gotcha (`new-york-v4`).

### Questions?

If you need custom UI components, create them in `src/components/` or another appropriate directory outside of this folder.
