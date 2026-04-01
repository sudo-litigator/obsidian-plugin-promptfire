import type { PromptfireSettings } from "../settings";
import { truncateText } from "./truncation";
import type {
  CollectedContext,
  ContextIssue,
  IncludedSourceSummary,
  PromptBuildResult,
  PromptSource,
} from "./types";

interface IncludedSource extends PromptSource {
  truncated: boolean;
}

interface PromptState {
  conventionSources: IncludedSource[];
  currentNote: IncludedSource | null;
  relatedSources: IncludedSource[];
}

function buildSourceBlock(source: IncludedSource, settings: PromptfireSettings): string {
  const lines = [`### ${source.title}`];

  if (settings.includeSourcePathLabels) {
    lines.push(`Path: ${source.path}`);
  }

  lines.push(source.content);
  return lines.join("\n");
}

function buildSourceSection(
  heading: string,
  sources: IncludedSource[],
  settings: PromptfireSettings,
): string {
  const parts = [`## ${heading}`];

  for (const source of sources) {
    parts.push("", buildSourceBlock(source, settings));
  }

  return parts.join("\n");
}

function buildWorkingRulesSection(workingRules: string[]): string {
  return ["## Working Rules", ...workingRules.map((rule) => `- ${rule}`)].join("\n");
}

function buildIncludedSourcesSection(sources: IncludedSource[]): string {
  return ["## Included Sources", ...sources.map((source) => `- ${source.path}`)].join("\n");
}

function buildPrompt(state: PromptState, settings: PromptfireSettings): string {
  const parts: string[] = ["# Promptfire Context"];

  if (settings.includeTaskSection && settings.taskInstruction.trim()) {
    parts.push("", "## Task", settings.taskInstruction.trim());
  }

  if (state.conventionSources.length > 0) {
    parts.push("", buildSourceSection("Vault Conventions", state.conventionSources, settings));
  }

  if (state.currentNote) {
    parts.push("", buildSourceSection("Current Note", [state.currentNote], settings));
  }

  if (state.relatedSources.length > 0) {
    parts.push("", buildSourceSection("Related Notes", state.relatedSources, settings));
  }

  if (settings.includeWorkingRules && settings.workingRules.length > 0) {
    parts.push("", buildWorkingRulesSection(settings.workingRules));
  }

  if (settings.includeIncludedSourcesSection) {
    parts.push(
      "",
      buildIncludedSourcesSection([
        ...state.conventionSources,
        ...(state.currentNote ? [state.currentNote] : []),
        ...state.relatedSources,
      ]),
    );
  }

  return `${parts.join("\n")}\n`;
}

function appendSource(state: PromptState, source: IncludedSource): PromptState {
  if (source.section === "vault-conventions") {
    return {
      ...state,
      conventionSources: [...state.conventionSources, source],
    };
  }

  if (source.section === "current-note") {
    return {
      ...state,
      currentNote: source,
    };
  }

  return {
    ...state,
    relatedSources: [...state.relatedSources, source],
  };
}

function fitSourceContent(
  state: PromptState,
  candidate: PromptSource,
  settings: PromptfireSettings,
): IncludedSource | null {
  const fullSource: IncludedSource = {
    ...candidate,
    truncated: false,
  };
  const fullState = appendSource(state, fullSource);
  const fullPrompt = buildPrompt(fullState, settings);

  if (fullPrompt.length <= settings.maxOutputCharacters) {
    return fullSource;
  }

  const emptySource: IncludedSource = {
    ...candidate,
    content: "",
    truncated: false,
  };
  const skeletonState = appendSource(state, emptySource);
  const skeletonPrompt = buildPrompt(skeletonState, settings);
  const remainingForContent = settings.maxOutputCharacters - skeletonPrompt.length;

  if (remainingForContent <= 0) {
    return null;
  }

  const truncated = truncateText(candidate.content, remainingForContent);

  return {
    ...candidate,
    content: truncated.text,
    truncated: truncated.wasTruncated,
  };
}

function buildLimitIssue(path: string, message: string): ContextIssue {
  return {
    message,
    path,
    reason: "output-limit",
  };
}

