import { App, MarkdownView, TFile, TFolder } from "obsidian";

import type { PromptfireProfile, PromptfireSourceDefinition, SourceExtractMode } from "./types";
import {
  normalizeSearchIndexEntry,
  parseSearchQuery,
  scoreSearchIndexEntry,
  type SearchIndexEntry,
} from "./search-query";
import type { CollectedContext, ContextIssue, PromptSource } from "./types";

const CODE_BLOCK_PLACEHOLDER = "[code block omitted by Promptfire]";
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n?/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/gm;

interface CompiledSourcePatterns {
  excludePattern: RegExp | null;
  includePattern: RegExp | null;
}

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

function extractCodeBlocks(content: string): string {
  const matches = content.match(/```[\s\S]*?```/g) ?? [];
  return matches.join("\n\n").trim();
}

function extractSectionsByHeading(body: string, headingFilters: string[]): string {
  const filters = headingFilters.map((filter) => filter.trim().toLowerCase()).filter(Boolean);

  if (filters.length === 0) {
    return body.trim();
  }

  const headings = Array.from(body.matchAll(HEADING_PATTERN)).map((match) => ({
    index: match.index ?? 0,
    level: match[1]?.length ?? 0,
    title: match[2]?.trim() ?? "",
  }));

  if (headings.length === 0) {
    return "";
  }

  const sections: string[] = [];

  for (const [index, heading] of headings.entries()) {
    if (!heading.title) {
      continue;
    }

    const matchesFilter = filters.some((filter) => heading.title.toLowerCase().includes(filter));

    if (!matchesFilter) {
      continue;
    }

    let endIndex = body.length;

    for (let candidateIndex = index + 1; candidateIndex < headings.length; candidateIndex += 1) {
      const candidate = headings[candidateIndex];

      if (!candidate) {
        continue;
      }

      if (candidate.level <= heading.level) {
        endIndex = candidate.index;
        break;
      }
    }

    const section = body.slice(heading.index, endIndex).trim();

    if (section) {
      sections.push(section);
    }
  }

  return sections.join("\n\n").trim();
}

function applyExtractMode(
  rawContent: string,
  profile: PromptfireProfile,
  sourceDefinition: PromptfireSourceDefinition,
  treatAsSelection = false,
): string {
  const normalized = normalizeLineEndings(rawContent).trim();

  if (treatAsSelection) {
    if (sourceDefinition.extractMode === "frontmatter-only") {
      return "";
    }

    if (sourceDefinition.extractMode === "code-blocks") {
      return extractCodeBlocks(normalized);
    }

    if (sourceDefinition.extractMode === "heading-filtered") {
      return extractSectionsByHeading(normalized, sourceDefinition.headingFilters);
    }

    return profile.stripCodeBlocks ? stripFencedCodeBlocks(normalized).trim() : normalized;
  }

  const { body, frontmatter } = splitMarkdown(normalized);
  const safeBody = sourceDefinition.extractMode === "code-blocks" ? body : profile.stripCodeBlocks
    ? stripFencedCodeBlocks(body).trim()
    : body;

  const parts: string[] = [];

  if (sourceDefinition.extractMode === "frontmatter-only") {
    return profile.includeFrontmatter ? (frontmatter ?? "") : "";
  }

  if (sourceDefinition.extractMode === "body-only") {
    return profile.includeBody ? safeBody.trim() : "";
  }

  if (sourceDefinition.extractMode === "heading-filtered") {
    return profile.includeBody
      ? extractSectionsByHeading(safeBody, sourceDefinition.headingFilters)
      : "";
  }

  if (sourceDefinition.extractMode === "code-blocks") {
    return profile.includeBody ? extractCodeBlocks(body) : "";
  }

  if (profile.includeFrontmatter && frontmatter) {
    parts.push(frontmatter);
  }

  if (profile.includeBody && safeBody) {
    parts.push(safeBody);
  }

  return parts.join("\n\n").trim();
}

function parseRegexPattern(pattern: string): { flags: string; source: string } {
  const trimmed = pattern.trim();
  const literalMatch = trimmed.match(/^\/([\s\S]+)\/([a-z]*)$/i);

  if (literalMatch) {
    return {
      flags: literalMatch[2] ?? "",
      source: literalMatch[1] ?? "",
    };
  }

  return {
    flags: "",
    source: trimmed,
  };
}

function compilePattern(
  sourceDefinition: PromptfireSourceDefinition,
  pattern: string | undefined,
  kind: "regex-include" | "regex-exclude",
  issues: ContextIssue[],
): RegExp | null {
  const trimmed = pattern?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = parseRegexPattern(trimmed);
    const flags = parsed.flags.includes("g") ? parsed.flags : `${parsed.flags}g`;
    return new RegExp(parsed.source, flags);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push(
      buildIssue(
        sourceDefinition,
        "(regex)",
        kind,
        `Promptfire could not compile ${kind.replace("-", " ")} for source "${sourceDefinition.label}": ${message}`,
      ),
    );
    return null;
  }
}

function clonePattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}

