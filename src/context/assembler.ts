import { renderBlocksForFormat, renderTemplateString } from "../services/template-renderer";
import { truncateText } from "./truncation";
import type {
  CollectedContext,
  ContextIssue,
  IncludedSourceSummary,
  PromptBuildOverrides,
  PromptBuildResult,
  PromptSectionKind,
  PromptSource,
  PromptfireProfile,
  PromptfireTemplateBlock,
  RenderedPromptBlock,
  TemplateBlockId,
} from "./types";

interface IncludedSource extends PromptSource {
  characterCount: number;
  truncated: boolean;
}

interface PromptState {
  currentNote: IncludedSource[];
  includedSources: IncludedSource[];
  relatedNotes: IncludedSource[];
  vaultConventions: IncludedSource[];
}

function createEmptyPromptState(): PromptState {
  return {
    currentNote: [],
    includedSources: [],
    relatedNotes: [],
    vaultConventions: [],
  };
}

function sectionKey(section: PromptSectionKind): keyof PromptState {
  if (section === "vault-conventions") {
    return "vaultConventions";
  }

  if (section === "current-note") {
    return "currentNote";
  }

  return "relatedNotes";
}

function getTemplateBlock(
  profile: PromptfireProfile,
  blockId: TemplateBlockId,
): PromptfireTemplateBlock | undefined {
  return profile.templateBlocks.find((block) => block.id === blockId);
}

function renderMarkdownBlock(heading: string, content: string): string {
  return `## ${heading}\n${content}`.trim();
}

function buildSourceBody(source: IncludedSource, profile: PromptfireProfile): string {
  const lines = [`### ${source.title}`];

  if (profile.includeSourcePathLabels) {
    lines.push(`Path: ${source.path}`);
  }

  lines.push(source.content);
  return lines.join("\n").trim();
}

function buildSourcesBlockContent(
  sources: IncludedSource[],
  profile: PromptfireProfile,
): string {
  return sources.map((source) => buildSourceBody(source, profile)).join("\n\n").trim();
}

function buildWorkingRulesBlockContent(
  workingRules: string[],
  profile: PromptfireProfile,
  context: CollectedContext,
  result?: PromptBuildResult,
): string {
  return workingRules
    .map((rule) =>
      renderTemplateString(rule, {
        activeNotePath: context.activeNotePath,
        now: new Date(),
        profile,
        result,
      }),
    )
    .filter((rule) => rule.trim())
    .map((rule) => `- ${rule.trim()}`)
    .join("\n")
    .trim();
}

function buildIncludedSourcesBlockContent(includedSources: IncludedSource[]): string {
  return includedSources.map((source) => `- ${source.path}`).join("\n").trim();
}

function appendSource(state: PromptState, source: IncludedSource): PromptState {
  const key = sectionKey(source.section);

  return {
    ...state,
    [key]: [...state[key], source],
    includedSources: [...state.includedSources, source],
  };
}

function buildIssueFromSource(source: PromptSource, reason: string, message: string): ContextIssue {
  return {
    message,
    path: source.path,
    reason,
    sourceDefinitionId: source.sourceDefinitionId,
    sourceDefinitionLabel: source.sourceDefinitionLabel,
  };
}

function buildBlockIssue(blockId: TemplateBlockId, reason: string, message: string): ContextIssue {
  return {
    message,
    path: `(block:${blockId})`,
    reason,
  };
}

function summarizeSources(state: PromptState): IncludedSourceSummary[] {
  return state.includedSources.map((source) => ({
    characterCount: source.characterCount,
    enabled: true,
    id: source.id,
    kind: source.kind,
    originalCharacterCount: source.originalCharacterCount,
    path: source.path,
    priority: source.priority,
    section: source.section,
    sourceDefinitionId: source.sourceDefinitionId,
    sourceDefinitionLabel: source.sourceDefinitionLabel,
    sourceDefinitionType: source.sourceDefinitionType,
    title: source.title,
    truncated: source.truncated,
  }));
}

function getEnabledBlockIds(
  profile: PromptfireProfile,
  overrides?: PromptBuildOverrides,
): Set<TemplateBlockId> {
  const overrideBlockIds = overrides?.enabledBlockIds;
  const enabledBlocks = new Set<TemplateBlockId>();

  for (const block of profile.templateBlocks) {
    if (!block.enabled) {
      continue;
    }

    if (overrideBlockIds && !overrideBlockIds.includes(block.id)) {
      continue;
    }

    enabledBlocks.add(block.id);
  }

  return enabledBlocks;
}

function getEnabledSectionIds(
  profile: PromptfireProfile,
  overrides?: PromptBuildOverrides,
): Set<PromptSectionKind> {
  const enabledSections = new Set<PromptSectionKind>();

  for (const blockId of getEnabledBlockIds(profile, overrides)) {
    if (
      blockId === "vault-conventions" ||
      blockId === "current-note" ||
      blockId === "related-notes"
    ) {
      enabledSections.add(blockId);
    }
  }

  return enabledSections;
}

