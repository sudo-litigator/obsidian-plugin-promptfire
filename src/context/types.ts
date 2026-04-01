export type ActiveNoteMode = "full" | "selection" | "selection-fallback-full";

export type PromptSectionKind = "vault-conventions" | "current-note" | "related-notes";

export type SourceDefinitionType =
  | "active-note"
  | "file"
  | "folder"
  | "outgoing-links"
  | "backlinks"
  | "search";

export type TemplateBlockId =
  | "task"
  | "vault-conventions"
  | "current-note"
  | "related-notes"
  | "working-rules"
  | "included-sources";

export interface PromptfireSourceDefinition {
  enabled: boolean;
  id: string;
  label: string;
  maxItems?: number;
  noteMode?: ActiveNoteMode;
  path?: string;
  query?: string;
  recursive?: boolean;
  section: PromptSectionKind;
  type: SourceDefinitionType;
}

export interface PromptfireTemplateBlock {
  enabled: boolean;
  heading: string;
  id: TemplateBlockId;
}

export interface PromptfireProfile {
  excludeNotePaths: string[];
  id: string;
  includeBody: boolean;
  includeFrontmatter: boolean;
  includeSourcePathLabels: boolean;
  maxOutputCharacters: number;
  name: string;
  sourceDefinitions: PromptfireSourceDefinition[];
  stripCodeBlocks: boolean;
  taskInstruction: string;
  templateBlocks: PromptfireTemplateBlock[];
  workingRules: string[];
}

export interface PromptSource {
  content: string;
  kind: SourceDefinitionType;
  originalCharacterCount: number;
  path: string;
  section: PromptSectionKind;
  sourceDefinitionId: string;
  sourceDefinitionLabel: string;
  sourceDefinitionType: SourceDefinitionType;
  title: string;
}

export interface ContextIssue {
  message: string;
  path: string;
  reason: string;
  sourceDefinitionId?: string;
  sourceDefinitionLabel?: string;
}

export interface CollectedContext {
  issues: ContextIssue[];
  profileId: string;
  profileName: string;
  sources: PromptSource[];
}

export interface IncludedSourceSummary {
  characterCount: number;
  kind: SourceDefinitionType;
  originalCharacterCount: number;
  path: string;
  section: PromptSectionKind;
  sourceDefinitionId: string;
  sourceDefinitionLabel: string;
  sourceDefinitionType: SourceDefinitionType;
  title: string;
  truncated: boolean;
}

export interface PromptBuildResult {
  characterCount: number;
  includedSourcePaths: string[];
  includedSources: IncludedSourceSummary[];
  issues: ContextIssue[];
  profileId: string;
  profileName: string;
  prompt: string;
}
