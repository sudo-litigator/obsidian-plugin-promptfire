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

## Release Checklist

1. Update the version in `package.json`.
2. Run:

```bash
npm version <version> --no-git-tag-version
npm run version
```

3. Update release notes:

- add a new changelog section in `CHANGELOG.md`
- add a detailed release note in `docs/releases/<version>.md`
- add a Git release body in `docs/releases/<version>-body.md`

4. Build and verify:

```bash
npm install
npm run build
```

5. Copy the plugin into a vault for a real check:

```bash
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/promptfire/
```

6. Create the upload artifact:

```bash
mkdir -p dist
zip -j dist/promptfire-<version>.zip manifest.json main.js styles.css
sha256sum dist/promptfire-<version>.zip > dist/SHA256SUMS.txt
```

7. Commit the release:

```bash
git add .
git commit -m "Prepare <version> release"
```

8. Create the tag:

```bash
git tag -a v<version> -m "Promptfire <version>"
```

9. Push branch and tag:

```bash
git push origin main
git push origin v<version>
```

10. Create the Git release page entry:

- tag: `v<version>`
- title: `Promptfire <version>`
- body: use `docs/releases/<version>-body.md`
- asset: upload `dist/promptfire-<version>.zip`

## Verification Checklist

- Obsidian loads the plugin without errors
- Commands appear in the command palette
- Settings tab renders correctly
- Preview opens and recompiles
- Default output target executes successfully
- Vault config reload still works

## Notes

- `dist/` is intentionally ignored and should not be committed
- The release body file is meant for copy/paste into the Git hosting UI
- The detailed release note file is meant to stay in-repo as historical documentation
