# Troubleshooting

This file documents common failure modes and how to reason about them.

## The Preview Is Empty

Check:

- whether the profile has any enabled source definitions
- whether the source paths actually exist
- whether `excludeNotePaths` is filtering more than expected
- whether extractors plus regex filters removed all content
- whether block toggles in preview disabled the relevant sections

## The Active Note Is Missing

Check:

- whether the active file is a Markdown note
- whether the profile contains an `active-note` source
- whether selection-only mode is active without any editor selection

## Search Results Feel Wrong

Check:

- whether the query is too broad
- whether a negated clause is excluding too much
- whether the relevant signal is in path, text, heading, tag, or frontmatter

If needed, split one broad query source into multiple narrower profiles.

## The Output Is Too Long

Use:

- per-source character budgets
- per-block budgets
- a lower global output budget
- heading-filtered extractors instead of full-note extraction
- regex include filters to keep only high-signal sections

## The Output Is Too Short

Check:

- whether block budgets are too aggressive
- whether source budgets are too aggressive
- whether the global output budget is too low
- whether regex include is only matching tiny fragments

## Deep Links Do Not Work

Check:

- whether the `urlTemplate` is valid
- whether the destination app accepts prompt text in query parameters
- whether `{{encodedPrompt}}` is present where needed

## Appending Hits the Wrong Note

Check:

- whether the target is `append-active-note` or `append-note`
- whether the `pathTemplate` resolves to the note you intended
- whether `openAfterWrite` should be enabled for visibility

## The Vault Config Is Not Loaded

Check:

- whether `Enable vault config` is on
- whether `vaultConfigPath` is correct
- whether the JSON file is valid enough for parsing

Use:

- `Promptfire: Reload vault config`
- `Promptfire: Export resolved settings to vault config`

## The Plugin Seems To Ignore Reordering

Promptfire currently applies ordering in two stages:

1. manual preview order
2. source priority for all remaining ties

If a result still feels off, inspect the preview source list and the source priorities together.
