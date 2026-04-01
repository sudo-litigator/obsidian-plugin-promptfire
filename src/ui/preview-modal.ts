import { App, Modal, Setting } from "obsidian";

import type {
  CollectedContext,
  PromptBuildOverrides,
  PromptBuildResult,
  PromptExportFormat,
  PromptfireOutputTarget,
  PromptfireProfile,
  TemplateBlockId,
} from "../context/types";

interface PromptfirePreviewSession {
  compile: (overrides: PromptBuildOverrides) => PromptBuildResult;
  context: CollectedContext;
  executeOutputTarget: (outputTargetId: string, overrides: PromptBuildOverrides) => Promise<boolean>;
  initialProfile: PromptfireProfile;
  initialResult: PromptBuildResult;
  outputTargets: PromptfireOutputTarget[];
  saveProfileSnapshot: (
    name: string,
    overrides: PromptBuildOverrides,
    outputTargetId: string,
  ) => Promise<void>;
}

function moveItem(items: string[], fromIndex: number, toIndex: number): string[] {
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

export class PromptfirePreviewModal extends Modal {
  private enabledBlockIds: Set<TemplateBlockId>;
  private enabledSourceIds: Set<string>;
  private reorderedSourceIds: string[];
  private result: PromptBuildResult;
  private selectedFormat: PromptExportFormat;
  private selectedTargetId: string;

  constructor(app: App, private readonly session: PromptfirePreviewSession) {
    super(app);

    this.result = session.initialResult;
    this.enabledBlockIds = new Set(
      session.initialProfile.templateBlocks.filter((block) => block.enabled).map((block) => block.id),
    );
    this.enabledSourceIds = new Set(session.context.sources.map((source) => source.id));
    this.reorderedSourceIds = session.context.sources.map((source) => source.id);
    this.selectedTargetId =
      session.outputTargets.find((target) => target.id === session.initialProfile.defaultOutputTargetId)?.id ??
      session.outputTargets[0]?.id ??
      "clipboard";
    this.selectedFormat =
      session.outputTargets.find((target) => target.id === this.selectedTargetId)?.format ??
      session.initialResult.outputFormat;
  }

  onOpen(): void {
    this.modalEl.addClass("promptfire-preview-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private buildOverrides(): PromptBuildOverrides {
    return {
      enabledBlockIds: [...this.enabledBlockIds],
      enabledSourceIds: [...this.enabledSourceIds],
      outputFormat: this.selectedFormat,
      reorderedSourceIds: [...this.reorderedSourceIds],
    };
  }

  private recompile(): void {
    this.result = this.session.compile(this.buildOverrides());
  }

  private updateState(mutator: () => void): void {
    mutator();
    this.recompile();
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const includedSourceMap = new Map(
      this.result.includedSources.map((source) => [source.id, source]),
    );
    const target = this.session.outputTargets.find((candidate) => candidate.id === this.selectedTargetId);

    contentEl.createEl("h2", { text: "Promptfire Preview" });
    contentEl.createDiv({
      cls: "promptfire-preview__meta",
      text: `Profile: ${this.result.profileName} | ${this.result.characterCount.toLocaleString()} characters | ${this.result.includedSources.length}/${this.session.context.sources.length} source(s) included | ${this.selectedFormat}`,
    });

    const controlsGrid = contentEl.createDiv({ cls: "promptfire-preview__controls-grid" });
    const targetContainer = controlsGrid.createDiv({ cls: "promptfire-preview__panel" });
    targetContainer.createEl("h3", { text: "Output" });

    new Setting(targetContainer)
      .setName("Target")
      .setDesc("Choose where the current compiled prompt should go.")
      .addDropdown((dropdown) => {
        for (const outputTarget of this.session.outputTargets) {
          dropdown.addOption(outputTarget.id, outputTarget.label);
        }

        dropdown.setValue(this.selectedTargetId).onChange((value) => {
          const nextTarget = this.session.outputTargets.find((candidate) => candidate.id === value);

          this.updateState(() => {
            this.selectedTargetId = value;
            this.selectedFormat = nextTarget?.format ?? this.selectedFormat;
          });
        });
      });

    new Setting(targetContainer)
      .setName("Format")
      .setDesc("Render the current prompt as Markdown, XML, or JSON before export.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("markdown", "Markdown")
          .addOption("xml", "XML")
          .addOption("json", "JSON")
          .setValue(this.selectedFormat)
          .onChange((value) => {
            this.updateState(() => {
              this.selectedFormat = value as PromptExportFormat;
            });
          }),
      );

    targetContainer.createDiv({
      cls: "promptfire-preview__panel-meta",
      text: target
        ? `Selected target: ${target.label} (${target.type})`
        : "No enabled output targets on this profile.",
    });

    const blocksContainer = controlsGrid.createDiv({ cls: "promptfire-preview__panel" });
    blocksContainer.createEl("h3", { text: "Blocks" });

    for (const block of this.session.initialProfile.templateBlocks) {
      new Setting(blocksContainer)
        .setName(block.heading)
        .setDesc(block.maxCharacters ? `Block budget: ${block.maxCharacters.toLocaleString()} chars` : "")
        .addToggle((toggle) =>
          toggle.setValue(this.enabledBlockIds.has(block.id)).onChange((value) => {
            this.updateState(() => {
              if (value) {
                this.enabledBlockIds.add(block.id);
              } else {
                this.enabledBlockIds.delete(block.id);
              }
            });
          }),
        );
    }

    if (this.result.issues.length > 0) {
      const warningContainer = contentEl.createDiv({ cls: "promptfire-preview__warnings" });
      warningContainer.createEl("strong", { text: "Notes" });
      const warningList = warningContainer.createEl("ul");

      for (const issue of this.result.issues) {
        warningList.createEl("li", { text: issue.message });
      }
    }

    const sourcesContainer = contentEl.createDiv({ cls: "promptfire-preview__debug" });
    sourcesContainer.createEl("h3", { text: "Sources" });

    if (this.session.context.sources.length === 0) {
      sourcesContainer.createDiv({
        cls: "promptfire-preview__debug-empty",
        text: "No sources were collected for this profile.",
      });
    } else {
      const debugList = sourcesContainer.createDiv({ cls: "promptfire-preview__debug-list" });

      this.reorderedSourceIds.forEach((sourceId, index) => {
        const source = this.session.context.sources.find((candidate) => candidate.id === sourceId);

        if (!source) {
          return;
        }

        const includedSource = includedSourceMap.get(source.id);
        const enabled = this.enabledSourceIds.has(source.id);
        const item = debugList.createDiv({ cls: "promptfire-preview__debug-item" });
        const itemHeader = item.createDiv({ cls: "promptfire-preview__debug-header" });
        const itemInfo = itemHeader.createDiv();
        itemInfo.createEl("div", {
          cls: "promptfire-preview__debug-title",
          text: source.title,
        });
        itemInfo.createEl("div", {
          cls: "promptfire-preview__debug-meta",
          text: [
            source.section,
            source.sourceDefinitionLabel,
            source.path,
            `priority ${source.priority}`,
            includedSource
              ? `${includedSource.characterCount.toLocaleString()} chars${includedSource.truncated ? `, truncated from ${includedSource.originalCharacterCount.toLocaleString()}` : ""}`
              : enabled
                ? "enabled, but not included after budgeting"
                : "disabled",
          ].join(" | "),
        });

        const controls = itemHeader.createDiv({ cls: "promptfire-preview__debug-controls" });
        const toggle = controls.createEl("input", { type: "checkbox" });
        toggle.checked = enabled;
        toggle.addEventListener("change", () => {
          this.updateState(() => {
            if (toggle.checked) {
              this.enabledSourceIds.add(source.id);
            } else {
              this.enabledSourceIds.delete(source.id);
            }
          });
        });

        const moveUpButton = controls.createEl("button", { text: "Up" });
        moveUpButton.disabled = index === 0;
        moveUpButton.addEventListener("click", () => {
          this.updateState(() => {
            this.reorderedSourceIds = moveItem(this.reorderedSourceIds, index, index - 1);
          });
        });

        const moveDownButton = controls.createEl("button", { text: "Down" });
        moveDownButton.disabled = index === this.reorderedSourceIds.length - 1;
        moveDownButton.addEventListener("click", () => {
          this.updateState(() => {
            this.reorderedSourceIds = moveItem(this.reorderedSourceIds, index, index + 1);
          });
        });
      });
    }

    contentEl.createEl("h3", { text: "Prompt Output" });
    const textarea = contentEl.createEl("textarea", { cls: "promptfire-preview__textarea" });
    textarea.readOnly = true;
    textarea.value = this.result.prompt;
    textarea.spellcheck = false;

    const actions = contentEl.createDiv({ cls: "promptfire-preview__actions" });
    const runButton = actions.createEl("button", {
      cls: "mod-cta",
      text: target?.type === "clipboard" ? "Copy" : "Run target",
    });
    const saveSnapshotButton = actions.createEl("button", {
      text: "Save profile snapshot",
    });
    const closeButton = actions.createEl("button", {
      text: "Close",
    });

    runButton.addEventListener("click", async () => {
      runButton.disabled = true;
      const didRun = await this.session.executeOutputTarget(this.selectedTargetId, this.buildOverrides());
      runButton.disabled = false;

      if (didRun) {
        runButton.setText(target?.type === "clipboard" ? "Copied" : "Done");
        window.setTimeout(() => {
          runButton.setText(target?.type === "clipboard" ? "Copy" : "Run target");
        }, 1500);
      }
    });

    saveSnapshotButton.addEventListener("click", async () => {
      const suggestedName = `${this.session.initialProfile.name} Snapshot`;
      const name = window.prompt("Promptfire snapshot profile name", suggestedName);

      if (!name) {
        return;
      }

      saveSnapshotButton.disabled = true;
      await this.session.saveProfileSnapshot(name, this.buildOverrides(), this.selectedTargetId);
      saveSnapshotButton.disabled = false;
    });

    closeButton.addEventListener("click", () => this.close());
  }
}
