<div align="center">
  <h1>Promptfire</h1>
  <p><strong>Structured vault context for repeatable AI workflows in Obsidian.</strong></p>
  <p>Compile notes, links, folders, metadata, and search results into deterministic prompts for ChatGPT, Claude, local models, and any other external AI tool.</p>
  <p>
    <img src="https://img.shields.io/badge/version-1.0.0-7c3aed" alt="Version 1.0.0" />
    <img src="https://img.shields.io/badge/Obsidian-1.5.0%2B-8b5cf6?logo=obsidian&logoColor=white" alt="Obsidian 1.5.0+" />
    <img src="https://img.shields.io/badge/license-MIT-059669" alt="MIT License" />
    <img src="https://img.shields.io/badge/workflow-model--agnostic-111827" alt="Model agnostic" />
  </p>
</div>

---

<h2 align="center">Why Promptfire Exists</h2>

Promptfire is for people who already keep valuable context in Obsidian but do not want to rebuild that context by hand every time they use an AI tool.

Instead of repeatedly pasting style rules, active note content, linked notes, conventions, and background material into another app, Promptfire turns your vault into a reproducible prompt assembly system.

That gives you:

- repeatable prompts instead of one-off copy-paste sessions
- explicit control over what context is included and in what order
- budget-aware prompt construction for larger vaults
- model-agnostic exports that stay local to Obsidian until you decide where to send them

<h2 align="center">How It Works</h2>

1. Define one or more profiles for different workflows.
2. Choose context sources such as the active note, a folder, backlinks, or a search query.
3. Apply extractors, filters, priorities, and budgets.
4. Preview the compiled result and export it to the target you want.

<h2 align="center">Highlights</h2>

- Multiple named profiles for different AI workflows
- Source definitions for active note, single file, folder, outgoing links, backlinks, and search query
- Section extractors for full note, frontmatter only, body only, heading-filtered sections, and code blocks only
- Regex include and exclude filters per source
- Per-source priorities and character budgets
- Per-block budgets and global prompt budgets
- Output formats for Markdown, XML, and JSON
- Output targets for clipboard, new note, append to note, append to active note, scratchpad note, and deep link
- Interactive preview with source toggles, source reordering, block toggles, format switching, and recompile controls
- Snapshot workflows for saving preview state as a reusable profile
- Vault-native configuration via `.promptfire.json`

<h2 align="center">Install</h2>

### From GitHub Releases

1. Download the latest release assets: `manifest.json`, `main.js`, and `styles.css`.
2. Create this folder inside your vault:

```text
<vault>/.obsidian/plugins/promptfire/
```

3. Copy the downloaded files into that folder.
4. In Obsidian, open `Settings -> Community plugins`.
5. Enable community plugins if needed, then enable `Promptfire`.

### From Source

```bash
npm install
npm run build
```

Copy `manifest.json`, `main.js`, and `styles.css` into `<vault>/.obsidian/plugins/promptfire/`, then enable the plugin in Obsidian.

<h2 align="center">Commands</h2>

- `Promptfire: Run default output target for active profile`
- `Promptfire: Preview context for active profile`
- `Promptfire: Run default output target for selected profile`
- `Promptfire: Preview context for selected profile`
- `Promptfire: Switch active profile`
- `Promptfire: Reload vault config`
- `Promptfire: Export resolved settings to vault config`

If profile commands are enabled, Promptfire also registers profile-specific commands.

<h2 align="center">Search Query Syntax</h2>

`search` sources support field-aware, case-insensitive queries.

Supported patterns include:

- bare terms across path, filename, text, tags, headings, and frontmatter
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

<h2 align="center">Vault Config</h2>

If `Enable vault config` is enabled, Promptfire loads additional settings from a vault file, by default:

```text
.promptfire.json
```

You can also export the resolved settings back into that file from the command palette or plugin settings.

<h2 align="center">Documentation Map</h2>

- [Documentation index](docs/index.md)
- [User guide](docs/user-guide.md)
- [Configuration reference](docs/config-reference.md)
- [Query syntax](docs/query-syntax.md)
- [Examples](docs/examples.md)
- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Release process](RELEASE.md)
- [Changelog](CHANGELOG.md)

<h2 align="center">Development</h2>

```bash
npm install
npm run build
```

Watch mode:

```bash
npm run dev
```

For contributor expectations, local vault testing, and documentation update
guidance, see [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/development.md](docs/development.md).

<h2 align="center">Release Assets</h2>

This repository is prepared for GitHub release-based distribution. The standard shipped plugin assets are:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

`versions.json` remains in the repository for Obsidian release metadata and does not need to be copied into the vault during manual installation.

<h2 align="center">License</h2>

MIT
