# Atlas GitHub Push Auth

Last verified: 2026-06-28

## Rule

Use SSH for Git pushes on Atlas.

```bash
git push origin main
```

Direct fallback:

```bash
git push git@github.com:Ayyitskevin/atlas.git main
```

## Current State

- Repo path: `/home/kevin-lee/ai-workspace/codex/atlas`
- GitHub repo: `Ayyitskevin/atlas`
- `origin` should be `git@github.com:Ayyitskevin/atlas.git`
- `origin/main` includes `22129ec` (`test: add foundation verification coverage`)
- Full verified remote head: `22129ece1b374ae89e814efe1737d3008921f2eb`

## Why

HTTPS push can fail when commits touch `.github/workflows/ci.yml` because the active GitHub OAuth token may have `repo` scope but not `workflow` scope. GitHub CLI workflow-scope refresh may also be blocked by API rate limits.

SSH auth has been verified separately and works for Git pushes.

## Security Boundary

Do not store tokens, one-time device codes, private key contents, or OAuth credentials in notes. This note intentionally records only non-secret operational routing guidance.
