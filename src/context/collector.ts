import { App, MarkdownView, TFile, TFolder } from "obsidian";

import type { PromptfireProfile, PromptfireSourceDefinition } from "./types";
import {
  normalizeSearchIndexEntry,
  parseSearchQuery,
  scoreSearchIndexEntry,
  type SearchIndexEntry,
} from "./search-query";
import type { CollectedContext, ContextIssue, PromptSource } from "./types";

const CODE_BLOCK_PLACEHOLDER = "[code block omitted by Promptfire]";
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n?/;

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function buildIssue(
  sourceDefinition: PromptfireSourceDefinition,
  path: string,
  reason: string,
  message: string,
): ContextIssue {
  return {
    message,
    path,
    reason,
    sourceDefinitionId: sourceDefinition.id,
    sourceDefinitionLabel: sourceDefinition.label,
  };
}

function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, CODE_BLOCK_PLACEHOLDER);
}

function splitMarkdown(rawContent: string): { body: string; frontmatter: string | null } {
  const normalized = normalizeLineEndings(rawContent);
  const match = normalized.match(FRONTMATTER_PATTERN);

  if (!match) {
    return {
      body: normalized.trim(),
      frontmatter: null,
    };
  }

  const frontmatter = match[0].trimEnd();
  const body = normalized.slice(match[0].length).trim();

  return {
    body,
    frontmatter,
  };
}

function shapeMarkdownContent(rawContent: string, profile: PromptfireProfile): string {
  const { body, frontmatter } = splitMarkdown(rawContent);
  const parts: string[] = [];

  if (profile.includeFrontmatter && frontmatter) {
    parts.push(frontmatter);
  }

  if (profile.includeBody && body) {
    parts.push(profile.stripCodeBlocks ? stripFencedCodeBlocks(body).trim() : body);
  }

  return parts.join("\n\n").trim();
}

function shapeSelectionContent(rawContent: string, profile: PromptfireProfile): string {
  const normalized = normalizeLineEndings(rawContent).trim();
  return profile.stripCodeBlocks ? stripFencedCodeBlocks(normalized).trim() : normalized;
}

function getSourceTitle(sourceDefinition: PromptfireSourceDefinition, file: TFile | null): string {
  if (!file) {
    return sourceDefinition.label;
  }

  if (sourceDefinition.type === "active-note" || sourceDefinition.type === "file") {
    return sourceDefinition.label;
  }

  return `${sourceDefinition.label}: ${file.basename}`;
}

function getActiveSelection(app: App, file: TFile): string {
  const markdownView = app.workspace.getActiveViewOfType(MarkdownView);

  if (!markdownView || markdownView.file?.path !== file.path) {
    return "";
  }

  return markdownView.editor?.getSelection().trim() ?? "";
}

async function buildPromptSourceFromFile(
  app: App,
  file: TFile,
  sourceDefinition: PromptfireSourceDefinition,
  profile: PromptfireProfile,
): Promise<{ issue: ContextIssue | null; source: PromptSource | null }> {
  if (file.extension !== "md") {
    return {
      issue: buildIssue(
        sourceDefinition,
        file.path,
        "not-markdown",
        `Promptfire only supports Markdown sources. "${file.path}" was skipped.`,
      ),
      source: null,
    };
  }

  const shapedContent = shapeMarkdownContent(await app.vault.cachedRead(file), profile);

  if (!shapedContent) {
    return {
      issue: buildIssue(
        sourceDefinition,
        file.path,
        "empty-after-filtering",
        `Promptfire skipped "${file.path}" because the current content filters produced an empty result.`,
      ),
      source: null,
    };
  }

  return {
    issue: null,
    source: {
      content: shapedContent,
      kind: sourceDefinition.type,
      originalCharacterCount: shapedContent.length,
      path: file.path,
      section: sourceDefinition.section,
      sourceDefinitionId: sourceDefinition.id,
      sourceDefinitionLabel: sourceDefinition.label,
      sourceDefinitionType: sourceDefinition.type,
      title: getSourceTitle(sourceDefinition, file),
    },
  };
}

