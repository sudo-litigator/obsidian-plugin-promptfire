# Examples

This document collects concrete Promptfire setups.

## Example 1: Writing Profile

Goal:

- send one current draft
- one style guide
- a folder of strong example notes
- keep related notes constrained

Suggested setup:

- `active-note`
  - section: `current-note`
  - note mode: `selection-fallback-full`
  - priority: `100`
  - maxCharacters: `4000`
- `file`
  - label: `Writing Style Guide`
  - path: `guides/writing-style.md`
  - section: `vault-conventions`
  - priority: `80`
- `folder`
  - label: `Writing Examples`
  - path: `examples/writing`
  - section: `vault-conventions`
  - recursive: `true`
  - maxItems: `3`
  - priority: `40`

Recommended target:

- `clipboard`
- format: `markdown`

## Example 2: Research Profile

Goal:

- include the active note
- pull related notes through query
- preserve metadata
- keep output in a scratchpad note

Suggested search query:

```text
path:research fm:status=active -tag:archive
```

Suggested target:

- `scratchpad-note`
- path template: `Promptfire/Research/{{activeNote.name}}-{{date.local}}`
- format: `markdown`

## Example 3: Code Notes Profile

Goal:

- keep only code blocks from source notes
- append the result into a working scratch note

Suggested source:

- `folder`
  - path: `code-notes/snippets`
  - extract mode: `code-blocks`
  - maxItems: `10`
  - maxCharacters: `6000`

Suggested target:

- `append-note`
- path template: `Promptfire/Scratchpads/code-context`
- append separator: `\n\n---\n\n`

## Example Vault Config

Minimal example:

```json
{
  "activeProfileId": "writing-profile",
  "enableVaultConfig": true,
  "profiles": [
    {
      "id": "writing-profile",
      "name": "Writing",
      "maxOutputCharacters": 20000,
      "includeFrontmatter": true,
      "includeBody": true,
      "includeSourcePathLabels": true,
      "stripCodeBlocks": false,
      "taskInstruction": "Use the provided vault context to help with {{activeNote.name}}.",
      "workingRules": [
        "Follow the existing vault conventions.",
        "Do not invent metadata fields unless the context clearly supports them."
      ],
      "excludeNotePaths": [
        "archive/old-style-guide.md"
      ],
      "sourceDefinitions": [
        {
          "id": "source-active",
          "type": "active-note",
          "label": "Current Draft",
          "enabled": true,
          "section": "current-note",
          "noteMode": "selection-fallback-full",
          "priority": 100,
          "extractMode": "full"
        },
        {
          "id": "source-style",
          "type": "file",
          "label": "Writing Style Guide",
          "enabled": true,
          "section": "vault-conventions",
          "path": "guides/writing-style.md",
          "priority": 80,
          "extractMode": "heading-filtered",
          "headingFilters": [
            "Metadata",
            "Structure",
            "Tone"
          ]
        }
      ],
      "templateBlocks": [
        { "id": "task", "enabled": true, "heading": "Task" },
        { "id": "vault-conventions", "enabled": true, "heading": "Vault Conventions" },
        { "id": "current-note", "enabled": true, "heading": "Current Note" },
        { "id": "related-notes", "enabled": false, "heading": "Related Notes" },
        { "id": "working-rules", "enabled": true, "heading": "Working Rules" },
        { "id": "included-sources", "enabled": true, "heading": "Included Sources" }
      ],
      "outputTargets": [
        {
          "id": "target-clipboard",
          "label": "Clipboard",
          "type": "clipboard",
          "enabled": true,
          "format": "markdown",
          "appendSeparator": "\n\n---\n\n",
          "pathTemplate": "",
          "urlTemplate": "",
          "openAfterWrite": false
        }
      ],
      "defaultOutputTargetId": "target-clipboard"
    }
  ]
}
```

## Snapshot Workflow Example

Use case:

1. Open preview on a large profile.
2. Disable noisy sources.
3. Reorder the remaining sources.
4. Switch output format to `xml`.
5. Save the state as a snapshot profile.

This is a good way to discover new profiles through actual usage instead of creating them all in settings first.
