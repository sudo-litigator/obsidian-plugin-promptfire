# User Guide

This guide explains how to think about `Promptfire` in daily use.

## Core Idea

`Promptfire` is not a chat client. It is a context compiler.

You tell it:

- which notes matter
- which parts of those notes matter
- how much space each part may consume
- how the result should be structured
- where the result should go

The plugin then builds a deterministic prompt package for an external AI tool.

## Mental Model

Each profile has four major layers:

1. Sources
2. Transforms
3. Template blocks
4. Output targets

### Sources

Sources define where context comes from.

Examples:

- the active note
- one style guide file
- a folder of example notes
- notes linked from the active note
- notes that link back to the active note
- search results

### Transforms

Transforms define how a source is reduced before it enters the final prompt.

Examples:

- take the full note
- take only frontmatter
- take only the body
- take only sections under matching headings
- take only code blocks
- keep only regex matches
- remove regex matches

### Template blocks

Template blocks define how the final prompt is structured.

Built-in blocks:

- task
- vault conventions
- current note
- related notes
- working rules
- included sources

### Output targets

Output targets define where the compiled result goes.

Examples:

- clipboard
- a new note
- an append-only note
- the active note
- a scratchpad note
- a deep link into another application

## Recommended First Setup

For a practical first profile:

1. Add one `active-note` source for the current working note.
2. Add one `file` source for a style guide note.
3. Add one `folder` source for good examples.
4. Keep output format on `markdown`.
5. Set the default output target to `clipboard`.
6. Use the preview before adding more complexity.

## Working With Profiles

Profiles let you separate workflows.

Typical profile splits:

- writing
- research
- project planning
- code notes
- meeting synthesis
- publishing

Use different profiles when:

- the output target changes
- the source mix changes
- the prompt structure changes
- the budget strategy changes

## Using the Preview

The preview is not just a viewer. It is a control surface.

You can use it to:

- disable noisy sources
- reorder sources
- turn blocks on and off
- switch between Markdown, XML, and JSON
- rerun the compilation without recollecting context
- save a snapshot profile from the current state

This is the fastest way to tune a profile before baking the settings in permanently.

## When To Use Budgets

Budgets matter when your vault contains too much context.

### Per-source budget

Use this when one source is useful but tends to dominate the final prompt.

Examples:

- a long style guide
- a big current note
- search results that pull in large files

### Per-block budget

Use this when one section of the final prompt should stay constrained regardless of source size.

Examples:

- keep `Included Sources` short
- keep `Related Notes` from eating the whole output

### Global budget

Use this as the hard outer limit for the whole prompt.

## Vault Config

If you want versioned or portable settings, enable vault config and store a `.promptfire.json` file in the vault.

This is useful when:

- you move across machines
- you want your Promptfire config under version control
- you want to inspect config as data instead of only through the settings UI

## Good Power-User Practices

- Keep profiles narrow and purposeful
- Name sources by intent, not by storage type
- Prefer small, explicit style files over giant folders
- Use heading filters before using aggressive regex
- Use the preview to debug what actually made it into the prompt
- Save snapshot profiles when a temporary preview state proves useful
