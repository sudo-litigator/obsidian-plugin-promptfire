export type PromptSectionKind = "vault-conventions" | "current-note" | "related-notes";

export type PromptSourceKind =
  | "reference-note"
  | "reference-folder-note"
  | "active-note"
  | "outgoing-link"
  | "backlink";

export interface PromptSource {
  content: string;
  kind: PromptSourceKind;
  path: string;
  section: PromptSectionKind;
  title: string;
}

export interface IncludedSourceSummary {
  kind: PromptSourceKind;
  path: string;
  section: PromptSectionKind;
  title: string;
}

export interface ContextIssue {
  message: string;
  path: string;
  reason: string;
}

export interface CollectedContext {
  currentNote: PromptSource | null;
  conventionSources: PromptSource[];
  issues: ContextIssue[];
  relatedSources: PromptSource[];
}

export interface PromptBuildResult {
  characterCount: number;
  includedSourcePaths: string[];
  includedSources: IncludedSourceSummary[];
  issues: ContextIssue[];
  prompt: string;
}