function sortSources(
  sources: PromptSource[],
  overrides?: PromptBuildOverrides,
): PromptSource[] {
  const reorderedIds = overrides?.reorderedSourceIds ?? [];
  const manualOrder = new Map<string, number>();
  reorderedIds.forEach((id, index) => manualOrder.set(id, index));
  const originalOrder = new Map<string, number>();
  sources.forEach((source, index) => originalOrder.set(source.id, index));

  return [...sources].sort((left, right) => {
    const leftManualIndex = manualOrder.get(left.id);
    const rightManualIndex = manualOrder.get(right.id);

    if (leftManualIndex !== undefined && rightManualIndex !== undefined) {
      return leftManualIndex - rightManualIndex;
    }

    if (leftManualIndex !== undefined) {
      return -1;
    }

    if (rightManualIndex !== undefined) {
      return 1;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0);
  });
}

function getSourceBudget(profile: PromptfireProfile, source: PromptSource): number | undefined {
  const sourceDefinition = profile.sourceDefinitions.find(
    (candidate) => candidate.id === source.sourceDefinitionId,
  );

  if (!sourceDefinition?.maxCharacters || sourceDefinition.maxCharacters <= 0) {
    return undefined;
  }

  return sourceDefinition.maxCharacters;
}

function applySourceBudget(
  source: PromptSource,
  profile: PromptfireProfile,
): IncludedSource {
  const sourceBudget = getSourceBudget(profile, source);

  if (!sourceBudget || source.content.length <= sourceBudget) {
    return {
      ...source,
      characterCount: source.content.length,
      truncated: false,
    };
  }

  const truncated = truncateText(source.content, sourceBudget);

  return {
    ...source,
    characterCount: truncated.text.length,
    content: truncated.text,
    truncated: true,
  };
}

function renderTaskInstruction(
  profile: PromptfireProfile,
  context: CollectedContext,
  result?: PromptBuildResult,
): string {
  return renderTemplateString(profile.taskInstruction.trim(), {
    activeNotePath: context.activeNotePath,
    now: new Date(),
    profile,
    result,
  }).trim();
}

function buildBlockContent(
  block: PromptfireTemplateBlock,
  state: PromptState,
  profile: PromptfireProfile,
  context: CollectedContext,
  result?: PromptBuildResult,
): string {
  if (block.id === "task") {
    return renderTaskInstruction(profile, context, result);
  }

  if (block.id === "vault-conventions") {
    return buildSourcesBlockContent(state.vaultConventions, profile);
  }

  if (block.id === "current-note") {
    return buildSourcesBlockContent(state.currentNote, profile);
  }

  if (block.id === "related-notes") {
    return buildSourcesBlockContent(state.relatedNotes, profile);
  }

  if (block.id === "working-rules") {
    return buildWorkingRulesBlockContent(profile.workingRules, profile, context, result);
  }

  return buildIncludedSourcesBlockContent(state.includedSources);
}

function applyBlockBudget(block: RenderedPromptBlock, maxCharacters?: number): RenderedPromptBlock {
  if (!maxCharacters || maxCharacters <= 0) {
    return block;
  }

  const renderedMarkdownBlock = renderMarkdownBlock(block.heading, block.content);

  if (renderedMarkdownBlock.length <= maxCharacters) {
    return block;
  }

  const prefix = `## ${block.heading}\n`;
  const remainingCharacters = Math.max(0, maxCharacters - prefix.length);
  const truncated = truncateText(block.content, remainingCharacters);

  return {
    ...block,
    characterCount: prefix.length + truncated.text.length,
    content: truncated.text,
  };
}

function buildRenderedBlocks(
  state: PromptState,
  profile: PromptfireProfile,
  context: CollectedContext,
  overrides?: PromptBuildOverrides,
  result?: PromptBuildResult,
): { blocks: RenderedPromptBlock[]; issues: ContextIssue[] } {
  const issues: ContextIssue[] = [];
  const enabledBlockIds = getEnabledBlockIds(profile, overrides);
  const blocks: RenderedPromptBlock[] = [];

  for (const block of profile.templateBlocks) {
    const enabled = enabledBlockIds.has(block.id);
    const heading = renderTemplateString(block.heading, {
      activeNotePath: context.activeNotePath,
      now: new Date(),
      profile,
      result,
    }).trim() || block.heading;

    let content = enabled ? buildBlockContent(block, state, profile, context, result) : "";

    if (!content) {
      blocks.push({
        characterCount: 0,
        content: "",
        enabled,
        heading,
        id: block.id,
      });
      continue;
    }

    let renderedBlock: RenderedPromptBlock = {
      characterCount: renderMarkdownBlock(heading, content).length,
      content,
      enabled,
      heading,
      id: block.id,
    };

    const previousContentLength = renderedBlock.content.length;
    renderedBlock = applyBlockBudget(renderedBlock, block.maxCharacters);

    if (block.maxCharacters && renderedBlock.content.length < previousContentLength) {
      issues.push(
        buildBlockIssue(
          block.id,
          "block-limit",
          `Promptfire truncated block "${block.id}" to stay within its block budget.`,
        ),
      );
    }

    blocks.push(renderedBlock);
  }

  return {
    blocks,
    issues,
  };
}

