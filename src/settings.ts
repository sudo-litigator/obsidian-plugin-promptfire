import { PluginSettingTab, Setting } from "obsidian";

import type PromptfirePlugin from "./main";
import type {
  ActiveNoteMode,
  PromptSectionKind,
  PromptfireProfile,
  PromptfireSourceDefinition,
  PromptfireTemplateBlock,
  SourceDefinitionType,
  TemplateBlockId,
} from "./context/types";

export const MIN_OUTPUT_CHARACTERS = 2_000;
export const MAX_OUTPUT_CHARACTERS = 100_000;
export const MIN_SOURCE_ITEMS = 0;
export const MAX_SOURCE_ITEMS = 50;

export interface PromptfireSettings {
  activeProfileId: string;
  enableVaultConfig: boolean;
  profiles: PromptfireProfile[];
  registerProfileCommands: boolean;
  showRibbonIcon: boolean;
  vaultConfigPath: string;
}

interface LegacyPromptfireSettings {
  activeNoteMode?: ActiveNoteMode;
  excludeNotePaths?: string[];
  includeActiveNote?: boolean;
  includeBacklinks?: boolean;
  includeBody?: boolean;
  includeFrontmatter?: boolean;
  includeIncludedSourcesSection?: boolean;
  includeOutgoingLinks?: boolean;
  includeSourcePathLabels?: boolean;
  includeTaskSection?: boolean;
  includeWorkingRules?: boolean;
  maxBacklinks?: number;
  maxOutputCharacters?: number;
  maxOutgoingLinks?: number;
  referenceFolderPaths?: string[];
  referenceNotePaths?: string[];
  showRibbonIcon?: boolean;
  stripCodeBlocks?: boolean;
  taskInstruction?: string;
  workingRules?: string[];
}

export const DEFAULT_TASK_INSTRUCTION =
  "Use the provided vault context to help with the current note. Follow the vault's existing naming, metadata, formatting, and structure before inventing new patterns.";

export const DEFAULT_WORKING_RULES = [
  "Follow the vault conventions before inventing new structure.",
  "Prefer existing naming, metadata, and formatting patterns.",
  "If context is incomplete, say what is missing instead of guessing.",
];

const TEMPLATE_BLOCK_ORDER: TemplateBlockId[] = [
  "task",
  "vault-conventions",
  "current-note",
  "related-notes",
  "working-rules",
  "included-sources",
];

const TEMPLATE_BLOCK_HEADINGS: Record<TemplateBlockId, string> = {
  task: "Task",
  "vault-conventions": "Vault Conventions",
  "current-note": "Current Note",
  "related-notes": "Related Notes",
  "working-rules": "Working Rules",
  "included-sources": "Included Sources",
};

const SOURCE_TYPE_LABELS: Record<SourceDefinitionType, string> = {
  "active-note": "Active note",
  backlinks: "Backlinks",
  file: "File",
  folder: "Folder",
  "outgoing-links": "Outgoing links",
  search: "Search",
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseLines(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    });
}

