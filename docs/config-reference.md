# Configuration Reference

This file documents the major configuration surfaces in `Promptfire`.

## Top-Level Settings

### `activeProfileId`

The profile used by default commands and the ribbon button.

### `enableVaultConfig`

If enabled, Promptfire loads additional config from `vaultConfigPath`.

### `vaultConfigPath`

Path to the vault-native config file.

Default:

```text
.promptfire.json
```

### `registerProfileCommands`

If enabled, Promptfire registers profile-specific commands in the command palette.

### `showRibbonIcon`

If enabled, Promptfire adds a ribbon button for the active profile.

## Profile

Each profile contains:

- name
- source definitions
- template blocks
- working rules
- output targets
- default output target
- prompt budget and content shaping options

### Profile Fields

#### `name`

Human-readable label for the profile.

#### `excludeNotePaths`

List of note paths that should never be included, even if matched by a source.

#### `includeFrontmatter`

Whether YAML frontmatter is available to extractors that can include it.

#### `includeBody`

Whether note body content is available to extractors that can include it.

#### `includeSourcePathLabels`

Whether source paths are rendered above source content in the prompt.

#### `stripCodeBlocks`

If enabled, fenced code blocks are replaced with a placeholder unless the extractor explicitly asks for code blocks.

#### `taskInstruction`

Top-level task block content.

Supports template variables and simple `{{#if ...}}` conditions.

#### `workingRules`

List of persistent rules that appear in the `working-rules` block.

#### `maxOutputCharacters`

Hard cap for the final prompt after all source and block budgets are applied.

## Source Definitions

Each source definition resolves one class of content.

### Common Fields

#### `enabled`

Whether the source is active.

#### `label`

Label shown in preview and debugging metadata.

#### `section`

Target prompt section:

- `vault-conventions`
- `current-note`
- `related-notes`

#### `priority`

Higher values are considered earlier after manual preview reordering.

#### `maxCharacters`

Optional hard cap for the individual source before block and global budgets apply.

#### `extractMode`

How the note content is reduced before budgeting.

Supported values:

- `full`
- `frontmatter-only`
- `body-only`
- `heading-filtered`
- `code-blocks`

#### `headingFilters`

List of heading fragments used by `heading-filtered`.

#### `regexInclude`

Optional regex. When present, only matching fragments are kept.

#### `regexExclude`

Optional regex. When present, matching fragments are removed.

### Source Type: `active-note`

Additional field:

- `noteMode`

Supported values:

- `full`
- `selection`
- `selection-fallback-full`

### Source Type: `file`

Additional field:

- `path`

### Source Type: `folder`

Additional fields:

- `path`
- `recursive`
- `maxItems`

### Source Type: `outgoing-links`

Additional field:

- `maxItems`

### Source Type: `backlinks`

Additional field:

- `maxItems`

### Source Type: `search`

Additional fields:

- `query`
- `maxItems`

## Template Blocks

Promptfire uses named blocks for output structure.

Built-in block IDs:

- `task`
- `vault-conventions`
- `current-note`
- `related-notes`
- `working-rules`
- `included-sources`

Each block supports:

- `enabled`
- `heading`
- `maxCharacters`

## Output Targets

Each profile may define multiple output targets.

### Common Fields

- `enabled`
- `label`
- `format`
- `openAfterWrite`

Supported formats:

- `markdown`
- `xml`
- `json`

### Target Type: `clipboard`

Writes the compiled result to the system clipboard.

### Target Type: `new-note`

Creates or overwrites a note at `pathTemplate`.

### Target Type: `append-note`

Creates or reuses a note at `pathTemplate` and appends to it.

### Target Type: `append-active-note`

Appends the compiled result to the active note.

### Target Type: `scratchpad-note`

Writes to a scratchpad path template.

### Target Type: `deep-link`

Opens a URL built from `urlTemplate`.

## Template Variables

Available variables currently include:

- `{{profile.id}}`
- `{{profile.name}}`
- `{{activeNote.path}}`
- `{{activeNote.name}}`
- `{{date.iso}}`
- `{{date.local}}`
- `{{outputTarget.label}}`
- `{{outputTarget.type}}`
- `{{prompt.characterCount}}`
- `{{prompt.format}}`
- `{{prompt.sourceCount}}`

Conditional blocks:

```text
{{#if activeNote.path}}...{{/if}}
```

## Example Vault Config

See [docs/examples.md](examples.md) for larger working examples.
