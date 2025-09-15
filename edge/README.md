# Spell Edge (Cloudflare Workers)

This worker exposes the `/api/v1/*` endpoints, Stripe webhook, and bridges to GitHub Actions in `workflow` mode.

## Workflow Mode (GitHub Actions) — Setup

Prereqs:
- A GitHub App installed on the target repo with minimal permissions:
  - Repository permissions: `Actions: Read & write`, `Contents: Read`
- The repo and workflow exist:
  - owner/repo: `NishizukaKoichi/Spell`
  - workflow_id: `spell-run.yml`

Configure environment:
- Add vars in `edge/wrangler.toml`:
  - `GITHUB_APP_ID` (numeric)
  - `GITHUB_API_BASE=https://api.github.com`
- Add secrets (wrangler secrets recommended):
  - `GITHUB_APP_PRIVATE_KEY` (PKCS#8 PEM; BEGIN PRIVATE KEY)

You can also copy examples from:
- `edge/.env.example` (non-secret vars)
- `edge/secrets.env.example` (secrets template)

Set secrets via helper script:

```
pnpm cf:secrets
```

Verify:

```
# Dry-run deploy to compile the worker
npx -y wrangler -c edge/wrangler.toml deploy --dry-run
```

## API Snippet (dispatch)

```
curl -X POST https://<host>/api/v1/spells/1:cast \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: test-idem-1' \
  --data '{"input":{"demo":true},"mode":"workflow"}' -i
```

Expected: `200` with `{ status:"queued" }` and a workflow run appears under the repo’s Actions.

## Notes
- The worker never logs JWTs or tokens. Installation tokens are short-lived and not persisted.
- PEM must be PKCS#8 (`BEGIN PRIVATE KEY`). PKCS#1 (`BEGIN RSA PRIVATE KEY`) is not supported.
