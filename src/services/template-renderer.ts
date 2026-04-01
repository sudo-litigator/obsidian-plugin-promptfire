import type {
  PromptBuildResult,
  PromptfireOutputTarget,
  PromptfireProfile,
  RenderedPromptBlock,
} from "../context/types";

export interface TemplateRenderContext {
  activeNotePath: string | null;
  now: Date;
  outputTarget?: PromptfireOutputTarget;
  profile: PromptfireProfile;
  result?: PromptBuildResult;
}

function getValueMap(context: TemplateRenderContext): Record<string, string> {
  const activeNotePath = context.activeNotePath ?? "";
  const activeNoteName = activeNotePath.split("/").pop()?.replace(/\.md$/i, "") ?? "";
  const result = context.result;

  return {
    "activeNote.name": activeNoteName,
    "activeNote.path": activeNotePath,
    "date.iso": context.now.toISOString(),
    "date.local": context.now.toLocaleString(),
    "outputTarget.label": context.outputTarget?.label ?? "",
    "outputTarget.type": context.outputTarget?.type ?? "",
    "profile.id": context.profile.id,
    "profile.name": context.profile.name,
    "prompt.characterCount": result ? String(result.characterCount) : "",
    "prompt.format": result?.outputFormat ?? "",
    "prompt.sourceCount": result ? String(result.includedSources.length) : "",
  };
}

function resolveCondition(key: string, context: TemplateRenderContext): boolean {
  const value = getValueMap(context)[key] ?? "";
  return Boolean(value);
}

function renderConditionals(template: string, context: TemplateRenderContext): string {
  return template.replace(
    /{{#if\s+([\w.]+)}}([\s\S]*?){{\/if}}/g,
    (_match, key: string, content: string) => {
      return resolveCondition(key, context) ? content : "";
    },
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderTemplateString(template: string, context: TemplateRenderContext): string {
  const values = getValueMap(context);
  const withConditionals = renderConditionals(template, context);

  return withConditionals.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

export function renderBlocksForFormat(
  blocks: RenderedPromptBlock[],
  format: "markdown" | "xml" | "json",
): string {
  const enabledBlocks = blocks.filter((block) => block.enabled && block.content.trim());

  if (format === "xml") {
    const xmlBlocks = enabledBlocks
      .map((block) => {
        const escapedHeading = escapeXml(block.heading);
        const escapedContent = escapeXml(block.content);
        return `<block id="${block.id}" heading="${escapedHeading}">\n${escapedContent}\n</block>`;
      })
      .join("\n\n");

    return `<promptfire>\n${xmlBlocks}\n</promptfire>\n`;
  }

  if (format === "json") {
    return `${JSON.stringify(
      enabledBlocks.map((block) => ({
        content: block.content,
        heading: block.heading,
        id: block.id,
      })),
      null,
      2,
    )}\n`;
  }

  return `${enabledBlocks
    .map((block) => `## ${block.heading}\n${block.content}`.trim())
    .join("\n\n")}\n`;
}
