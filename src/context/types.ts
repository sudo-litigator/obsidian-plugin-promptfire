export type ActiveNoteMode = "full" | "selection" | "selection-fallback-full";

export type PromptSectionKind = "vault-conventions" | "current-note" | "related-notes";

export type SourceDefinitionType =
  | "active-note"
  | "file"
  | "folder"
  | "outgoing-links"
  | "backlinks"
  | "search";

export type SourceExtractMode =
  | "full"
  | "frontmatter-only"
  | "body-only"
  | "heading-filtered"
  | "code-blocks";

export type TemplateBlockId =
  | "task"
  | "vault-conventions"
  | "current-note"
  | "related-notes"
  | "working-rules"
  | "included-sources";

export type OutputTargetType =
  | "clipboard"
  | "new-note"
  | "append-note"
  | "append-active-note"
  | "scratchpad-note"
  | "deep-link";

export type PromptExportFormat = "markdown" | "xml" | "json";

export interface PromptfireSourceDefinition {
  enabled: boolean;
  extractMode: SourceExtractMode;
  headingFilters: string[];
  id: string;
  label: string;
  maxCharacters?: number;
  maxItems?: number;
  noteMode?: ActiveNoteMode;
  path?: string;
  priority: number;
  query?: string;
  recursive?: boolean;
  regexExclude?: string;
  regexInclude?: string;
  section: PromptSectionKind;
  type: SourceDefinitionType;
}

export interface PromptfireTemplateBlock {
  enabled: boolean;
  heading: string;
  id: TemplateBlockId;
  maxCharacters?: number;
}

export interface PromptfireOutputTarget {
  appendSeparator: string;
  enabled: boolean;
  format: PromptExportFormat;
  id: string;
  label: string;
  openAfterWrite: boolean;
  pathTemplate: string;
  type: OutputTargetType;
  urlTemplate: string;
}

export interface PromptfireProfile {
  defaultOutputTargetId: string;
  excludeNotePaths: string[];
  id: string;
  includeBody: boolean;
  includeFrontmatter: boolean;
  includeSourcePathLabels: boolean;
  maxOutputCharacters: number;
  name: string;
  outputTargets: PromptfireOutputTarget[];
  sourceDefinitions: PromptfireSourceDefinition[];
  stripCodeBlocks: boolean;
  taskInstruction: string;
  templateBlocks: PromptfireTemplateBlock[];
  workingRules: string[];
}

export interface PromptSource {
  content: string;
  id: string;
  kind: SourceDefinitionType;
  originalCharacterCount: number;
  path: string;
  priority: number;
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
  activeNotePath: string | null;
  issues: ContextIssue[];
  profileId: string;
  profileName: string;
  sources: PromptSource[];
}

export interface IncludedSourceSummary {
  characterCount: number;
  enabled: boolean;
  id: string;
  kind: SourceDefinitionType;
  originalCharacterCount: number;
  path: string;
  priority: number;
  section: PromptSectionKind;
  sourceDefinitionId: string;
  sourceDefinitionLabel: string;
  sourceDefinitionType: SourceDefinitionType;
  title: string;
  truncated: boolean;
}

export interface RenderedPromptBlock {
  characterCount: number;
  content: string;
  enabled: boolean;
  heading: string;
  id: TemplateBlockId;
}

export interface PromptBuildOverrides {
  enabledBlockIds?: TemplateBlockId[];
  enabledSourceIds?: string[];
  outputFormat?: PromptExportFormat;
  reorderedSourceIds?: string[];
}

export interface PromptBuildResult {
  blocks: RenderedPromptBlock[];
  characterCount: number;
  includedSourcePaths: string[];
  includedSources: IncludedSourceSummary[];
  issues: ContextIssue[];
  outputFormat: PromptExportFormat;
  profileId: string;
  profileName: string;
  prompt: string;
}
