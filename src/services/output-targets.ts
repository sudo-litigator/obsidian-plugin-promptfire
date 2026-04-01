import { App, Notice, TFile, normalizePath } from "obsidian";

import type { PromptBuildResult, PromptfireOutputTarget, PromptfireProfile } from "../context/types";
import { copyTextToClipboard } from "./clipboard";
import { renderTemplateString, type TemplateRenderContext } from "./template-renderer";

function getExtensionForFormat(format: PromptfireOutputTarget["format"]): string {
  if (format === "xml") {
    return "xml";
  }

  if (format === "json") {
    return "json";
  }

  return "md";
}

function ensureFileExtension(path: string, format: PromptfireOutputTarget["format"]): string {
  const normalizedPath = normalizePath(path);

  if (/\.[a-z0-9]+$/i.test(normalizedPath)) {
    return normalizedPath;
  }

  return `${normalizedPath}.${getExtensionForFormat(format)}`;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  if (!folderPath) {
    return;
  }

  const normalizedFolderPath = normalizePath(folderPath);
  const existing = app.vault.getAbstractFileByPath(normalizedFolderPath);

  if (existing) {
    return;
  }

  const segments = normalizedFolderPath.split("/");
  let currentPath = "";

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const current = app.vault.getAbstractFileByPath(currentPath);

    if (!current) {
      await app.vault.createFolder(currentPath);
    }
  }
}

async function createOrOverwriteFile(app: App, path: string, content: string): Promise<TFile> {
  const normalizedPath = normalizePath(path);
  const folderPath = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";
  await ensureFolder(app, folderPath);

  const existing = app.vault.getAbstractFileByPath(normalizedPath);

  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }

  return app.vault.create(normalizedPath, content);
}

async function createOrGetFile(app: App, path: string): Promise<TFile> {
  const normalizedPath = normalizePath(path);
  const folderPath = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";
  await ensureFolder(app, folderPath);

  const existing = app.vault.getAbstractFileByPath(normalizedPath);

  if (existing instanceof TFile) {
    return existing;
  }

  return app.vault.create(normalizedPath, "");
}

async function appendToFile(app: App, file: TFile, content: string, separator: string): Promise<void> {
  const existingContent = await app.vault.cachedRead(file);
  const nextContent = existingContent ? `${existingContent}${separator}${content}` : content;
  await app.vault.modify(file, nextContent);
}

export async function executeOutputTarget(
  app: App,
  profile: PromptfireProfile,
  target: PromptfireOutputTarget,
  result: PromptBuildResult,
  context: TemplateRenderContext,
): Promise<string> {
  const renderedContext = {
    ...context,
    outputTarget: target,
    profile,
    result,
  };
  const content = result.prompt;

  if (target.type === "clipboard") {
    await copyTextToClipboard(content);
    return `Copied prompt to clipboard using target "${target.label}".`;
  }

  if (target.type === "new-note" || target.type === "scratchpad-note") {
    const renderedPath = renderTemplateString(target.pathTemplate, renderedContext).trim();

    if (!renderedPath) {
      throw new Error(`Output target "${target.label}" needs a path template.`);
    }

    const finalPath = ensureFileExtension(renderedPath, target.format);
    const file = await createOrOverwriteFile(app, finalPath, content);

    if (target.openAfterWrite) {
      await app.workspace.getLeaf(true).openFile(file);
    }

    return `Wrote prompt to ${file.path}.`;
  }

  if (target.type === "append-active-note" || target.type === "append-note") {
    let targetFile = app.workspace.getActiveFile();

    if (target.type === "append-note") {
      const renderedPath = renderTemplateString(target.pathTemplate, renderedContext).trim();

      if (!renderedPath) {
        throw new Error(`Output target "${target.label}" needs a path template.`);
      }

      const finalPath = ensureFileExtension(renderedPath, target.format);
      targetFile = await createOrGetFile(app, finalPath);
    }

    if (!(targetFile instanceof TFile)) {
      throw new Error("Promptfire could not append because there is no target file.");
    }

    if (target.type === "append-active-note" && targetFile.extension !== "md") {
      throw new Error("Promptfire could not append because the active file is not a Markdown note.");
    }

    await appendToFile(app, targetFile, content, target.appendSeparator || "\n\n");

    if (target.openAfterWrite) {
      await app.workspace.getLeaf(true).openFile(targetFile);
    }

    return `Appended prompt to ${targetFile.path}.`;
  }

  if (target.type === "deep-link") {
    const renderedUrl = renderTemplateString(target.urlTemplate, renderedContext)
      .replace(/{{encodedPrompt}}/g, encodeURIComponent(content))
      .trim();

    if (!renderedUrl) {
      throw new Error(`Output target "${target.label}" needs a URL template.`);
    }

    window.open(renderedUrl, "_blank", "noopener,noreferrer");
    return `Opened deep link target "${target.label}".`;
  }

  new Notice(`Promptfire target "${target.label}" is not implemented.`);
  return `Promptfire target "${target.label}" is not implemented.`;
}