function summarizeSources(state: PromptState): IncludedSourceSummary[] {
  return [
    ...state.conventionSources,
    ...(state.currentNote ? [state.currentNote] : []),
    ...state.relatedSources,
  ].map((source) => ({
    kind: source.kind,
    path: source.path,
    section: source.section,
    title: source.title,
  }));
}

function appendStageUntilLimit(
  state: PromptState,
  sources: PromptSource[],
  settings: PromptfireSettings,
  issues: ContextIssue[],
  sourceLabel: string,
): { state: PromptState; stopped: boolean } {
  let nextState = state;

  for (const [index, source] of sources.entries()) {
    const fittedSource = fitSourceContent(nextState, source, settings);

    if (!fittedSource) {
      const omittedCount = sources.length - index;
      issues.push(
        buildLimitIssue(
          source.path,
          `Promptfire omitted ${omittedCount} ${sourceLabel}(s) because the output limit was reached before "${source.path}" could be added.`,
        ),
      );
      return { state: nextState, stopped: true };
    }

    nextState = appendSource(nextState, fittedSource);

    if (fittedSource.truncated) {
      const omittedCount = sources.length - index - 1;
      issues.push(
        buildLimitIssue(
          source.path,
          `Promptfire truncated "${source.path}" to stay within the output limit.`,
        ),
      );

      if (omittedCount > 0) {
        issues.push(
          buildLimitIssue(
            source.path,
            `Promptfire omitted ${omittedCount} additional ${sourceLabel}(s) after truncating "${source.path}".`,
          ),
        );
      }

      return { state: nextState, stopped: true };
    }
  }

  return { state: nextState, stopped: false };
}

export function assemblePrompt(
  context: CollectedContext,
  settings: PromptfireSettings,
): PromptBuildResult {
  const issues = [...context.issues];
  let state: PromptState = {
    conventionSources: [],
    currentNote: null,
    relatedSources: [],
  };

  const conventionStage = appendStageUntilLimit(
    state,
    context.conventionSources,
    settings,
    issues,
    "vault context source",
  );
  state = conventionStage.state;

  if (!conventionStage.stopped && context.currentNote) {
    const fittedCurrentNote = fitSourceContent(state, context.currentNote, settings);

    if (fittedCurrentNote) {
      state = appendSource(state, fittedCurrentNote);

      if (fittedCurrentNote.truncated) {
        issues.push(
          buildLimitIssue(
            context.currentNote.path,
            `Promptfire truncated the active note "${context.currentNote.path}" to stay within the output limit.`,
          ),
        );
      }
    } else {
      issues.push(
        buildLimitIssue(
          context.currentNote.path,
          `Promptfire omitted the active note "${context.currentNote.path}" because the output limit was reached.`,
        ),
      );
    }
  } else if (conventionStage.stopped && context.currentNote) {
    issues.push(
      buildLimitIssue(
        context.currentNote.path,
        `Promptfire omitted the active note "${context.currentNote.path}" because earlier vault context already consumed the output limit.`,
      ),
    );
  }

  const relatedStageStartAllowed =
    !conventionStage.stopped &&
    !(state.currentNote && state.currentNote.truncated) &&
    context.relatedSources.length > 0;

  if (relatedStageStartAllowed) {
    const relatedStage = appendStageUntilLimit(
      state,
      context.relatedSources,
      settings,
      issues,
      "related note",
    );
    state = relatedStage.state;
  } else if (context.relatedSources.length > 0 && !relatedStageStartAllowed) {
    const firstRelatedSource = context.relatedSources[0];

    if (firstRelatedSource) {
      issues.push(
        buildLimitIssue(
          firstRelatedSource.path,
          "Promptfire omitted related notes because earlier sections already consumed the output limit.",
        ),
      );
    }
  }

  const prompt = buildPrompt(state, settings);
  const includedSources = summarizeSources(state);

  return {
    characterCount: prompt.length,
    includedSourcePaths: includedSources.map((source) => source.path),
    includedSources,
    issues,
    prompt,
  };
}
