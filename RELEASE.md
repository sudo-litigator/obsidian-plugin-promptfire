# Release Process

This file documents the release workflow for `Promptfire`.

## Preconditions

- Working tree is clean
- `main` is up to date
- `package.json`, `manifest.json`, and `versions.json` are aligned
- The plugin builds successfully
- The plugin has been checked in a real Obsidian vault

## Files That Matter

- [package.json](package.json)
- [manifest.json](manifest.json)
- [versions.json](versions.json)
- [CHANGELOG.md](CHANGELOG.md)
- [docs/releases/](docs/releases/)
- [.github/workflows/release.yml](.github/workflows/release.yml)

## Canonical Release Outputs

The current `1.x` GitHub release workflow publishes these flat assets:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

The canonical in-repo release notes are:

- `CHANGELOG.md` for the short versioned summary
- `docs/releases/<version>.md` for the detailed historical note
- `docs/releases/<version>-body.md` for the GitHub release page body text

The current workflow does not build or upload a ZIP archive.

## Release Checklist

1. Update the version metadata.

   - update `package.json`
   - run `npm run version` to sync `manifest.json` and `versions.json`

   Or use:

   ```bash
   npm version <version> --no-git-tag-version
   npm run version
   ```

2. Update release notes:

   - add a new changelog section in `CHANGELOG.md`
   - add a detailed release note in `docs/releases/<version>.md`
   - add the GitHub release body text in `docs/releases/<version>-body.md`

3. Build and verify:

   ```bash
   npm install
   npm run build
   PROMPTFIRE_RELEASE_TAG=v<version> npm run verify:release
   ```

4. Copy the plugin into a vault for a real check:

   ```bash
   cp main.js manifest.json styles.css <vault>/.obsidian/plugins/promptfire/
   ```

5. Commit the release:

   ```bash
   git add .
   git commit -m "Prepare <version> release"
   ```

6. Create the annotated tag:

   ```bash
   git tag -a v<version> -m "Promptfire <version>"
   ```

7. Push the release commit and tag to the GitHub-hosted remote.

   If your GitHub remote is named `origin`, this is:

   ```bash
   git push origin main
   git push origin v<version>
   ```

   If your GitHub remote has another name, replace `origin` with that remote.

8. Wait for `.github/workflows/release.yml` to publish the GitHub release.

9. Update the GitHub release body if needed.

   - tag: `v<version>`
   - title: `Promptfire <version>`
   - body: use `docs/releases/<version>-body.md`

   The current workflow publishes the assets automatically. The body text
   remains a manual follow-up unless the workflow is extended to read the body
   file.

## Verification Checklist

- Obsidian loads the plugin without errors
- Commands appear in the command palette
- Settings tab renders correctly
- Preview opens and recompiles
- Default output target executes successfully
- Vault config reload still works
- GitHub release includes `manifest.json`, `main.js`, `styles.css`, and
  `versions.json`

## Notes

- The tag push is what triggers the GitHub release workflow
- The release body file is the canonical source for the release page text
- The detailed release note file stays in-repo as historical documentation
