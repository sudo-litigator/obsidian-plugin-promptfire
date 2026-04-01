import { PluginSettingTab, Setting } from "obsidian";

import type PromptfirePlugin from "./main";

export const MIN_OUTPUT_CHARACTERS = 2_000;
export const MAX_OUTPUT_CHARACTERS = 100_000;
export const MIN_LINKED_NOTES = 0;
export const MAX_LINKED_NOTES = 25;

export type ActiveNoteMode = "full" | "selection" | "selection-fallback-full";

export interface PromptfireSettings {
  activeNoteMode: ActiveNoteMode;
  excludeNotePaths: string[];
  includeActiveNote: boolean;
  includeBacklinks: boolean;
  includeBody: boolean;
  includeFrontmatter: boolean;
  includeIncludedSourcesSection: boolean;
  includeOutgoingLinks: boolean;
  includeSourcePathLabels: boolean;
  includeTaskSection: boolean;
  includeWorkingRules: boolean;
  maxBacklinks: number;
  maxOutputCharacters: number;
  maxOutgoingLinks: number;
  referenceFolderPaths: string[];
  referenceNotePaths: string[];
  showRibbonIcon: boolean;
  stripCodeBlocks: boolean;
  taskInstruction: string;
  workingRules: string[];
}

export const DEFAULT_TASK_INSTRUCTION =
  "Use the provided vault context to help with the current note. Follow the vault's existing naming, metadata, formatting, and structure before inventing new patterns.";

export const DEFAULT_WORKING_RULES = [
  "Follow the vault conventions before inventing new structure.",
  "Prefer existing naming, metadata, and formatting patterns.",
  "If context is incomplete, say what is missing instead of guessing.",
];

export const DEFAULT_SETTINGS: PromptfireSettings = {
  activeNoteMode: "selection-fallback-full",
  excludeNotePaths: [],
  includeActiveNote: true,
  includeBacklinks: false,
  includeBody: true,
  includeFrontmatter: true,
  includeIncludedSourcesSection: true,
  includeOutgoingLinks: false,
  includeSourcePathLabels: true,
  includeTaskSection: true,
  includeWorkingRules: true,
  maxBacklinks: 3,
  maxOutputCharacters: 20_000,
  maxOutgoingLinks: 3,
  referenceFolderPaths: [],
  referenceNotePaths: [],
  showRibbonIcon: true,
  stripCodeBlocks: false,
  taskInstruction: DEFAULT_TASK_INSTRUCTION,
  workingRules: [...DEFAULT_WORKING_RULES],
};

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

export function clampLinkedNotes(value: number): number {
  return clamp(value, MIN_LINKED_NOTES, MAX_LINKED_NOTES);
}

export function normalizeSettings(
  loadedData: Partial<PromptfireSettings> | null | undefined,
): PromptfireSettings {
  return {
    activeNoteMode: loadedData?.activeNoteMode ?? DEFAULT_SETTINGS.activeNoteMode,
    excludeNotePaths: sanitizeLines(loadedData?.excludeNotePaths),
    includeActiveNote: loadedData?.includeActiveNote ?? DEFAULT_SETTINGS.includeActiveNote,
    includeBacklinks: loadedData?.includeBacklinks ?? DEFAULT_SETTINGS.includeBacklinks,
    includeBody: loadedData?.includeBody ?? DEFAULT_SETTINGS.includeBody,
    includeFrontmatter: loadedData?.includeFrontmatter ?? DEFAULT_SETTINGS.includeFrontmatter,
    includeIncludedSourcesSection:
      loadedData?.includeIncludedSourcesSection ?? DEFAULT_SETTINGS.includeIncludedSourcesSection,
    includeOutgoingLinks: loadedData?.includeOutgoingLinks ?? DEFAULT_SETTINGS.includeOutgoingLinks,
    includeSourcePathLabels:
      loadedData?.includeSourcePathLabels ?? DEFAULT_SETTINGS.includeSourcePathLabels,
    includeTaskSection: loadedData?.includeTaskSection ?? DEFAULT_SETTINGS.includeTaskSection,
    includeWorkingRules: loadedData?.includeWorkingRules ?? DEFAULT_SETTINGS.includeWorkingRules,
    maxBacklinks: clampLinkedNotes(loadedData?.maxBacklinks ?? DEFAULT_SETTINGS.maxBacklinks),
    maxOutputCharacters: clampOutputCharacters(
      loadedData?.maxOutputCharacters ?? DEFAULT_SETTINGS.maxOutputCharacters,
    ),
    maxOutgoingLinks: clampLinkedNotes(
      loadedData?.maxOutgoingLinks ?? DEFAULT_SETTINGS.maxOutgoingLinks,
    ),
    referenceFolderPaths: sanitizeLines(loadedData?.referenceFolderPaths),
    referenceNotePaths: sanitizeLines(loadedData?.referenceNotePaths),
    showRibbonIcon: loadedData?.showRibbonIcon ?? DEFAULT_SETTINGS.showRibbonIcon,
    stripCodeBlocks: loadedData?.stripCodeBlocks ?? DEFAULT_SETTINGS.stripCodeBlocks,
    taskInstruction: loadedData?.taskInstruction?.trim() || DEFAULT_SETTINGS.taskInstruction,
    workingRules: sanitizeLines(loadedData?.workingRules, DEFAULT_SETTINGS.workingRules).length
      ? sanitizeLines(loadedData?.workingRules, DEFAULT_SETTINGS.workingRules)
      : [...DEFAULT_SETTINGS.workingRules],
  };
}

