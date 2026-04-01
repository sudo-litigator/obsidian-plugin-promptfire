# Promptfire

`Promptfire` is an Obsidian plugin for compiling vault context into deterministic prompts for external AI tools.

Instead of manually pasting style rules, note structure, metadata patterns, and the current note into ChatGPT, Claude, or local models, `Promptfire` builds that context for you from your vault and sends it to the output target you choose.

## What It Does

- Compiles context from multiple vault sources into one reproducible prompt
- Lets you control exactly what gets included, in what order, and under which budget
- Exports the result to the clipboard, notes inside your vault, scratchpads, or deep links
- Stays model-agnostic and local to Obsidian

## Highlights

- Multiple named profiles
- Source definitions for:
  - active note
  - single file
  - folder
  - outgoing links
  - backlinks
  - search query
- Section extractors:
  - full note
  - frontmatter only
  - body only
  - heading-filtered sections
  - code blocks only
- Regex include and exclude filters per source
- Per-source priority and character budgets
- Per-block budgets and global prompt budgets
- Output formats:
  - Markdown
  - XML
  - JSON
- Output targets:
  - clipboard
  - new note
  - append to note
  - append to active note
  - scratchpad note
  - deep link
- Interactive preview for:
  - enabling and disabling sources
  - reordering sources
  - toggling blocks
  - switching export format
  - recompiling without recollecting
  - saving preview state as a snapshot profile
- Vault-native config via `.promptfire.json`

## Commands

- `Promptfire: Run default output target for active profile`
- `Promptfire: Preview context for active profile`
- `Promptfire: Run default output target for selected profile`
- `Promptfire: Preview context for selected profile`
- `Promptfire: Switch active profile`
- `Promptfire: Reload vault config`
- `Promptfire: Export resolved settings to vault config`

If profile commands are enabled, Promptfire also registers profile-specific commands.

## Search Query Syntax

`search` sources support field-aware, case-insensitive queries.

Supported patterns:

- bare terms search path, filename, text, tags, headings, and frontmatter
- `path:guides`
- `name:daily`
- `text:"prompt engineering"`
- `tag:ai`
- `heading:conventions`
- `fm:status=active`
- negation with `-`, for example `-name:draft`

Example:

```text
tag:ai path:guides "prompt engineering" -name:draft fm:status=active
```

## Installation

### Manual

1. Build the plugin:

```bash
npm install
npm run build
```

2. Copy these files into your vault:

- `manifest.json`
- `main.js`
- `styles.css`

Target directory:

```text
<vault>/.obsidian/plugins/promptfire/
```

3. Enable `Promptfire` in Obsidian community plugins.

## Vault Config

If `Enable vault config` is on, Promptfire loads additional settings from a vault file, by default:

```text
.promptfire.json
```

You can also export the current resolved settings back into that file from the command palette or plugin settings.

## Development

```bash
npm install
npm run build
```

Watch mode:

```bash
npm run dev
```

## Release Notes

- Changelog: [CHANGELOG.md](/home/luca/studio/software/obsidian-plugins/promptfire/CHANGELOG.md)
- `0.1.0` release notes: [docs/releases/0.1.0.md](/home/luca/studio/software/obsidian-plugins/promptfire/docs/releases/0.1.0.md)
- `0.1.0` release body: [docs/releases/0.1.0-body.md](/home/luca/studio/software/obsidian-plugins/promptfire/docs/releases/0.1.0-body.md)

## Status

Current release: `0.1.0`

This version establishes the power-user core:

- profile-based prompt compilation
- deterministic budgeting
- configurable extraction and output targets
- interactive preview and snapshot workflows

## License

MIT
