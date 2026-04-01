import { App, Modal } from "obsidian";

import type { PromptBuildResult } from "../context/types";

export class PromptfirePreviewModal extends Modal {
  constructor(
    app: App,
    private readonly result: PromptBuildResult,
    private readonly onCopy: () => Promise<boolean>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("promptfire-preview-modal");

    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Promptfire Preview" });
    contentEl.createDiv({
      cls: "promptfire-preview__meta",
      text: `${this.result.characterCount.toLocaleString()} characters from ${this.result.includedSourcePaths.length} source(s)`,
    });

    if (this.result.issues.length > 0) {
      const warningContainer = contentEl.createDiv({ cls: "promptfire-preview__warnings" });
      warningContainer.createEl("strong", { text: "Notes" });
      const warningList = warningContainer.createEl("ul");

      for (const issue of this.result.issues) {
        warningList.createEl("li", { text: issue.message });
      }
    }

    const textarea = contentEl.createEl("textarea", { cls: "promptfire-preview__textarea" });
    textarea.readOnly = true;
    textarea.value = this.result.prompt;
    textarea.spellcheck = false;

    const actions = contentEl.createDiv({ cls: "promptfire-preview__actions" });
    const copyButton = actions.createEl("button", {
      cls: "mod-cta",
      text: "Copy",
    });
    const closeButton = actions.createEl("button", {
      text: "Close",
    });

    copyButton.addEventListener("click", async () => {
      copyButton.disabled = true;

      const copied = await this.onCopy();

      copyButton.disabled = false;

      if (copied) {
        copyButton.setText("Copied");
        window.setTimeout(() => copyButton.setText("Copy"), 1500);
      }
    });

    closeButton.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