function sanitizeLines(value: string[] | undefined, fallback: string[] = []): string[] {
  return parseLines((value ?? fallback).join("\n"));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampOutputCharacters(value: number): number {
  return clamp(value, MIN_OUTPUT_CHARACTERS, MAX_OUTPUT_CHARACTERS);
}

export function clampSourceItems(value: number): number {
  return clamp(value, MIN_SOURCE_ITEMS, MAX_SOURCE_ITEMS);
}

function defaultSectionForSourceType(type: SourceDefinitionType): PromptSectionKind {
  if (type === "active-note") {
    return "current-note";
  }

  if (type === "outgoing-links" || type === "backlinks" || type === "search") {
    return "related-notes";
  }

  return "vault-conventions";
}

function defaultLabelForSourceType(type: SourceDefinitionType): string {
  return SOURCE_TYPE_LABELS[type];
}

function sourceTypeSupportsPath(type: SourceDefinitionType): boolean {
  return type === "file" || type === "folder";
}

function sourceTypeSupportsQuery(type: SourceDefinitionType): boolean {
  return type === "search";
}

function sourceTypeSupportsRecursion(type: SourceDefinitionType): boolean {
  return type === "folder";
}

function sourceTypeSupportsMaxItems(type: SourceDefinitionType): boolean {
  return type === "folder" || type === "outgoing-links" || type === "backlinks" || type === "search";
}

function sourceTypeSupportsNoteMode(type: SourceDefinitionType): boolean {
  return type === "active-note";
}

export function createSourceDefinition(type: SourceDefinitionType): PromptfireSourceDefinition {
  return {
    enabled: true,
    id: createId("source"),
    label: defaultLabelForSourceType(type),
    maxItems: sourceTypeSupportsMaxItems(type) ? 5 : undefined,
    noteMode: sourceTypeSupportsNoteMode(type) ? "selection-fallback-full" : undefined,
    path: sourceTypeSupportsPath(type) ? "" : undefined,
    query: sourceTypeSupportsQuery(type) ? "" : undefined,
    recursive: sourceTypeSupportsRecursion(type) ? true : undefined,
    section: defaultSectionForSourceType(type),
    type,
  };
}

function createDefaultTemplateBlocks(): PromptfireTemplateBlock[] {
  return TEMPLATE_BLOCK_ORDER.map((id) => ({
    enabled: true,
    heading: TEMPLATE_BLOCK_HEADINGS[id],
    id,
  }));
}

export function createDefaultProfile(name = "Default"): PromptfireProfile {
  return {
    excludeNotePaths: [],
    id: createId("profile"),
    includeBody: true,
    includeFrontmatter: true,
    includeSourcePathLabels: true,
    maxOutputCharacters: 20_000,
    name,
    sourceDefinitions: [createSourceDefinition("active-note")],
    stripCodeBlocks: false,
    taskInstruction: DEFAULT_TASK_INSTRUCTION,
    templateBlocks: createDefaultTemplateBlocks(),
    workingRules: [...DEFAULT_WORKING_RULES],
  };
}

export function duplicateProfile(profile: PromptfireProfile): PromptfireProfile {
  return normalizeProfile(
    {
      ...profile,
      id: createId("profile"),
      name: `${profile.name} Copy`,
      sourceDefinitions: profile.sourceDefinitions.map((sourceDefinition) => ({
        ...sourceDefinition,
        id: createId("source"),
      })),
    },
    `${profile.name} Copy`,
  );
}

function normalizeTemplateBlocks(
  blocks: PromptfireTemplateBlock[] | undefined,
): PromptfireTemplateBlock[] {
  const normalizedBlocks: PromptfireTemplateBlock[] = [];
  const seenIds = new Set<TemplateBlockId>();

  for (const block of blocks ?? []) {
    if (!TEMPLATE_BLOCK_ORDER.includes(block.id) || seenIds.has(block.id)) {
      continue;
    }

    seenIds.add(block.id);
    normalizedBlocks.push({
      enabled: block.enabled ?? true,
      heading: block.heading?.trim() || TEMPLATE_BLOCK_HEADINGS[block.id],
      id: block.id,
    });
  }

  for (const id of TEMPLATE_BLOCK_ORDER) {
    if (!seenIds.has(id)) {
      normalizedBlocks.push({
        enabled: true,
        heading: TEMPLATE_BLOCK_HEADINGS[id],
        id,
      });
    }
  }

  return normalizedBlocks;
}

function normalizeSourceDefinition(
  sourceDefinition: Partial<PromptfireSourceDefinition> | undefined,
): PromptfireSourceDefinition {
  const type = sourceDefinition?.type ?? "file";
  const defaults = createSourceDefinition(type);

  return {
    enabled: sourceDefinition?.enabled ?? defaults.enabled,
    id: sourceDefinition?.id || createId("source"),
    label: sourceDefinition?.label?.trim() || defaults.label,
    maxItems: sourceTypeSupportsMaxItems(type)
      ? clampSourceItems(sourceDefinition?.maxItems ?? defaults.maxItems ?? 5)
      : undefined,
    noteMode: sourceTypeSupportsNoteMode(type)
      ? sourceDefinition?.noteMode ?? defaults.noteMode
      : undefined,
    path: sourceTypeSupportsPath(type) ? sourceDefinition?.path?.trim() ?? defaults.path : undefined,
    query: sourceTypeSupportsQuery(type)
      ? sourceDefinition?.query?.trim() ?? defaults.query
      : undefined,
    recursive: sourceTypeSupportsRecursion(type)
      ? sourceDefinition?.recursive ?? defaults.recursive
      : undefined,
    section: sourceDefinition?.section ?? defaults.section,
    type,
  };
}

function normalizeProfile(
  profile: Partial<PromptfireProfile> | undefined,
  fallbackName: string,
): PromptfireProfile {
  const defaultProfile = createDefaultProfile(fallbackName);
  const normalizedSources = (profile?.sourceDefinitions ?? []).map((sourceDefinition) =>
    normalizeSourceDefinition(sourceDefinition),
  );

  return {
    excludeNotePaths: sanitizeLines(profile?.excludeNotePaths),
    id: profile?.id || createId("profile"),
    includeBody: profile?.includeBody ?? defaultProfile.includeBody,
    includeFrontmatter: profile?.includeFrontmatter ?? defaultProfile.includeFrontmatter,
    includeSourcePathLabels:
      profile?.includeSourcePathLabels ?? defaultProfile.includeSourcePathLabels,
    maxOutputCharacters: clampOutputCharacters(
      profile?.maxOutputCharacters ?? defaultProfile.maxOutputCharacters,
    ),
    name: profile?.name?.trim() || fallbackName,
    sourceDefinitions:
      normalizedSources.length > 0 ? normalizedSources : [...defaultProfile.sourceDefinitions],
    stripCodeBlocks: profile?.stripCodeBlocks ?? defaultProfile.stripCodeBlocks,
    taskInstruction: profile?.taskInstruction?.trim() || defaultProfile.taskInstruction,
    templateBlocks: normalizeTemplateBlocks(profile?.templateBlocks),
    workingRules: sanitizeLines(profile?.workingRules, DEFAULT_WORKING_RULES).length
      ? sanitizeLines(profile?.workingRules, DEFAULT_WORKING_RULES)
      : [...DEFAULT_WORKING_RULES],
  };
}

function migrateLegacySettings(
  legacySettings: LegacyPromptfireSettings | null | undefined,
): PromptfireSettings {
  const profile = createDefaultProfile("Default");
  profile.sourceDefinitions = [];

  for (const path of sanitizeLines(legacySettings?.referenceNotePaths)) {
    profile.sourceDefinitions.push({
      ...createSourceDefinition("file"),
      label: `File: ${path}`,
      path,
      section: "vault-conventions",
    });
  }

  for (const path of sanitizeLines(legacySettings?.referenceFolderPaths)) {
    profile.sourceDefinitions.push({
      ...createSourceDefinition("folder"),
      label: `Folder: ${path}`,
      path,
      recursive: true,
      section: "vault-conventions",
    });
  }

  if (legacySettings?.includeActiveNote ?? true) {
    profile.sourceDefinitions.push({
      ...createSourceDefinition("active-note"),
      noteMode: legacySettings?.activeNoteMode ?? "selection-fallback-full",
      section: "current-note",
    });
  }

  if (legacySettings?.includeOutgoingLinks) {
    profile.sourceDefinitions.push({
      ...createSourceDefinition("outgoing-links"),
      maxItems: clampSourceItems(legacySettings.maxOutgoingLinks ?? 3),
      section: "related-notes",
    });
  }

  if (legacySettings?.includeBacklinks) {
    profile.sourceDefinitions.push({
      ...createSourceDefinition("backlinks"),
      maxItems: clampSourceItems(legacySettings.maxBacklinks ?? 3),
      section: "related-notes",
    });
  }

  if (profile.sourceDefinitions.length === 0) {
    profile.sourceDefinitions = [createSourceDefinition("active-note")];
  }

  profile.excludeNotePaths = sanitizeLines(legacySettings?.excludeNotePaths);
  profile.includeBody = legacySettings?.includeBody ?? profile.includeBody;
  profile.includeFrontmatter = legacySettings?.includeFrontmatter ?? profile.includeFrontmatter;
  profile.includeSourcePathLabels =
    legacySettings?.includeSourcePathLabels ?? profile.includeSourcePathLabels;
  profile.maxOutputCharacters = clampOutputCharacters(
    legacySettings?.maxOutputCharacters ?? profile.maxOutputCharacters,
  );
  profile.stripCodeBlocks = legacySettings?.stripCodeBlocks ?? profile.stripCodeBlocks;
  profile.taskInstruction = legacySettings?.taskInstruction?.trim() || profile.taskInstruction;
  profile.workingRules = sanitizeLines(legacySettings?.workingRules, DEFAULT_WORKING_RULES);

  profile.templateBlocks = normalizeTemplateBlocks(
    createDefaultTemplateBlocks().map((block) => {
      if (block.id === "task") {
        return { ...block, enabled: legacySettings?.includeTaskSection ?? true };
      }

      if (block.id === "working-rules") {
        return { ...block, enabled: legacySettings?.includeWorkingRules ?? true };
      }

      if (block.id === "included-sources") {
        return { ...block, enabled: legacySettings?.includeIncludedSourcesSection ?? true };
      }

      return block;
    }),
  );

  return {
    activeProfileId: profile.id,
    enableVaultConfig: false,
    profiles: [profile],
    registerProfileCommands: true,
    showRibbonIcon: legacySettings?.showRibbonIcon ?? true,
    vaultConfigPath: ".promptfire.json",
  };
}

export function normalizeSettings(
  loadedData: Partial<PromptfireSettings & LegacyPromptfireSettings> | null | undefined,
): PromptfireSettings {
  if (loadedData?.profiles && Array.isArray(loadedData.profiles) && loadedData.profiles.length > 0) {
    const normalizedProfiles = loadedData.profiles.map((profile, index) =>
      normalizeProfile(profile, index === 0 ? "Default" : `Profile ${index + 1}`),
    );
    const activeProfileId = normalizedProfiles.some(
      (profile) => profile.id === loadedData.activeProfileId,
    )
      ? (loadedData.activeProfileId as string)
      : normalizedProfiles[0]?.id ?? createDefaultProfile().id;

    return {
      activeProfileId,
      enableVaultConfig: loadedData.enableVaultConfig ?? false,
      profiles: normalizedProfiles,
      registerProfileCommands: loadedData.registerProfileCommands ?? true,
      showRibbonIcon: loadedData.showRibbonIcon ?? true,
      vaultConfigPath: loadedData.vaultConfigPath?.trim() || ".promptfire.json",
    };
  }

  return migrateLegacySettings(loadedData);
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);

  if (!item) {
    return items;
  }

  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function describeSourceDefinition(source: PromptfireSourceDefinition): string {
  const label = source.label.trim() || SOURCE_TYPE_LABELS[source.type];
  return `${label} (${SOURCE_TYPE_LABELS[source.type]})`;
}

function getSectionLabel(section: PromptSectionKind): string {
  if (section === "vault-conventions") {
    return "Vault conventions";
  }

  if (section === "current-note") {
    return "Current note";
  }

  return "Related notes";
}

export class PromptfireSettingTab extends PluginSettingTab {
  constructor(app: PromptfirePlugin["app"], private readonly plugin: PromptfirePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const activeProfile = this.plugin.getActiveProfile();

    containerEl.createEl("h2", { text: "Promptfire" });
    containerEl.createEl("p", {
      text: "Power-user setup for compiling vault context into reproducible prompts.",
    });

    this.renderVaultConfigSettings(containerEl);
    this.renderProfileControls(containerEl, activeProfile.id);
    this.renderProfileSettings(containerEl, activeProfile.id);
    this.renderSourceDefinitions(containerEl, activeProfile.id);
    this.renderTemplateBlocks(containerEl, activeProfile.id);
    this.renderPluginUiSettings(containerEl);
  }

  private renderVaultConfigSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Vault Config" });

    new Setting(containerEl)
      .setName("Enable vault config")
      .setDesc(
        "Load additional Promptfire settings from a vault file on startup and on manual reload.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableVaultConfig).onChange(async (value) => {
          this.plugin.settings.enableVaultConfig = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Vault config path")
      .setDesc(this.plugin.getVaultConfigStatusText())
      .addText((text) =>
        text.setPlaceholder(".promptfire.json")
          .setValue(this.plugin.settings.vaultConfigPath)
          .onChange(async (value) => {
            this.plugin.settings.vaultConfigPath = value.trim() || ".promptfire.json";
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName("Vault config actions")
      .setDesc("Reload the vault config or export the current resolved settings into a JSON file.")
      .addButton((button) =>
        button.setButtonText("Reload").onClick(async () => {
          await this.plugin.reloadVaultConfig();
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Export").onClick(async () => {
          await this.plugin.exportSettingsToVaultConfig();
          this.display();
        }),
      );
  }

  private renderProfileControls(containerEl: HTMLElement, activeProfileId: string): void {
    containerEl.createEl("h3", { text: "Profiles" });

    new Setting(containerEl)
      .setName("Active profile")
      .setDesc("Select the profile used by the ribbon icon and the default commands.")
      .addDropdown((dropdown) => {
        for (const profile of this.plugin.settings.profiles) {
          dropdown.addOption(profile.id, profile.name);
        }

        dropdown.setValue(activeProfileId).onChange(async (value) => {
          await this.plugin.setActiveProfile(value);
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Profile actions")
      .setDesc("Create, duplicate, or delete named prompt-compilation setups.")
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          await this.plugin.createProfile();
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Duplicate").onClick(async () => {
          await this.plugin.duplicateActiveProfile();
          this.display();
        }),
      )
      .addButton((button) =>
        button
          .setButtonText("Delete")
          .setWarning()
          .setDisabled(this.plugin.settings.profiles.length <= 1)
          .onClick(async () => {
            await this.plugin.deleteActiveProfile();
            this.display();
          }),
      );
  }

  private renderProfileSettings(containerEl: HTMLElement, profileId: string): void {
    const profile = this.plugin.getProfileById(profileId);

    if (!profile) {
      return;
    }

    containerEl.createEl("h3", { text: "Profile Settings" });

    new Setting(containerEl)
      .setName("Profile name")
      .setDesc("Human-readable label used across the plugin.")
      .addText((text) =>
        text.setValue(profile.name).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.name = value.trim() || nextProfile.name;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Task instruction")
      .setDesc("Top-level instruction inserted before the collected context.")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.inputEl.cols = 48;
        text.setValue(profile.taskInstruction).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.taskInstruction = value.trim() || DEFAULT_TASK_INSTRUCTION;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Exclude note paths")
      .setDesc("One file path per line. Matching notes are skipped even if another source resolves them.")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.inputEl.cols = 48;
        text.setValue(profile.excludeNotePaths.join("\n")).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.excludeNotePaths = parseLines(value);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Working rules")
      .setDesc("One persistent instruction per line.")
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.cols = 48;
        text.setValue(profile.workingRules.join("\n")).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          const lines = parseLines(value);
          nextProfile.workingRules = lines.length > 0 ? lines : [...DEFAULT_WORKING_RULES];
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Maximum output characters")
      .setDesc(
        `The final prompt is deterministically trimmed between ${MIN_OUTPUT_CHARACTERS.toLocaleString()} and ${MAX_OUTPUT_CHARACTERS.toLocaleString()} characters.`,
      )
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(MIN_OUTPUT_CHARACTERS);
        text.inputEl.max = String(MAX_OUTPUT_CHARACTERS);
        text.setValue(String(profile.maxOutputCharacters)).onChange(async (value) => {
          const parsedValue = Number.parseInt(value, 10);

          if (Number.isNaN(parsedValue)) {
            return;
          }

          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          const clampedValue = clampOutputCharacters(parsedValue);
          nextProfile.maxOutputCharacters = clampedValue;
          text.setValue(String(clampedValue));
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Include frontmatter")
      .setDesc("Preserve YAML frontmatter when reading Markdown files.")
      .addToggle((toggle) =>
        toggle.setValue(profile.includeFrontmatter).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.includeFrontmatter = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include note body")
      .setDesc("Preserve the Markdown body content after optional frontmatter.")
      .addToggle((toggle) =>
        toggle.setValue(profile.includeBody).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.includeBody = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Strip fenced code blocks")
      .setDesc("Replace triple-backtick blocks with a placeholder to save space.")
      .addToggle((toggle) =>
        toggle.setValue(profile.stripCodeBlocks).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.stripCodeBlocks = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include source path labels")
      .setDesc("Render each source path directly above the copied content.")
      .addToggle((toggle) =>
        toggle.setValue(profile.includeSourcePathLabels).onChange(async (value) => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.includeSourcePathLabels = value;
          await this.plugin.saveSettings();
        }),
      );
  }

  private renderSourceDefinitions(containerEl: HTMLElement, profileId: string): void {
    const profile = this.plugin.getProfileById(profileId);

    if (!profile) {
      return;
    }

    containerEl.createEl("h3", { text: "Source Definitions" });
    containerEl.createEl("p", {
      text: "Each source definition resolves one class of context. Order matters because Promptfire fills the prompt budget in source order.",
    });

    let sourceTypeToAdd: SourceDefinitionType = "file";

    new Setting(containerEl)
      .setName("Add source definition")
      .setDesc("Append a new source rule to the current profile.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("active-note", "Active note")
          .addOption("file", "File")
          .addOption("folder", "Folder")
          .addOption("outgoing-links", "Outgoing links")
          .addOption("backlinks", "Backlinks")
          .addOption("search", "Search")
          .setValue(sourceTypeToAdd)
          .onChange((value) => {
            sourceTypeToAdd = value as SourceDefinitionType;
          }),
      )
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          const nextProfile = this.plugin.getProfileById(profileId);

          if (!nextProfile) {
            return;
          }

          nextProfile.sourceDefinitions.push(createSourceDefinition(sourceTypeToAdd));
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    profile.sourceDefinitions.forEach((sourceDefinition, index) => {
      const sourceContainer = containerEl.createDiv({ cls: "promptfire-settings__card" });
      sourceContainer.createEl("h4", { text: `${index + 1}. ${describeSourceDefinition(sourceDefinition)}` });

      new Setting(sourceContainer)
        .setName("Enabled")
        .setDesc("Temporarily disable this source without deleting it.")
        .addToggle((toggle) =>
          toggle.setValue(sourceDefinition.enabled).onChange(async (value) => {
            const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

            if (!nextSource) {
              return;
            }

            nextSource.enabled = value;
            await this.plugin.saveSettings();
          }),
        )
        .addExtraButton((button) =>
          button.setIcon("up-chevron-glyph").setTooltip("Move up").onClick(async () => {
            const nextProfile = this.plugin.getProfileById(profileId);

            if (!nextProfile) {
              return;
            }

            nextProfile.sourceDefinitions = moveItem(nextProfile.sourceDefinitions, index, index - 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        )
        .addExtraButton((button) =>
          button.setIcon("down-chevron-glyph").setTooltip("Move down").onClick(async () => {
            const nextProfile = this.plugin.getProfileById(profileId);

            if (!nextProfile) {
              return;
            }

            nextProfile.sourceDefinitions = moveItem(nextProfile.sourceDefinitions, index, index + 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        )
        .addExtraButton((button) =>
          button.setIcon("trash").setTooltip("Delete source").onClick(async () => {
            const nextProfile = this.plugin.getProfileById(profileId);

            if (!nextProfile) {
              return;
            }

            nextProfile.sourceDefinitions = nextProfile.sourceDefinitions.filter(
              (candidate) => candidate.id !== sourceDefinition.id,
            );

            if (nextProfile.sourceDefinitions.length === 0) {
              nextProfile.sourceDefinitions = [createSourceDefinition("active-note")];
            }

            await this.plugin.saveSettings();
            this.display();
          }),
        );

      new Setting(sourceContainer)
        .setName("Label")
        .setDesc("Human-readable label shown in the debug preview.")
        .addText((text) =>
          text.setValue(sourceDefinition.label).onChange(async (value) => {
            const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

            if (!nextSource) {
              return;
            }

            nextSource.label = value.trim() || defaultLabelForSourceType(nextSource.type);
            await this.plugin.saveSettings();
          }),
        );

      new Setting(sourceContainer)
        .setName("Source type")
        .setDesc("Defines how Promptfire resolves this context source.")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("active-note", "Active note")
            .addOption("file", "File")
            .addOption("folder", "Folder")
            .addOption("outgoing-links", "Outgoing links")
            .addOption("backlinks", "Backlinks")
            .addOption("search", "Search")
            .setValue(sourceDefinition.type)
            .onChange(async (value) => {
              const nextProfile = this.plugin.getProfileById(profileId);

              if (!nextProfile) {
                return;
              }

              const sourceIndex = nextProfile.sourceDefinitions.findIndex(
                (candidate) => candidate.id === sourceDefinition.id,
              );

              if (sourceIndex === -1) {
                return;
              }

              const nextType = value as SourceDefinitionType;
              const existingSource = nextProfile.sourceDefinitions[sourceIndex];

              if (!existingSource) {
                return;
              }

              const rebuiltSource = {
                ...createSourceDefinition(nextType),
                id: existingSource.id,
                label: defaultLabelForSourceType(nextType),
              };

              nextProfile.sourceDefinitions[sourceIndex] = rebuiltSource;
              await this.plugin.saveSettings();
              this.display();
            }),
        );

      new Setting(sourceContainer)
        .setName("Target section")
        .setDesc("Where this source appears in the final prompt.")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("vault-conventions", getSectionLabel("vault-conventions"))
            .addOption("current-note", getSectionLabel("current-note"))
            .addOption("related-notes", getSectionLabel("related-notes"))
            .setValue(sourceDefinition.section)
            .onChange(async (value) => {
              const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

              if (!nextSource) {
                return;
              }

              nextSource.section = value as PromptSectionKind;
              await this.plugin.saveSettings();
            }),
        );

      if (sourceTypeSupportsPath(sourceDefinition.type)) {
        new Setting(sourceContainer)
          .setName("Path")
          .setDesc(
            sourceDefinition.type === "folder"
              ? "Vault folder path used for collection."
              : "Vault file path used for collection.",
          )
          .addText((text) =>
            text.setValue(sourceDefinition.path ?? "").onChange(async (value) => {
              const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

              if (!nextSource) {
                return;
              }

              nextSource.path = value.trim();
              await this.plugin.saveSettings();
            }),
          );
      }

      if (sourceTypeSupportsQuery(sourceDefinition.type)) {
        new Setting(sourceContainer)
          .setName("Search query")
          .setDesc(
            'Case-insensitive query syntax. Examples: `tag:ai path:guides "prompt engineering" -name:draft fm:status=active`.',
          )
          .addText((text) =>
            text.setValue(sourceDefinition.query ?? "").onChange(async (value) => {
              const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

              if (!nextSource) {
                return;
              }

              nextSource.query = value.trim();
              await this.plugin.saveSettings();
            }),
          );
      }

      if (sourceTypeSupportsRecursion(sourceDefinition.type)) {
        new Setting(sourceContainer)
          .setName("Recursive")
          .setDesc("Include Markdown files from nested folders as well.")
          .addToggle((toggle) =>
            toggle.setValue(sourceDefinition.recursive ?? true).onChange(async (value) => {
              const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

              if (!nextSource) {
                return;
              }

              nextSource.recursive = value;
              await this.plugin.saveSettings();
            }),
          );
      }

      if (sourceTypeSupportsMaxItems(sourceDefinition.type)) {
        new Setting(sourceContainer)
          .setName("Maximum items")
          .setDesc(`Limit this source to between ${MIN_SOURCE_ITEMS} and ${MAX_SOURCE_ITEMS} resolved notes.`)
          .addText((text) => {
            text.inputEl.type = "number";
            text.inputEl.min = String(MIN_SOURCE_ITEMS);
            text.inputEl.max = String(MAX_SOURCE_ITEMS);
            text.setValue(String(sourceDefinition.maxItems ?? 5)).onChange(async (value) => {
              const parsedValue = Number.parseInt(value, 10);

              if (Number.isNaN(parsedValue)) {
                return;
              }

              const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

              if (!nextSource) {
                return;
              }

              const clampedValue = clampSourceItems(parsedValue);
              nextSource.maxItems = clampedValue;
              text.setValue(String(clampedValue));
              await this.plugin.saveSettings();
            });
          });
      }

      if (sourceTypeSupportsNoteMode(sourceDefinition.type)) {
        new Setting(sourceContainer)
          .setName("Active note mode")
          .setDesc("Choose whether the source copies the full note or only the current selection.")
          .addDropdown((dropdown) =>
            dropdown
              .addOption("full", "Full note")
              .addOption("selection", "Selection only")
              .addOption("selection-fallback-full", "Selection, fallback to full note")
              .setValue(sourceDefinition.noteMode ?? "selection-fallback-full")
              .onChange(async (value) => {
                const nextSource = this.plugin.getSourceDefinition(profileId, sourceDefinition.id);

                if (!nextSource) {
                  return;
                }

                nextSource.noteMode = value as ActiveNoteMode;
                await this.plugin.saveSettings();
              }),
          );
      }
    });
  }

  private renderTemplateBlocks(containerEl: HTMLElement, profileId: string): void {
    const profile = this.plugin.getProfileById(profileId);

    if (!profile) {
      return;
    }

    containerEl.createEl("h3", { text: "Template Blocks" });
    containerEl.createEl("p", {
      text: "Template blocks control prompt structure, order, and headings independently of the underlying source definitions.",
    });

    profile.templateBlocks.forEach((block, index) => {
      const blockContainer = containerEl.createDiv({ cls: "promptfire-settings__card" });
      blockContainer.createEl("h4", { text: `${index + 1}. ${block.id}` });

      new Setting(blockContainer)
        .setName("Enabled")
        .setDesc("Hide or show this block in the final prompt.")
        .addToggle((toggle) =>
          toggle.setValue(block.enabled).onChange(async (value) => {
            const nextBlock = this.plugin.getTemplateBlock(profileId, block.id);

            if (!nextBlock) {
              return;
            }

            nextBlock.enabled = value;
            await this.plugin.saveSettings();
          }),
        )
        .addExtraButton((button) =>
          button.setIcon("up-chevron-glyph").setTooltip("Move up").onClick(async () => {
            const nextProfile = this.plugin.getProfileById(profileId);

            if (!nextProfile) {
              return;
            }

            nextProfile.templateBlocks = moveItem(nextProfile.templateBlocks, index, index - 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        )
        .addExtraButton((button) =>
          button.setIcon("down-chevron-glyph").setTooltip("Move down").onClick(async () => {
            const nextProfile = this.plugin.getProfileById(profileId);

            if (!nextProfile) {
              return;
            }

            nextProfile.templateBlocks = moveItem(nextProfile.templateBlocks, index, index + 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        );

      new Setting(blockContainer)
        .setName("Heading")
        .setDesc("Rendered heading for this block.")
        .addText((text) =>
          text.setValue(block.heading).onChange(async (value) => {
            const nextBlock = this.plugin.getTemplateBlock(profileId, block.id);

            if (!nextBlock) {
              return;
            }

            nextBlock.heading = value.trim() || TEMPLATE_BLOCK_HEADINGS[block.id];
            await this.plugin.saveSettings();
          }),
        );
    });
  }

  private renderPluginUiSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Plugin UI" });

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Add a flame icon to the left ribbon for one-click copy with the active profile.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
          this.plugin.settings.showRibbonIcon = value;
          await this.plugin.saveSettings();
          this.plugin.syncRibbonIcon();
        }),
      );

    new Setting(containerEl)
      .setName("Register profile commands")
      .setDesc("Expose dedicated copy and preview commands for every profile in the command palette.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.registerProfileCommands).onChange(async (value) => {
          this.plugin.settings.registerProfileCommands = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );
  }
}
