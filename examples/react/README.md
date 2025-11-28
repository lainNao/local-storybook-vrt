# local-storybook-vrt React example

This is a simple React + Storybook example for `local-storybook-vrt`. No `--legacy-peer-deps` is needed.  
If you work with this monorepo locally, run `npm install` at the repo root too (to install the `simple-git` dependency used by the CLI). Users who install the published package don’t need that extra step.

## Requirements (minimum versions)

- Node 20.19+ (matches `@vitejs/plugin-react` / Vite 6 engine requirement)
- Storybook 8.6.14+ (example uses `^8.6.14`)
- storycap 5.0.1+
- reg-suit 0.14.5+
- Vite 6+ (example uses `^6.0.11`, with `@vitejs/plugin-react` ^5.x)

## Usage

Before running VRT, create a branch, make a visible UI change, and commit it. Then compare the two branches:

```bash
# Start Storybook
npm run storybook

# VRT: current branch vs target branch
npx lsvrt <target-branch>
```

Captures and reg-suit working files are stored under `.lsvrt/`.
