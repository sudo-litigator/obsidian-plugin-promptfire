# Development

This guide covers local setup, build commands, and the manual verification loop
for Promptfire.

## Prerequisites

- Node.js 18+
- npm
- Obsidian 1.5.0 or newer for manual plugin testing

## Install Dependencies

```bash
npm install
```

## Build Commands

Production build:

```bash
npm run build
```

Watch mode for local iteration:

```bash
npm run dev
```

## Local Plugin Testing

After a successful build, copy these files into your vault:

```text
<vault>/.obsidian/plugins/promptfire/
```

Files to copy:

- `manifest.json`
- `main.js`
- `styles.css`

Then:

1. open Obsidian
2. go to `Settings -> Community plugins`
3. enable `Promptfire`
4. test the workflow affected by your change

## Recommended Manual Checks

Depending on the change, verify things such as:

- plugin loads without startup errors
- settings still save and reload correctly
- profiles render expected prompt output
- preview modal behavior remains stable
- output targets still write to the intended location
- vault config import/export still works when touched by the change

## Documentation Expectations

Update docs when you change:

- commands
- settings shape
- prompt assembly behavior
- output target behavior
- installation or contributor workflow

Useful files:

- [`README.md`](../README.md)
- [`docs/user-guide.md`](user-guide.md)
- [`docs/config-reference.md`](config-reference.md)
- [`docs/troubleshooting.md`](troubleshooting.md)
- [`RELEASE.md`](../RELEASE.md)

## Contributor Notes

- keep PRs scoped
- include manual verification notes
- attach screenshots for UI changes when they help
- prefer incremental changes over large structural rewrites
