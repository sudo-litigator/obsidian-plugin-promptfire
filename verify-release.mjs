import { readFileSync, statSync } from "node:fs";

const DEFAULT_ASSETS = [
  "manifest.json",
  "main.js",
  "styles.css",
  "versions.json",
];

function parseArgs(argv) {
  return new Set(argv.slice(2));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveReleaseTag() {
  if (process.env.PROMPTFIRE_RELEASE_TAG) {
    return process.env.PROMPTFIRE_RELEASE_TAG;
  }

  if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  if (process.env.GITHUB_REF?.startsWith("refs/tags/")) {
    return process.env.GITHUB_REF.slice("refs/tags/".length);
  }

  return "";
}

function resolveExpectedAssets() {
  const configuredAssets = process.env.PROMPTFIRE_RELEASE_ASSETS
    ?.split(/\r?\n/g)
    .map((asset) => asset.trim())
    .filter(Boolean);

  return configuredAssets?.length ? configuredAssets : DEFAULT_ASSETS;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyMetadata({ requireTag }) {
  const pkg = readJson("package.json");
  const manifest = readJson("manifest.json");
  const versions = readJson("versions.json");
  const releaseTag = resolveReleaseTag();

  assert(pkg.version, "package.json is missing a version.");
  assert(manifest.version === pkg.version, `manifest.json version ${manifest.version} does not match package.json version ${pkg.version}.`);
  assert(
    typeof versions[pkg.version] === "string" && versions[pkg.version] === manifest.minAppVersion,
    `versions.json entry for ${pkg.version} must exist and match manifest minAppVersion ${manifest.minAppVersion}.`,
  );

  if (requireTag) {
    assert(releaseTag, "Release verification requires a tag ref such as v1.0.0.");
  }

  if (releaseTag) {
    assert(releaseTag === `v${pkg.version}`, `Git tag ${releaseTag} does not match package.json version v${pkg.version}.`);
  }

  return { version: pkg.version, releaseTag };
}

function verifyAssets(assets) {
  for (const asset of assets) {
    const stat = statSync(asset, { throwIfNoEntry: false });
    assert(stat?.isFile(), `Expected release asset ${asset} is missing.`);
    assert(stat.size > 0, `Expected release asset ${asset} is empty.`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const requireTag = args.has("--require-tag");
  const assets = resolveExpectedAssets();
  const { version, releaseTag } = verifyMetadata({ requireTag });

  verifyAssets(assets);

  const tagSummary = releaseTag ? ` for ${releaseTag}` : "";
  console.log(`Release verification passed for ${version}${tagSummary}.`);
  console.log(`Verified assets: ${assets.join(", ")}`);
}

main();
