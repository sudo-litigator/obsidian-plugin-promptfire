# Contributing to Promptfire

Thanks for considering a contribution to Promptfire.

This repository is intended to stay calm, readable, and easy to work in. The
best contributions are scoped to a single problem, come with clear manual
verification notes, and keep the Markdown-first workflow intact.

## Before You Start

- Read the [README](README.md) for product scope and installation details.
- Read the [development guide](docs/development.md) for local setup and manual
  testing.
- Check existing issues and open pull requests before starting work.
- If the change is larger than a small bug fix or doc improvement, open an
  issue first so the direction can be discussed before implementation.

## Development Setup

```bash
npm install
npm run build
```

For an iterative workflow:

```bash
npm run dev
```

Promptfire is an Obsidian plugin, so the most useful verification is usually a
manual check in a local vault after building `main.js` and `styles.css`.

## Repository Expectations

### Scope

- Keep pull requests focused on one bug, feature, or documentation task.
- Avoid mixing unrelated refactors with behavior changes.
- Prefer small, reviewable patches over broad rewrites.

### Documentation

Update docs when the change affects:

- user-facing behavior
- command names
- configuration structure
- installation or development workflow
- release-facing notes

Relevant docs live under [`docs/`](docs/), with release process details in
[`RELEASE.md`](RELEASE.md).

### Code Style

- Follow the existing TypeScript and naming patterns in the repo.
- Keep Markdown output and note structures readable.
- Prefer explicit, boring code over clever abstractions.
- Preserve backward compatibility unless the issue explicitly calls for a
  breaking change.

## Testing and Verification

There is currently no large automated test suite in this repository, so each PR
should include the checks you actually ran.

Typical verification looks like:

```bash
npm run build
```

And then one or more manual checks in Obsidian, for example:

- enabling the plugin in a local vault
- exercising the changed command or UI flow
- confirming settings, preview behavior, or output targets still work

If a change is docs-only, say that clearly in the PR.

## Pull Request Notes

When you open a PR, include:

- what changed
- why it changed
- how you verified it
- screenshots or notes for UI changes when useful

The repository already includes a [pull request template](.github/pull_request_template.md);
use it fully.

## Where to Ask for Help

- Usage questions or setup confusion: see [SUPPORT.md](SUPPORT.md)
- Bug reports: open a bug issue with reproduction details
- Feature ideas: open a feature request issue
- Docs gaps: open a docs improvement issue

Thanks for keeping the repo useful and maintainable.