export class PromptfireSettingTab extends PluginSettingTab {
  constructor(app: PromptfirePlugin["app"], private readonly plugin: PromptfirePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Promptfire" });
    containerEl.createEl("p", {
      text: "Choose exactly which vault context Promptfire should assemble and how the final prompt should be formatted.",
    });

    containerEl.createEl("h3", { text: "Context Sources" });

    new Setting(containerEl)
      .setName("Reference note paths")
      .setDesc("One vault path per line. These files are added first as explicit convention sources.")
      .addTextArea((text) => {
        text.inputEl.rows = 8;
        text.inputEl.cols = 48;
        text
          .setPlaceholder("guides/writing-style.md\nguides/frontmatter.md")
          .setValue(this.plugin.settings.referenceNotePaths.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.referenceNotePaths = parseLines(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Reference folder paths")
      .setDesc("One folder path per line. Promptfire adds Markdown files from these folders in path order.")
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.cols = 48;
        text
          .setPlaceholder("guides\nstandards")
          .setValue(this.plugin.settings.referenceFolderPaths.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.referenceFolderPaths = parseLines(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Exclude note paths")
      .setDesc("One file path per line. These notes are skipped even if they are referenced by another source.")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.inputEl.cols = 48;
        text
          .setPlaceholder("archive/old-style-guide.md")
          .setValue(this.plugin.settings.excludeNotePaths.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludeNotePaths = parseLines(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Include active note")
      .setDesc("Include the currently open Markdown note as a dedicated section.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeActiveNote).onChange(async (value) => {
          this.plugin.settings.includeActiveNote = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Active note mode")
      .setDesc("Choose whether Promptfire copies the full note or only the current editor selection.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("full", "Full note")
          .addOption("selection", "Selection only")
          .addOption("selection-fallback-full", "Selection, fallback to full note")
          .setValue(this.plugin.settings.activeNoteMode)
          .onChange(async (value) => {
            this.plugin.settings.activeNoteMode = value as ActiveNoteMode;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Include outgoing links")
      .setDesc("Append notes linked from the active note after the main context.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeOutgoingLinks).onChange(async (value) => {
          this.plugin.settings.includeOutgoingLinks = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Maximum outgoing links")
      .setDesc(`Limit linked-note expansion to between ${MIN_LINKED_NOTES} and ${MAX_LINKED_NOTES} notes.`)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(MIN_LINKED_NOTES);
        text.inputEl.max = String(MAX_LINKED_NOTES);
        text.setValue(String(this.plugin.settings.maxOutgoingLinks)).onChange(async (value) => {
          const parsedValue = Number.parseInt(value, 10);

          if (Number.isNaN(parsedValue)) {
            return;
          }

          const clampedValue = clampLinkedNotes(parsedValue);
          this.plugin.settings.maxOutgoingLinks = clampedValue;
          text.setValue(String(clampedValue));
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Include backlinks")
      .setDesc("Append notes that link to the active note.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeBacklinks).onChange(async (value) => {
          this.plugin.settings.includeBacklinks = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Maximum backlinks")
      .setDesc(`Limit backlinks to between ${MIN_LINKED_NOTES} and ${MAX_LINKED_NOTES} notes.`)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(MIN_LINKED_NOTES);
        text.inputEl.max = String(MAX_LINKED_NOTES);
        text.setValue(String(this.plugin.settings.maxBacklinks)).onChange(async (value) => {
          const parsedValue = Number.parseInt(value, 10);

          if (Number.isNaN(parsedValue)) {
            return;
          }

          const clampedValue = clampLinkedNotes(parsedValue);
          this.plugin.settings.maxBacklinks = clampedValue;
          text.setValue(String(clampedValue));
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "Content Shaping" });

    new Setting(containerEl)
      .setName("Include frontmatter")
      .setDesc("Preserve YAML frontmatter when Promptfire reads Markdown files.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeFrontmatter).onChange(async (value) => {
          this.plugin.settings.includeFrontmatter = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include note body")
      .setDesc("Preserve the Markdown body content after optional frontmatter.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeBody).onChange(async (value) => {
          this.plugin.settings.includeBody = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Strip fenced code blocks")
      .setDesc("Replace triple-backtick blocks with a short placeholder to save space.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.stripCodeBlocks).onChange(async (value) => {
          this.plugin.settings.stripCodeBlocks = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Maximum output characters")
      .setDesc(
        `Promptfire trims the final output deterministically between ${MIN_OUTPUT_CHARACTERS.toLocaleString()} and ${MAX_OUTPUT_CHARACTERS.toLocaleString()} characters.`,
      )
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(MIN_OUTPUT_CHARACTERS);
        text.inputEl.max = String(MAX_OUTPUT_CHARACTERS);
        text.setValue(String(this.plugin.settings.maxOutputCharacters)).onChange(async (value) => {
          const parsedValue = Number.parseInt(value, 10);

          if (Number.isNaN(parsedValue)) {
            return;
          }

          const clampedValue = clampOutputCharacters(parsedValue);
          this.plugin.settings.maxOutputCharacters = clampedValue;
          text.setValue(String(clampedValue));
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "Prompt Format" });

    new Setting(containerEl)
      .setName("Include task section")
      .setDesc("Add a top-level task section before the context blocks.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeTaskSection).onChange(async (value) => {
          this.plugin.settings.includeTaskSection = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Task instruction")
      .setDesc("This text becomes the prompt's task section.")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.inputEl.cols = 48;
        text
          .setPlaceholder(DEFAULT_TASK_INSTRUCTION)
          .setValue(this.plugin.settings.taskInstruction)
          .onChange(async (value) => {
            this.plugin.settings.taskInstruction = value.trim() || DEFAULT_TASK_INSTRUCTION;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Include working rules")
      .setDesc("Append your persistent model instructions after the context sections.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeWorkingRules).onChange(async (value) => {
          this.plugin.settings.includeWorkingRules = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Working rules")
      .setDesc("One instruction per line.")
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.cols = 48;
        text
          .setPlaceholder(DEFAULT_WORKING_RULES.join("\n"))
          .setValue(this.plugin.settings.workingRules.join("\n"))
          .onChange(async (value) => {
            const nextRules = parseLines(value);
            this.plugin.settings.workingRules =
              nextRules.length > 0 ? nextRules : [...DEFAULT_WORKING_RULES];
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Include source path labels")
      .setDesc("Show the vault path directly above each copied source block.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeSourcePathLabels).onChange(async (value) => {
          this.plugin.settings.includeSourcePathLabels = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include source list")
      .setDesc("Append a final list of all included source paths.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeIncludedSourcesSection)
          .onChange(async (value) => {
            this.plugin.settings.includeIncludedSourcesSection = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Plugin UI" });

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Add a flame icon to the left ribbon for one-click copy.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
          this.plugin.settings.showRibbonIcon = value;
          await this.plugin.saveSettings();
          this.plugin.syncRibbonIcon();
        }),
      );
  }
}
