# local-storybook-vrt

CLI to run visual regression tests locally between two git branches by spinning up Storybook, capturing with storycap, and comparing with reg-suit.  
`lsvrt <target-branch>` saves captures for the current branch and the target branch under `.lsvrt/` and runs reg-suit to compare them.

## Requirements

- Node.js 18+
- git (used to switch branches)
- Peer dependency
  - `storybook@^7` (install in your project)
  - `local-storybook-vrt` bundles `storycap` and `reg-suit`, so you don’t need to add them yourself.

## Install

```bash
npm i -D local-storybook-vrt
```

You can also install globally and run it inside a project that has the peer dependencies:

```bash
npm i -g local-storybook-vrt
lsvrt <target-branch>    # run from your Storybook project root
```

## Usage

```bash
lsvrt <target-branch>
```

1. Starts Storybook on port 6006 for the current branch, captures with `storycap` into `.lsvrt/capture/<current-branch>`.
2. Checks out the target branch and captures into `.lsvrt/capture/<target-branch>`.
3. Generates `.lsvrt/reg-work/regconfig.json` and runs `npx reg-suit run` to compare.
4. Switches back to the original branch when finished.

## Environment variables

- `LSVRT_PORT`: Storybook port (default `6006`)
- `LSVRT_STORYBOOK_COMMAND`: Storybook command (default `storybook dev`, e.g., `"start-storybook"`)
- `LSVRT_STORYCAP_OPTIONS`: Extra options passed to `storycap` (e.g., `"--serverTimeout 120000"`)

## Notes

- Because branches are switched via `git`, stash or commit uncommitted changes beforehand.
- Storybook is started via `npx storybook dev` (or override with env var). Ensure Storybook, storycap, and reg-suit are installed in your project.
- Captures and reg-suit working files live under `.lsvrt/`; add to `.gitignore` as needed.