function applyRegexPatterns(
  content: string,
  sourceDefinition: PromptfireSourceDefinition,
  patterns: CompiledSourcePatterns,
): string {
  let nextContent = content;

  if (patterns.includePattern) {
    const includeMatches = Array.from(nextContent.matchAll(clonePattern(patterns.includePattern)))
      .map((match) => match[0])
      .filter(Boolean);

    nextContent = includeMatches.join("\n").trim();
  }

  if (patterns.excludePattern && nextContent) {
    nextContent = nextContent.replace(clonePattern(patterns.excludePattern), "").trim();
  }

  if (sourceDefinition.extractMode !== "code-blocks") {
    nextContent = nextContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  return nextContent;
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

function createPromptSource(
  sourceDefinition: PromptfireSourceDefinition,
  file: TFile,
  content: string,
  originalCharacterCount: number,
): PromptSource {
  return {
    content,
    id: `${sourceDefinition.id}::${file.path}`,
    kind: sourceDefinition.type,
    originalCharacterCount,
    path: file.path,
    priority: sourceDefinition.priority,
    section: sourceDefinition.section,
    sourceDefinitionId: sourceDefinition.id,
    sourceDefinitionLabel: sourceDefinition.label,
    sourceDefinitionType: sourceDefinition.type,
    title: getSourceTitle(sourceDefinition, file),
  };
}

async function buildPromptSourceFromFile(
  app: App,
  file: TFile,
  sourceDefinition: PromptfireSourceDefinition,
  profile: PromptfireProfile,
  patterns: CompiledSourcePatterns,
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

  const rawContent = await app.vault.cachedRead(file);
  const extractedContent = applyExtractMode(rawContent, profile, sourceDefinition);
  const originalCharacterCount = extractedContent.length;
  const shapedContent = applyRegexPatterns(extractedContent, sourceDefinition, patterns);

  if (!shapedContent) {
    return {
      issue: buildIssue(
        sourceDefinition,
        file.path,
        "empty-after-filtering",
        `Promptfire skipped "${file.path}" because its extractor and regex filters produced an empty result.`,
      ),
      source: null,
    };
  }

  return {
    issue: null,
    source: createPromptSource(sourceDefinition, file, shapedContent, originalCharacterCount),
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

function buildSearchIndexEntry(app: App, file: TFile, text: string): SearchIndexEntry {
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
    const rawContent = await app.vault.cachedRead(file);
    const extractedContent = applyExtractMode(rawContent, profile, sourceDefinition);
    const searchEntry = buildSearchIndexEntry(app, file, extractedContent);
    const score = scoreSearchIndexEntry(searchEntry, clauses);

    if (score !== null) {
      matches.push({ file, score });
    }
  }

  return matches
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .map((match) => match.file);
}

function buildSelectionSource(
  app: App,
  file: TFile,
  sourceDefinition: PromptfireSourceDefinition,
  profile: PromptfireProfile,
  selectedText: string,
  patterns: CompiledSourcePatterns,
): { issue: ContextIssue | null; source: PromptSource | null } {
  const extractedContent = applyExtractMode(selectedText, profile, sourceDefinition, true);
  const originalCharacterCount = extractedContent.length;
  const shapedContent = applyRegexPatterns(extractedContent, sourceDefinition, patterns);

  if (!shapedContent) {
    return {
      issue: buildIssue(
        sourceDefinition,
        file.path,
        "empty-after-filtering",
        `Promptfire skipped the current selection in "${file.path}" because its extractor and regex filters produced an empty result.`,
      ),
      source: null,
    };
  }

  return {
    issue: null,
    source: createPromptSource(sourceDefinition, file, shapedContent, originalCharacterCount),
  };
}

function preparePatterns(
  sourceDefinition: PromptfireSourceDefinition,
  issues: ContextIssue[],
): CompiledSourcePatterns {
  return {
    excludePattern: compilePattern(
      sourceDefinition,
      sourceDefinition.regexExclude,
      "regex-exclude",
      issues,
    ),
    includePattern: compilePattern(
      sourceDefinition,
      sourceDefinition.regexInclude,
      "regex-include",
      issues,
    ),
  };
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

    const patterns = preparePatterns(sourceDefinition, issues);

    if (sourceDefinition.type === "active-note") {
      const file = ensureActiveMarkdownFile(sourceDefinition);

      if (!file || excludedPaths.has(file.path) || seenPaths.has(file.path)) {
        continue;
      }

      const selectedText = getActiveSelection(app, file);
      let issue: ContextIssue | null = null;
      let source: PromptSource | null = null;

      if (sourceDefinition.noteMode === "selection") {
        if (!selectedText) {
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

        ({ issue, source } = buildSelectionSource(
          app,
          file,
          sourceDefinition,
          profile,
          selectedText,
          patterns,
        ));
      } else if (sourceDefinition.noteMode === "selection-fallback-full" && selectedText) {
        ({ issue, source } = buildSelectionSource(
          app,
          file,
          sourceDefinition,
          profile,
          selectedText,
          patterns,
        ));
      } else {
        ({ issue, source } = await buildPromptSourceFromFile(
          app,
          file,
          sourceDefinition,
          profile,
          patterns,
        ));
      }

      if (issue) {
        issues.push(issue);
      }

      if (source) {
        sources.push(source);
        seenPaths.add(source.path);
      }

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

      const { issue, source } = await buildPromptSourceFromFile(
        app,
        file,
        sourceDefinition,
        profile,
        patterns,
      );

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
        const { issue, source } = await buildPromptSourceFromFile(
          app,
          file,
          sourceDefinition,
          profile,
          patterns,
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
          patterns,
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
        const { issue, source } = await buildPromptSourceFromFile(
          app,
          match,
          sourceDefinition,
          profile,
          patterns,
        );

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

  let activeNotePath: string | null = null;
  const resolvedActiveMarkdownFile = activeMarkdownFile as TFile | null;

  if (resolvedActiveMarkdownFile) {
    activeNotePath = resolvedActiveMarkdownFile.path;
  } else if (activeFile instanceof TFile && activeFile.extension === "md") {
    activeNotePath = activeFile.path;
  }

  return {
    activeNotePath,
    issues,
    profileId: profile.id,
    profileName: profile.name,
    sources,
  };
}