function enforceGlobalBudget(
  blocks: RenderedPromptBlock[],
  maxOutputCharacters: number,
): { blocks: RenderedPromptBlock[]; issues: ContextIssue[] } {
  const issues: ContextIssue[] = [];
  const nextBlocks: RenderedPromptBlock[] = [];
  let usedCharacters = 0;

  for (const block of blocks) {
    if (!block.enabled || !block.content.trim()) {
      nextBlocks.push(block);
      continue;
    }

    const renderedMarkdownBlock = renderMarkdownBlock(block.heading, block.content);
    const separatorLength = nextBlocks.some((candidate) => candidate.enabled && candidate.content.trim())
      ? 2
      : 0;
    const remainingCharacters = maxOutputCharacters - usedCharacters - separatorLength;

    if (remainingCharacters <= 0) {
      issues.push(
        buildBlockIssue(
          block.id,
          "output-limit",
          `Promptfire omitted block "${block.id}" because the global output limit was reached.`,
        ),
      );
      nextBlocks.push({
        ...block,
        content: "",
        enabled: false,
      });
      continue;
    }

    if (renderedMarkdownBlock.length <= remainingCharacters) {
      usedCharacters += separatorLength + renderedMarkdownBlock.length;
      nextBlocks.push({
        ...block,
        characterCount: renderedMarkdownBlock.length,
      });
      continue;
    }

    const prefix = `## ${block.heading}\n`;
    const allowedBodyCharacters = Math.max(0, remainingCharacters - prefix.length);
    const truncated = truncateText(block.content, allowedBodyCharacters);

    nextBlocks.push({
      ...block,
      characterCount: prefix.length + truncated.text.length,
      content: truncated.text,
    });
    usedCharacters = maxOutputCharacters;
    issues.push(
      buildBlockIssue(
        block.id,
        "output-limit",
        `Promptfire truncated block "${block.id}" to stay within the global output limit.`,
      ),
    );
  }

  return {
    blocks: nextBlocks,
    issues,
  };
}

function buildPromptFromSources(
  context: CollectedContext,
  profile: PromptfireProfile,
  candidateSources: PromptSource[],
  overrides?: PromptBuildOverrides,
): { blocks: RenderedPromptBlock[]; includedSources: IncludedSourceSummary[]; issues: ContextIssue[] } {
  const issues: ContextIssue[] = [];
  let state = createEmptyPromptState();

  for (const source of candidateSources) {
    const fittedSource = applySourceBudget(source, profile);

    if (fittedSource.truncated) {
      issues.push(
        buildIssueFromSource(
          source,
          "source-limit",
          `Promptfire truncated "${source.path}" to stay within its per-source budget.`,
        ),
      );
    }

    state = appendSource(state, fittedSource);
  }

  const firstPass = buildRenderedBlocks(state, profile, context, overrides);
  const firstPrompt = renderBlocksForFormat(
    firstPass.blocks,
    overrides?.outputFormat ?? "markdown",
  );
  const firstResult: PromptBuildResult = {
    blocks: firstPass.blocks,
    characterCount: firstPrompt.length,
    includedSourcePaths: state.includedSources.map((source) => source.path),
    includedSources: summarizeSources(state),
    issues: [...context.issues, ...issues, ...firstPass.issues],
    outputFormat: overrides?.outputFormat ?? "markdown",
    profileId: context.profileId,
    profileName: context.profileName,
    prompt: firstPrompt,
  };

  const secondPass = buildRenderedBlocks(state, profile, context, overrides, firstResult);
  const limited = enforceGlobalBudget(secondPass.blocks, profile.maxOutputCharacters);

  return {
    blocks: limited.blocks,
    includedSources: summarizeSources(state),
    issues: [...issues, ...secondPass.issues, ...limited.issues],
  };
}

export function assemblePrompt(
  context: CollectedContext,
  profile: PromptfireProfile,
  overrides?: PromptBuildOverrides,
): PromptBuildResult {
  const outputFormat = overrides?.outputFormat ?? "markdown";
  const enabledSections = getEnabledSectionIds(profile, overrides);
  const enabledSourceIds = overrides?.enabledSourceIds
    ? new Set(overrides.enabledSourceIds)
    : null;

  const issues = [...context.issues];
  const candidateSources: PromptSource[] = [];

  for (const source of context.sources) {
    if (enabledSourceIds && !enabledSourceIds.has(source.id)) {
      continue;
    }

    if (!enabledSections.has(source.section)) {
      continue;
    }

    candidateSources.push(source);
  }

  const sortedSources = sortSources(candidateSources, overrides);
  const compiled = buildPromptFromSources(context, profile, sortedSources, {
    ...overrides,
    outputFormat,
  });
  const prompt = renderBlocksForFormat(compiled.blocks, outputFormat);
  const result: PromptBuildResult = {
    blocks: compiled.blocks,
    characterCount: prompt.length,
    includedSourcePaths: compiled.includedSources.map((source) => source.path),
    includedSources: compiled.includedSources,
    issues: [...issues, ...compiled.issues],
    outputFormat,
    profileId: context.profileId,
    profileName: context.profileName,
    prompt,
  };

  return result;
}
