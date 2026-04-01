import type { PromptfireProfile, PromptfireTemplateBlock, TemplateBlockId } from "./types";
import { truncateText } from "./truncation";
import type {
  CollectedContext,
  ContextIssue,
  IncludedSourceSummary,
  PromptBuildResult,
  PromptSectionKind,
  PromptSource,
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

function buildSourceBlock(source: IncludedSource, profile: PromptfireProfile): string {
  const lines = [`### ${source.title}`];

  if (profile.includeSourcePathLabels) {
    lines.push(`Path: ${source.path}`);
  }

  lines.push(source.content);
  return lines.join("\n");
}

function buildSourcesSection(
  block: PromptfireTemplateBlock,
  sources: IncludedSource[],
  profile: PromptfireProfile,
): string {
  const parts = [`## ${block.heading}`];

  for (const source of sources) {
    parts.push("", buildSourceBlock(source, profile));
  }

  return parts.join("\n");
}

function buildWorkingRulesSection(block: PromptfireTemplateBlock, workingRules: string[]): string {
  return [`## ${block.heading}`, ...workingRules.map((rule) => `- ${rule}`)].join("\n");
}

function buildIncludedSourcesSection(
  block: PromptfireTemplateBlock,
  includedSources: IncludedSource[],
): string {
  return [
    `## ${block.heading}`,
    ...includedSources.map((source) => `- ${source.path}`),
  ].join("\n");
}

function buildPrompt(state: PromptState, profile: PromptfireProfile): string {
  const parts: string[] = ["# Promptfire Context"];

  for (const block of profile.templateBlocks) {
    if (!block.enabled) {
      continue;
    }

    if (block.id === "task") {
      if (profile.taskInstruction.trim()) {
        parts.push("", `## ${block.heading}`, profile.taskInstruction.trim());
      }
      continue;
    }

    if (block.id === "vault-conventions" && state.vaultConventions.length > 0) {
      parts.push("", buildSourcesSection(block, state.vaultConventions, profile));
      continue;
    }

    if (block.id === "current-note" && state.currentNote.length > 0) {
      parts.push("", buildSourcesSection(block, state.currentNote, profile));
      continue;
    }

    if (block.id === "related-notes" && state.relatedNotes.length > 0) {
      parts.push("", buildSourcesSection(block, state.relatedNotes, profile));
      continue;
    }

    if (block.id === "working-rules" && profile.workingRules.length > 0) {
      parts.push("", buildWorkingRulesSection(block, profile.workingRules));
      continue;
    }

    if (block.id === "included-sources" && state.includedSources.length > 0) {
      parts.push("", buildIncludedSourcesSection(block, state.includedSources));
    }
  }

  return `${parts.join("\n")}\n`;
}

function appendSource(state: PromptState, source: IncludedSource): PromptState {
  const key = sectionKey(source.section);

  return {
    ...state,
    [key]: [...state[key], source],
    includedSources: [...state.includedSources, source],
  };
}

function fitSourceContent(
  state: PromptState,
  candidate: PromptSource,
  profile: PromptfireProfile,
): IncludedSource | null {
  const fullSource: IncludedSource = {
    ...candidate,
    characterCount: candidate.content.length,
    truncated: false,
  };
  const fullState = appendSource(state, fullSource);
  const fullPrompt = buildPrompt(fullState, profile);

  if (fullPrompt.length <= profile.maxOutputCharacters) {
    return fullSource;
  }

  const emptySource: IncludedSource = {
    ...candidate,
    characterCount: 0,
    content: "",
    truncated: false,
  };
  const skeletonState = appendSource(state, emptySource);
  const skeletonPrompt = buildPrompt(skeletonState, profile);
  const remainingForContent = profile.maxOutputCharacters - skeletonPrompt.length;

  if (remainingForContent <= 0) {
    return null;
  }

  const truncated = truncateText(candidate.content, remainingForContent);

  return {
    ...candidate,
    characterCount: truncated.text.length,
    content: truncated.text,
    truncated: truncated.wasTruncated,
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

function summarizeSources(state: PromptState): IncludedSourceSummary[] {
  return state.includedSources.map((source) => ({
    characterCount: source.characterCount,
    kind: source.kind,
    originalCharacterCount: source.originalCharacterCount,
    path: source.path,
    section: source.section,
    sourceDefinitionId: source.sourceDefinitionId,
    sourceDefinitionLabel: source.sourceDefinitionLabel,
    sourceDefinitionType: source.sourceDefinitionType,
    title: source.title,
    truncated: source.truncated,
  }));
}

function getEnabledSectionIds(profile: PromptfireProfile): Set<PromptSectionKind> {
  const enabledSections = new Set<PromptSectionKind>();

  for (const block of profile.templateBlocks) {
    if (!block.enabled) {
      continue;
    }

    if (
      block.id === "vault-conventions" ||
      block.id === "current-note" ||
      block.id === "related-notes"
    ) {
      enabledSections.add(block.id);
    }
  }

  return enabledSections;
}

export function assemblePrompt(
  context: CollectedContext,
  profile: PromptfireProfile,
): PromptBuildResult {
  const issues = [...context.issues];
  const enabledSections = getEnabledSectionIds(profile);
  const candidateSources: PromptSource[] = [];

  for (const source of context.sources) {
    if (!enabledSections.has(source.section)) {
      issues.push(
        buildIssueFromSource(
          source,
          "section-disabled",
          `Promptfire skipped "${source.path}" because the template block for section "${source.section}" is disabled.`,
        ),
      );
      continue;
    }

    candidateSources.push(source);
  }

  let state = createEmptyPromptState();

  for (const [index, source] of candidateSources.entries()) {
    const fittedSource = fitSourceContent(state, source, profile);

    if (!fittedSource) {
      const omittedCount = candidateSources.length - index;
      issues.push(
        buildIssueFromSource(
          source,
          "output-limit",
          `Promptfire omitted ${omittedCount} remaining source(s) because the output limit was reached before "${source.path}" could be added.`,
        ),
      );
      break;
    }

    state = appendSource(state, fittedSource);

    if (fittedSource.truncated) {
      const omittedCount = candidateSources.length - index - 1;
      issues.push(
        buildIssueFromSource(
          source,
          "output-limit",
          `Promptfire truncated "${source.path}" to stay within the output limit.`,
        ),
      );

      if (omittedCount > 0) {
        issues.push(
          buildIssueFromSource(
            source,
            "output-limit",
            `Promptfire omitted ${omittedCount} additional source(s) after truncating "${source.path}".`,
          ),
        );
      }
      break;
    }
  }

  const prompt = buildPrompt(state, profile);
  const includedSources = summarizeSources(state);

  return {
    characterCount: prompt.length,
    includedSourcePaths: includedSources.map((source) => source.path),
    includedSources,
    issues,
    profileId: context.profileId,
    profileName: context.profileName,
    prompt,
  };
}
