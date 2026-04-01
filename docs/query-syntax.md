# Query Syntax

This file documents the current `search` source query syntax.

## Overview

Queries are:

- case-insensitive
- field-aware
- scored
- matched against normalized note metadata and content

Promptfire does not currently expose a full DSL with parentheses or explicit boolean operators. The existing parser focuses on fast, useful filtering inside Obsidian vaults.

## Supported Clause Types

### Bare terms

Bare terms search across:

- file path
- file name
- note text
- tags
- headings
- frontmatter values

Example:

```text
zettelkasten
```

### `path:`

Matches note paths.

Example:

```text
path:projects/current
```

### `name:`

Matches the note basename.

Example:

```text
name:daily
```

### `text:` or `content:`

Matches note text content.

Examples:

```text
text:"prompt engineering"
content:meeting
```

### `tag:`

Matches tags from the Obsidian metadata cache.

Example:

```text
tag:ai
```

### `heading:` or `h:`

Matches note headings.

Example:

```text
heading:conventions
```

### `fm:` or `frontmatter:`

Matches frontmatter values.

Examples:

```text
fm:status=active
frontmatter:type=guide
```

## Negation

Negate a clause with `-`.

Examples:

```text
-name:draft
-tag:archive
```

## Quoted Text

Use quotes for multi-word values.

Example:

```text
text:"prompt engineering"
```

## Practical Examples

### Writing guide notes only

```text
path:guides tag:writing
```

### Research notes with active status

```text
path:research fm:status=active
```

### Exclude drafts

```text
tag:ai -name:draft -path:archive
```

### Find notes with specific section titles

```text
heading:conventions heading:metadata
```

## Current Limits

- no nested boolean expressions
- no explicit `OR`
- no parentheses
- no numeric comparison syntax yet
- no dedicated recency operators yet

Those can be added later without changing the basic source model.
