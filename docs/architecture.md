# Architecture

This document explains how `Promptfire` is structured internally.

## High-Level Flow

The plugin works as a pipeline:

1. load settings
2. resolve the active profile
3. collect candidate sources from the vault
4. extract and filter source content
5. sort and budget sources
6. assemble template blocks
7. render the final output format
8. send the result to an output target

## Main Modules

### [src/main.ts](../src/main.ts)

Top-level plugin entry point.

Responsibilities:

- plugin lifecycle
- command registration
- profile selection
- preview orchestration
- output target execution
- vault config reload and export

### [src/settings.ts](../src/settings.ts)

Settings normalization and settings tab UI.

Responsibilities:

- normalize persisted settings
- create default profiles, sources, and targets
- render settings UI
- clamp numeric limits
- migrate old config shapes

### [src/context/collector.ts](../src/context/collector.ts)

Vault collection layer.

Responsibilities:

- resolve source definitions into notes
- handle active note selection modes
- read files and folders
- resolve backlinks and outgoing links
- run search queries
- apply extractors
- apply regex include and exclude
- emit collection issues

### [src/context/assembler.ts](../src/context/assembler.ts)

Prompt compilation layer.

Responsibilities:

- filter sources by enabled blocks and preview overrides
- sort by manual order and priority
- apply per-source budgets
- build section blocks
- apply per-block budgets
- enforce global output limits
- return a structured build result

### [src/services/template-renderer.ts](../src/services/template-renderer.ts)

Template rendering utilities.

Responsibilities:

- resolve template variables
- resolve simple conditional sections
- render blocks to Markdown, XML, or JSON

### [src/services/output-targets.ts](../src/services/output-targets.ts)

Output dispatch layer.

Responsibilities:

- clipboard writes
- note creation or overwrite
- append workflows
- deep-link generation
- file opening after write

### [src/ui/preview-modal.ts](../src/ui/preview-modal.ts)

Interactive preview UI.

Responsibilities:

- live source toggling
- source reordering
- block toggling
- output format switching
- target execution
- snapshot profile creation

## Data Model

Promptfire centers around a small set of types:

- `PromptfireProfile`
- `PromptfireSourceDefinition`
- `PromptfireTemplateBlock`
- `PromptfireOutputTarget`
- `CollectedContext`
- `PromptBuildResult`

The important design decision is that sources, blocks, and targets are all profile-local. This keeps workflows composable and makes snapshot profiles possible.

## Determinism

Promptfire intentionally favors deterministic behavior over opaque relevance logic.

That means:

- stable source ordering
- explicit priorities
- explicit budgets
- visible truncation
- reproducible prompt structure

This is important because the plugin is meant to be a control layer between a vault and an external model.

## Current Extension Points

The current architecture can absorb future work in these areas without a rewrite:

- richer query DSL
- model-specific templates
- token-based budgets
- profile inheritance
- stronger preview-side editing
- release automation
