import { Notice, Plugin } from "obsidian";

import { assemblePrompt } from "./context/assembler";
import { collectContext } from "./context/collector";
import type { PromptBuildResult } from "./context/types";
import { copyTextToClipboard } from "./services/clipboard";
import {
  normalizeSettings,
  PromptfireSettingTab,
  type PromptfireSettings,
} from "./settings";
import { PromptfirePreviewModal } from "./ui/preview-modal";

export default class PromptfirePlugin extends Plugin {
  settings: PromptfireSettings = normalizeSettings(null);

  private ribbonIconEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "copy-context",
      name: "Copy context",
      callback: () => {
        void this.copyContext();
      },
    });

    this.addCommand({
      id: "preview-context",
      name: "Preview context",
      callback: () => {
        void this.previewContext();
      },
    });

    this.syncRibbonIcon();
    this.addSettingTab(new PromptfireSettingTab(this.app, this));
  }

  onunload(): void {
    this.removeRibbonIcon();
  }

  async loadSettings(): Promise<void> {
    const loadedData = (await this.loadData()) as Partial<PromptfireSettings> | null;
    this.settings = normalizeSettings(loadedData);
  }

  async saveSettings(): Promise<void> {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
  }

  syncRibbonIcon(): void {
    this.removeRibbonIcon();

    if (!this.settings.showRibbonIcon) {
      return;
    }

    this.ribbonIconEl = this.addRibbonIcon("flame", "Promptfire: Copy context", () => {
      void this.copyContext();
    });
  }

  private removeRibbonIcon(): void {
    this.ribbonIconEl?.remove();
    this.ribbonIconEl = null;
  }

  private async copyContext(): Promise<void> {
    const result = await this.buildPromptResult();

    if (!result) {
      return;
    }

    await this.copyPrompt(result);
  }

  private async previewContext(): Promise<void> {
    const result = await this.buildPromptResult();

    if (!result) {
      return;
    }

    new PromptfirePreviewModal(this.app, result, async () => this.copyPrompt(result)).open();
  }

  private async copyPrompt(result: PromptBuildResult): Promise<boolean> {
    try {
      await copyTextToClipboard(result.prompt);
      new Notice(this.buildCopyNotice(result));
      return true;
    } catch (error) {
      console.error("Promptfire clipboard error", error);
      new Notice("Promptfire could not copy to the clipboard. Use Preview to copy manually.");
      return false;
    }
  }

  private async buildPromptResult(): Promise<PromptBuildResult | null> {
    if (!this.hasAnyConfiguredContextSources()) {
      new Notice(
        "Promptfire has no context sources enabled. Configure reference notes, folders, the active note, or linked notes in the plugin settings.",
      );
      return null;
    }

    const collectedContext = await collectContext(this.app, this.settings);
    const result = assemblePrompt(collectedContext, this.settings);

    if (result.includedSources.length === 0) {
      new Notice(
        "Promptfire did not collect any usable context. Check your source paths, content filters, and active note settings.",
      );
      return null;
    }

    return result;
  }

  private hasAnyConfiguredContextSources(): boolean {
    return (
      this.settings.referenceNotePaths.length > 0 ||
      this.settings.referenceFolderPaths.length > 0 ||
      this.settings.includeActiveNote ||
      this.settings.includeOutgoingLinks ||
      this.settings.includeBacklinks
    );
  }

  private buildCopyNotice(result: PromptBuildResult): string {
    const sourceCount = result.includedSources.length;
    const issueSuffix = result.issues.length > 0 ? ` ${result.issues.length} issue(s) noted.` : "";

    return `Promptfire copied ${result.characterCount.toLocaleString()} characters from ${sourceCount} source(s).${issueSuffix}`;
  }
}