function getMarkdownFilesForFolder(app: App, folder: TFolder, recursive: boolean): TFile[] {
  const prefix = `${folder.path}/`;

  return app.vault
    .getMarkdownFiles()
    .filter((file) => {
      if (!file.path.startsWith(prefix)) {
        return false;
      }

      return recursive ? true : file.parent?.path === folder.path;
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function getOutgoingLinkedFiles(app: App, activeFile: TFile): TFile[] {
  const seenPaths = new Set<string>();
  const fileCache = app.metadataCache.getFileCache(activeFile);
  const files: TFile[] = [];

  for (const link of fileCache?.links ?? []) {
    const destination = app.metadataCache.getFirstLinkpathDest(link.link, activeFile.path);

    if (!destination || destination.extension !== "md" || destination.path === activeFile.path) {
      continue;
    }

    if (seenPaths.has(destination.path)) {
      continue;
    }

    seenPaths.add(destination.path);
    files.push(destination);
  }

  return files;
}

function getBacklinkedFiles(app: App, activeFile: TFile): TFile[] {
  return Object.entries(app.metadataCache.resolvedLinks)
    .filter(([sourcePath, destinations]) => {
      return (
        sourcePath !== activeFile.path &&
        Object.prototype.hasOwnProperty.call(destinations, activeFile.path)
      );
    })
    .map(([sourcePath]) => app.vault.getAbstractFileByPath(sourcePath))
    .filter((file): file is TFile => file instanceof TFile && file.extension === "md")
    .sort((left, right) => left.path.localeCompare(right.path));
}

function applyItemLimit<T>(items: T[], maxItems: number): { items: T[]; omittedCount: number } {
  const limitedItems = items.slice(0, maxItems);
  return {
    items: limitedItems,
    omittedCount: Math.max(0, items.length - limitedItems.length),
  };
}

function appendFrontmatterValue(
  target: Record<string, string[]>,
  key: string,
  value: unknown,
): void {
  if (value === null || value === undefined) {
    return;
  }

  const normalizedKey = key.toLowerCase();

  if (Array.isArray(value)) {
    for (const item of value) {
      appendFrontmatterValue(target, normalizedKey, item);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendFrontmatterValue(target, `${normalizedKey}.${childKey}`, childValue);
    }
    return;
  }

  const currentValues = target[normalizedKey] ?? [];
  currentValues.push(String(value));
  target[normalizedKey] = currentValues;
}

function getFrontmatterIndex(file: TFile, app: App): Record<string, string[]> {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  const index: Record<string, string[]> = {};

  if (!frontmatter) {
    return index;
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    appendFrontmatterValue(index, key, value);
  }

  return index;
}

function buildSearchIndexEntry(
  app: App,
  file: TFile,
  text: string,
): SearchIndexEntry {
  const fileCache = app.metadataCache.getFileCache(file);

  return normalizeSearchIndexEntry({
    file,
    frontmatter: getFrontmatterIndex(file, app),
    headings: (fileCache?.headings ?? []).map((heading) => heading.heading),
    name: file.basename,
    path: file.path,
    tags: (fileCache?.tags ?? []).map((tag) => tag.tag),
    text,
  });
}

async function getSearchMatches(
  app: App,
  sourceDefinition: PromptfireSourceDefinition,
  profile: PromptfireProfile,
): Promise<TFile[]> {
  const query = sourceDefinition.query?.trim();

  if (!query) {
    return [];
  }

  const clauses = parseSearchQuery(query);

  if (clauses.length === 0) {
    return [];
  }

  const matches: Array<{ file: TFile; score: number }> = [];

  for (const file of app.vault
    .getMarkdownFiles()
    .sort((left, right) => left.path.localeCompare(right.path))) {
    const shapedContent = shapeMarkdownContent(await app.vault.cachedRead(file), profile);
    const searchEntry = buildSearchIndexEntry(app, file, shapedContent);
    const score = scoreSearchIndexEntry(searchEntry, clauses);

    if (score !== null) {
      matches.push({ file, score });
    }
  }

  return matches
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .map((match) => match.file);
}

export async function collectContext(
  app: App,
  profile: PromptfireProfile,
): Promise<CollectedContext> {
  const issues: ContextIssue[] = [];
  const sources: PromptSource[] = [];
  const excludedPaths = new Set(profile.excludeNotePaths);
  const seenPaths = new Set<string>();

  const activeFile = app.workspace.getActiveFile();
  let activeMarkdownFile: TFile | null = null;
  let activeFileIssueEmitted = false;

  function ensureActiveMarkdownFile(sourceDefinition: PromptfireSourceDefinition): TFile | null {
    if (activeMarkdownFile) {
      return activeMarkdownFile;
    }

    if (!activeFileIssueEmitted) {
      if (!activeFile) {
        issues.push(
          buildIssue(
            sourceDefinition,
            "(active note)",
            "missing-active-note",
            "Promptfire did not find an active Markdown note for this source definition.",
          ),
        );
      } else if (activeFile.extension !== "md") {
        issues.push(
          buildIssue(
            sourceDefinition,
            activeFile.path,
            "active-note-not-markdown",
            `The active file "${activeFile.path}" is not a Markdown note and was skipped.`,
          ),
        );
      }

      activeFileIssueEmitted = true;
    }

    if (activeFile instanceof TFile && activeFile.extension === "md") {
      activeMarkdownFile = activeFile;
      return activeMarkdownFile;
    }

    return null;
  }

  for (const sourceDefinition of profile.sourceDefinitions) {
    if (!sourceDefinition.enabled) {
      continue;
    }

    if (sourceDefinition.type === "active-note") {
      const file = ensureActiveMarkdownFile(sourceDefinition);

      if (!file || excludedPaths.has(file.path) || seenPaths.has(file.path)) {
        continue;
      }

      const selectedText = getActiveSelection(app, file);
      let noteContent = "";

      if (sourceDefinition.noteMode === "selection") {
        noteContent = shapeSelectionContent(selectedText, profile);

        if (!noteContent) {
          issues.push(
            buildIssue(
              sourceDefinition,
              file.path,
              "missing-selection",
              `Promptfire is set to selection-only mode, but no editor selection was found in "${file.path}".`,
            ),
          );
          continue;
        }
      } else if (sourceDefinition.noteMode === "selection-fallback-full" && selectedText) {
        noteContent = shapeSelectionContent(selectedText, profile);
      } else {
        noteContent = shapeMarkdownContent(await app.vault.cachedRead(file), profile);
      }

      if (!noteContent) {
        issues.push(
          buildIssue(
            sourceDefinition,
            file.path,
            "empty-after-filtering",
            `Promptfire skipped "${file.path}" because the current content filters produced an empty result.`,
          ),
        );
        continue;
      }

      sources.push({
        content: noteContent,
        kind: sourceDefinition.type,
        originalCharacterCount: noteContent.length,
        path: file.path,
        section: sourceDefinition.section,
        sourceDefinitionId: sourceDefinition.id,
        sourceDefinitionLabel: sourceDefinition.label,
        sourceDefinitionType: sourceDefinition.type,
        title: sourceDefinition.label,
      });
      seenPaths.add(file.path);
      continue;
    }

    if (sourceDefinition.type === "file") {
      const path = sourceDefinition.path?.trim();

      if (!path) {
        issues.push(
          buildIssue(
            sourceDefinition,
            "(missing path)",
            "missing-path",
            `Promptfire source "${sourceDefinition.label}" needs a file path.`,
          ),
        );
        continue;
      }

      if (excludedPaths.has(path) || seenPaths.has(path)) {
        continue;
      }

      const file = app.vault.getAbstractFileByPath(path);

      if (!(file instanceof TFile)) {
        issues.push(
          buildIssue(
            sourceDefinition,
            path,
            "not-found",
            `Promptfire could not find file "${path}" for source "${sourceDefinition.label}".`,
          ),
        );
        continue;
      }

      const { issue, source } = await buildPromptSourceFromFile(app, file, sourceDefinition, profile);

      if (issue) {
        issues.push(issue);
      }

      if (source) {
        sources.push(source);
        seenPaths.add(source.path);
      }

      continue;
    }

    if (sourceDefinition.type === "folder") {
      const path = sourceDefinition.path?.trim();

      if (!path) {
        issues.push(
          buildIssue(
            sourceDefinition,
            "(missing path)",
            "missing-path",
            `Promptfire source "${sourceDefinition.label}" needs a folder path.`,
          ),
        );
        continue;
      }

      const folder = app.vault.getAbstractFileByPath(path);

      if (!(folder instanceof TFolder)) {
        issues.push(
          buildIssue(
            sourceDefinition,
            path,
            "not-folder",
            `Promptfire could not find folder "${path}" for source "${sourceDefinition.label}".`,
          ),
        );
        continue;
      }

      const folderFiles = getMarkdownFilesForFolder(app, folder, sourceDefinition.recursive ?? true).filter(
        (file) => !excludedPaths.has(file.path) && !seenPaths.has(file.path),
      );
      const limited = applyItemLimit(folderFiles, sourceDefinition.maxItems ?? 5);

      if (limited.omittedCount > 0) {
        issues.push(
          buildIssue(
            sourceDefinition,
            folder.path,
            "folder-limit",
            `Promptfire limited folder source "${sourceDefinition.label}" to ${limited.items.length} note(s). ${limited.omittedCount} additional note(s) were skipped.`,
          ),
        );
      }

      for (const file of limited.items) {
        const { issue, source } = await buildPromptSourceFromFile(app, file, sourceDefinition, profile);

        if (issue) {
          issues.push(issue);
        }

        if (source) {
          sources.push(source);
          seenPaths.add(source.path);
        }
      }

      continue;
    }

    if (sourceDefinition.type === "outgoing-links" || sourceDefinition.type === "backlinks") {
      const file = ensureActiveMarkdownFile(sourceDefinition);

      if (!file) {
        continue;
      }

      const linkedFiles =
        sourceDefinition.type === "outgoing-links"
          ? getOutgoingLinkedFiles(app, file)
          : getBacklinkedFiles(app, file);
      const filteredFiles = linkedFiles.filter(
        (candidate) => !excludedPaths.has(candidate.path) && !seenPaths.has(candidate.path),
      );
      const limited = applyItemLimit(filteredFiles, sourceDefinition.maxItems ?? 5);

      if (limited.omittedCount > 0) {
        issues.push(
          buildIssue(
            sourceDefinition,
            file.path,
            "linked-note-limit",
            `Promptfire limited source "${sourceDefinition.label}" to ${limited.items.length} note(s). ${limited.omittedCount} additional note(s) were skipped.`,
          ),
        );
      }

      for (const linkedFile of limited.items) {
        const { issue, source } = await buildPromptSourceFromFile(
          app,
          linkedFile,
          sourceDefinition,
          profile,
        );

        if (issue) {
          issues.push(issue);
        }

        if (source) {
          sources.push(source);
          seenPaths.add(source.path);
        }
      }

      continue;
    }

    if (sourceDefinition.type === "search") {
      const query = sourceDefinition.query?.trim();

      if (!query) {
        issues.push(
          buildIssue(
            sourceDefinition,
            "(missing query)",
            "missing-query",
            `Promptfire source "${sourceDefinition.label}" needs a search query.`,
          ),
        );
        continue;
      }

      const matches = await getSearchMatches(app, sourceDefinition, profile);
      const filteredMatches = matches.filter(
        (candidate) => !excludedPaths.has(candidate.path) && !seenPaths.has(candidate.path),
      );
      const limited = applyItemLimit(filteredMatches, sourceDefinition.maxItems ?? 5);

      if (limited.omittedCount > 0) {
        issues.push(
          buildIssue(
            sourceDefinition,
            query,
            "search-limit",
            `Promptfire limited search source "${sourceDefinition.label}" to ${limited.items.length} note(s). ${limited.omittedCount} additional note(s) were skipped.`,
          ),
        );
      }

      for (const match of limited.items) {
        const { issue, source } = await buildPromptSourceFromFile(app, match, sourceDefinition, profile);

        if (issue) {
          issues.push(issue);
        }

        if (source) {
          sources.push(source);
          seenPaths.add(source.path);
        }
      }
    }
  }

  return {
    issues,
    profileId: profile.id,
    profileName: profile.name,
    sources,
  };
}
