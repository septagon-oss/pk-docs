# apps/antora

Antora pilot output for the federated PlatformKit docs contract.

The generated site is written to `apps/antora/dist/` by:

```bash
npm run docs:antora:build
```

The Antora content sources are generated from feature-local docs in
`pk-modules` and materialized into that repo under
`.generated/antora/` so Antora can consume them as a git-backed content source.
