# local-storybook-vrt

CLI to run visual regression tests locally between two git branches by spinning up Storybook, capturing with storycap, and comparing with reg-suit.  
`lvrt <target-branch>` saves captures for the current branch and the target branch under `.lvrt/` and runs reg-suit to compare them.

## Requirements

- Node.js 18+
- git (used to switch branches)
- Peer dependencies (add to your project, e.g., devDependencies)
  - `storybook@^7`
  - `storycap@^3`
  - `reg-suit@^0.10`

## Install

```bash
npm i -D local-storybook-vrt
```

## Usage

```bash
lvrt <target-branch>
```

1. Starts Storybook on port 6006 for the current branch, captures with `storycap` into `.lvrt/capture/<current-branch>`.
2. Checks out the target branch and captures into `.lvrt/capture/<target-branch>`.
3. Generates `.lvrt/reg-work/regconfig.json` and runs `npx reg-suit run` to compare.
4. Switches back to the original branch when finished.

## Environment variables

- `LVRT_PORT`: Storybook port (default `6006`)
- `LVRT_STORYBOOK_COMMAND`: Storybook command (default `storybook dev`, e.g., `"start-storybook"`)
- `LVRT_STORYCAP_OPTIONS`: Extra options passed to `storycap` (e.g., `"--serverTimeout 120000"`)

## Notes

- Because branches are switched via `git`, stash or commit uncommitted changes beforehand.
- Storybook is started via `npx storybook dev` (or override with env var). Ensure Storybook, storycap, and reg-suit are installed in your project.
- Captures and reg-suit working files live under `.lvrt/`; add to `.gitignore` as needed.
