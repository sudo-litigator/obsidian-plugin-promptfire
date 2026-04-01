import { App, MarkdownView, TFile, TFolder } from "obsidian";

import type { PromptfireSettings } from "../settings";
import type { CollectedContext, ContextIssue, PromptSource } from "./types";

const CODE_BLOCK_PLACEHOLDER = "[code block omitted by Promptfire]";
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n?/;

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function buildIssue(path: string, reason: string, message: string): ContextIssue {
  return { path, reason, message };
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

function shapeMarkdownContent(rawContent: string, settings: PromptfireSettings): string {
  const { body, frontmatter } = splitMarkdown(rawContent);
  const parts: string[] = [];

  if (settings.includeFrontmatter && frontmatter) {
    parts.push(frontmatter);
  }

  if (settings.includeBody && body) {
    parts.push(settings.stripCodeBlocks ? stripFencedCodeBlocks(body).trim() : body);
  }

  return parts.join("\n\n").trim();
}

function shapeSelectionContent(rawContent: string, settings: PromptfireSettings): string {
  const normalized = normalizeLineEndings(rawContent).trim();
  return settings.stripCodeBlocks ? stripFencedCodeBlocks(normalized).trim() : normalized;
}

function getActiveSelection(app: App, file: TFile): string {
  const markdownView = app.workspace.getActiveViewOfType(MarkdownView);

  if (!markdownView || markdownView.file?.path !== file.path) {
    return "";
  }

  return markdownView.editor?.getSelection().trim() ?? "";
}

async function readMarkdownFileAsSource(
  app: App,
  file: TFile,
  sourceTemplate: Omit<PromptSource, "content" | "path">,
  settings: PromptfireSettings,
): Promise<{ issue: ContextIssue | null; source: PromptSource | null }> {
  if (file.extension !== "md") {
    return {
      issue: buildIssue(
        file.path,
        "not-markdown",
        `Promptfire only supports Markdown sources. "${file.path}" was skipped.`,
      ),
      source: null,
    };
  }

  const shapedContent = shapeMarkdownContent(await app.vault.cachedRead(file), settings);

  if (!shapedContent) {
    return {
      issue: buildIssue(
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
      ...sourceTemplate,
      content: shapedContent,
      path: file.path,
    },
  };
}

function getFolderMarkdownFiles(app: App, folder: TFolder): TFile[] {
  const prefix = `${folder.path}/`;

  return app.vault
    .getMarkdownFiles()
    .filter((file) => file.path === folder.path || file.path.startsWith(prefix))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function getOutgoingLinkPaths(app: App, activeFile: TFile): string[] {
  const seenPaths = new Set<string>();
  const cache = app.metadataCache.getFileCache(activeFile);
  const linkPaths: string[] = [];

  for (const link of cache?.links ?? []) {
    const destination = app.metadataCache.getFirstLinkpathDest(link.link, activeFile.path);

    if (!destination || destination.extension !== "md" || destination.path === activeFile.path) {
      continue;
    }

    if (seenPaths.has(destination.path)) {
      continue;
    }

    seenPaths.add(destination.path);
    linkPaths.push(destination.path);
  }

  return linkPaths;
}

function getBacklinkPaths(app: App, activeFile: TFile): string[] {
  return Object.entries(app.metadataCache.resolvedLinks)
    .filter(([sourcePath, destinations]) => {
      return sourcePath !== activeFile.path && Object.prototype.hasOwnProperty.call(destinations, activeFile.path);
    })
    .map(([sourcePath]) => sourcePath)
    .sort((left, right) => left.localeCompare(right));
}

function applyLimit(paths: string[], maxItems: number): { paths: string[]; omittedCount: number } {
  const limitedPaths = paths.slice(0, maxItems);
  return {
    omittedCount: Math.max(0, paths.length - limitedPaths.length),
    paths: limitedPaths,
  };
}

export async function collectContext(
  app: App,
  settings: PromptfireSettings,
): Promise<CollectedContext> {
  const conventionSources: PromptSource[] = [];
  const relatedSources: PromptSource[] = [];
  const issues: ContextIssue[] = [];
  const seenPaths = new Set<string>();
  const excludedPaths = new Set(settings.excludeNotePaths);

  for (const rawPath of settings.referenceNotePaths) {
    const path = rawPath.trim();

    if (!path || excludedPaths.has(path) || seenPaths.has(path)) {
      continue;
    }

    const file = app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) {
      issues.push(buildIssue(path, "not-found", `Promptfire could not find "${path}".`));
      continue;
    }

    const { issue, source } = await readMarkdownFileAsSource(
      app,
      file,
      {
        kind: "reference-note",
        section: "vault-conventions",
        title: "Reference Note",
      },
      settings,
    );

    if (issue) {
      issues.push(issue);
    }

    if (source) {
      conventionSources.push(source);
      seenPaths.add(source.path);
    }
  }

  for (const rawFolderPath of settings.referenceFolderPaths) {
    const folderPath = rawFolderPath.trim();

    if (!folderPath) {
      continue;
    }

    const folder = app.vault.getAbstractFileByPath(folderPath);

    if (!(folder instanceof TFolder)) {
      issues.push(
        buildIssue(
          folderPath,
          "not-folder",
          `Promptfire could not find folder "${folderPath}" for folder-based context collection.`,
        ),
      );
      continue;
    }

    for (const file of getFolderMarkdownFiles(app, folder)) {
      if (excludedPaths.has(file.path) || seenPaths.has(file.path)) {
        continue;
      }

      const { issue, source } = await readMarkdownFileAsSource(
        app,
        file,
        {
          kind: "reference-folder-note",
          section: "vault-conventions",
          title: "Reference Folder Note",
        },
        settings,
      );

      if (issue) {
        issues.push(issue);
      }

      if (source) {
        conventionSources.push(source);
        seenPaths.add(source.path);
      }
    }
  }

  const activeFile = app.workspace.getActiveFile();
  let currentNote: PromptSource | null = null;
  const activeNoteNeeded =
    settings.includeActiveNote || settings.includeOutgoingLinks || settings.includeBacklinks;

  if (activeNoteNeeded) {
    if (!activeFile) {
      issues.push(
        buildIssue(
          "(active note)",
          "missing-active-note",
          "Promptfire did not find an active Markdown note for note-specific context collection.",
        ),
      );
    } else if (activeFile.extension !== "md") {
      issues.push(
        buildIssue(
          activeFile.path,
          "active-note-not-markdown",
          `The active file "${activeFile.path}" is not a Markdown note and was skipped.`,
        ),
      );
    } else {
      if (settings.includeActiveNote && !excludedPaths.has(activeFile.path)) {
        const selectedText = getActiveSelection(app, activeFile);
        let noteContent = "";
        let noteTitle = "Current Note";

        if (settings.activeNoteMode === "selection") {
          noteContent = shapeSelectionContent(selectedText, settings);
          noteTitle = "Current Note Selection";

          if (!noteContent) {
            issues.push(
              buildIssue(
                activeFile.path,
                "missing-selection",
                `Promptfire is set to selection-only mode, but no editor selection was found in "${activeFile.path}".`,
              ),
            );
          }
        } else if (settings.activeNoteMode === "selection-fallback-full" && selectedText) {
          noteContent = shapeSelectionContent(selectedText, settings);
          noteTitle = "Current Note Selection";
        } else {
          noteContent = shapeMarkdownContent(await app.vault.cachedRead(activeFile), settings);
        }

        if (noteContent) {
          currentNote = {
            content: noteContent,
            kind: "active-note",
            path: activeFile.path,
            section: "current-note",
            title: noteTitle,
          };
          seenPaths.add(activeFile.path);
        } else if (settings.includeActiveNote && settings.activeNoteMode !== "selection") {
          issues.push(
            buildIssue(
              activeFile.path,
              "empty-after-filtering",
              `Promptfire skipped "${activeFile.path}" because the current content filters produced an empty result.`,
            ),
          );
        }
      }

      if (settings.includeOutgoingLinks) {
        const outgoingLinkCandidates = getOutgoingLinkPaths(app, activeFile).filter((path) => {
          return !excludedPaths.has(path) && !seenPaths.has(path);
        });
        const { omittedCount, paths } = applyLimit(outgoingLinkCandidates, settings.maxOutgoingLinks);

        if (omittedCount > 0) {
          issues.push(
            buildIssue(
              activeFile.path,
              "outgoing-link-limit",
              `Promptfire limited outgoing linked notes to ${paths.length}. ${omittedCount} additional note(s) were skipped.`,
            ),
          );
        }

        for (const path of paths) {
          const file = app.vault.getAbstractFileByPath(path);

          if (!(file instanceof TFile)) {
            continue;
          }

          const { issue, source } = await readMarkdownFileAsSource(
            app,
            file,
            {
              kind: "outgoing-link",
              section: "related-notes",
              title: "Linked Note",
            },
            settings,
          );

          if (issue) {
            issues.push(issue);
          }

          if (source) {
            relatedSources.push(source);
            seenPaths.add(source.path);
          }
        }
      }

      if (settings.includeBacklinks) {
        const backlinkCandidates = getBacklinkPaths(app, activeFile).filter((path) => {
          return !excludedPaths.has(path) && !seenPaths.has(path);
        });
        const { omittedCount, paths } = applyLimit(backlinkCandidates, settings.maxBacklinks);

        if (omittedCount > 0) {
          issues.push(
            buildIssue(
              activeFile.path,
              "backlink-limit",
              `Promptfire limited backlinks to ${paths.length}. ${omittedCount} additional note(s) were skipped.`,
            ),
          );
        }

        for (const path of paths) {
          const file = app.vault.getAbstractFileByPath(path);

          if (!(file instanceof TFile)) {
            continue;
          }

          const { issue, source } = await readMarkdownFileAsSource(
            app,
            file,
            {
              kind: "backlink",
              section: "related-notes",
              title: "Backlink",
            },
            settings,
          );

          if (issue) {
            issues.push(issue);
          }

          if (source) {
            relatedSources.push(source);
            seenPaths.add(source.path);
          }
        }
      }
    }
  }

  return {
    conventionSources,
    currentNote,
    issues,
    relatedSources,
  };
}
