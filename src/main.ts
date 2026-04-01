import { Notice, Plugin } from "obsidian";

import { loadVaultConfig, writeVaultConfig, type VaultConfigStatus } from "./config/vault-config";
import { assemblePrompt } from "./context/assembler";
import { collectContext } from "./context/collector";
import type {
  PromptBuildResult,
  PromptfireProfile,
  PromptfireSourceDefinition,
  PromptfireTemplateBlock,
  TemplateBlockId,
} from "./context/types";
import { copyTextToClipboard } from "./services/clipboard";
import {
  createDefaultProfile,
  duplicateProfile,
  normalizeSettings,
  PromptfireSettingTab,
  type PromptfireSettings,
} from "./settings";
import { PromptfirePreviewModal } from "./ui/preview-modal";
import { PromptfireProfilePickerModal } from "./ui/profile-picker-modal";

export default class PromptfirePlugin extends Plugin {
  settings: PromptfireSettings = normalizeSettings(null);

  private registeredProfileCommandIds: string[] = [];
  private ribbonIconEl: HTMLElement | null = null;
  private vaultConfigStatus: VaultConfigStatus = {
    path: ".promptfire.json",
    state: "disabled",
  };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "copy-context",
      name: "Copy context for active profile",
      callback: () => {
        void this.copyContext();
      },
    });

    this.addCommand({
      id: "preview-context",
      name: "Preview context for active profile",
      callback: () => {
        void this.previewContext();
      },
    });

    this.addCommand({
      id: "copy-context-for-selected-profile",
      name: "Copy context for selected profile",
      callback: () => {
        this.openProfilePicker((profile) => {
          void this.copyContext(profile.id);
        });
      },
    });

    this.addCommand({
      id: "preview-context-for-selected-profile",
      name: "Preview context for selected profile",
      callback: () => {
        this.openProfilePicker((profile) => {
          void this.previewContext(profile.id);
        });
      },
    });

    this.addCommand({
      id: "switch-active-profile",
      name: "Switch active profile",
      callback: () => {
        this.openProfilePicker((profile) => {
          void this.setActiveProfile(profile.id);
          new Notice(`Promptfire active profile: ${profile.name}`);
        });
      },
    });

    this.addCommand({
      id: "reload-vault-config",
      name: "Reload vault config",
      callback: () => {
        void this.reloadVaultConfig();
      },
    });

    this.addCommand({
      id: "export-settings-to-vault-config",
      name: "Export resolved settings to vault config",
      callback: () => {
        void this.exportSettingsToVaultConfig();
      },
    });

    this.syncRibbonIcon();
    this.syncProfileCommands();
    this.addSettingTab(new PromptfireSettingTab(this.app, this));
  }

  onunload(): void {
    this.removeRibbonIcon();
    this.unregisterProfileCommands();
  }

  async loadSettings(): Promise<void> {
    const loadedData = (await this.loadData()) as Partial<PromptfireSettings> | null;
    const normalizedSettings = normalizeSettings(loadedData);
    this.settings = await this.resolveSettings(normalizedSettings);
  }

  async saveSettings(): Promise<void> {
    const normalizedSettings = normalizeSettings(this.settings);
    await this.saveData(normalizedSettings);
    this.settings = await this.resolveSettings(normalizedSettings);
    this.syncRibbonIcon();
    this.syncProfileCommands();
  }

  getProfileById(profileId: string): PromptfireProfile | undefined {
    return this.settings.profiles.find((profile) => profile.id === profileId);
  }

  getActiveProfile(): PromptfireProfile {
    const activeProfile = this.getProfileById(this.settings.activeProfileId);

    if (activeProfile) {
      return activeProfile;
    }

    const firstProfile = this.settings.profiles[0];

    if (firstProfile) {
      return firstProfile;
    }

    const fallbackProfile = createDefaultProfile();
    this.settings.profiles = [fallbackProfile];
    this.settings.activeProfileId = fallbackProfile.id;
    return fallbackProfile;
  }

  getSourceDefinition(
    profileId: string,
    sourceDefinitionId: string,
  ): PromptfireSourceDefinition | undefined {
    return this.getProfileById(profileId)?.sourceDefinitions.find(
      (sourceDefinition) => sourceDefinition.id === sourceDefinitionId,
    );
  }

  getTemplateBlock(profileId: string, blockId: TemplateBlockId): PromptfireTemplateBlock | undefined {
    return this.getProfileById(profileId)?.templateBlocks.find((block) => block.id === blockId);
  }

  getVaultConfigStatusText(): string {
    if (!this.settings.enableVaultConfig) {
      return `Vault config is disabled. Current path: ${this.settings.vaultConfigPath}`;
    }

    if (this.vaultConfigStatus.state === "loaded") {
      return `Loaded vault config from ${this.vaultConfigStatus.path}`;
    }

    if (this.vaultConfigStatus.state === "missing") {
      return `Vault config file not found at ${this.vaultConfigStatus.path}`;
    }

    if (this.vaultConfigStatus.state === "error") {
      return `Vault config error at ${this.vaultConfigStatus.path}: ${this.vaultConfigStatus.error}`;
    }

    return `Vault config path: ${this.settings.vaultConfigPath}`;
  }

  async setActiveProfile(profileId: string): Promise<void> {
    const profile = this.getProfileById(profileId);

    if (!profile) {
      return;
    }

    this.settings.activeProfileId = profile.id;
    await this.saveSettings();
  }

  async createProfile(): Promise<void> {
    const profileNumber = this.settings.profiles.length + 1;
    const profile = createDefaultProfile(`Profile ${profileNumber}`);
    this.settings.profiles.push(profile);
    this.settings.activeProfileId = profile.id;
    await this.saveSettings();
  }

  async duplicateActiveProfile(): Promise<void> {
    const profile = this.getActiveProfile();
    const duplicatedProfile = duplicateProfile(profile);
    this.settings.profiles.push(duplicatedProfile);
    this.settings.activeProfileId = duplicatedProfile.id;
    await this.saveSettings();
  }

  async deleteActiveProfile(): Promise<void> {
    if (this.settings.profiles.length <= 1) {
      return;
    }

    const activeProfile = this.getActiveProfile();
    this.settings.profiles = this.settings.profiles.filter((profile) => profile.id !== activeProfile.id);
    this.settings.activeProfileId = this.settings.profiles[0]?.id ?? createDefaultProfile().id;
    await this.saveSettings();
  }

  async reloadVaultConfig(): Promise<void> {
    this.settings = await this.resolveSettings(normalizeSettings(this.settings));
    this.syncRibbonIcon();
    this.syncProfileCommands();

    const statusText = this.getVaultConfigStatusText();
    new Notice(statusText);
  }

  async exportSettingsToVaultConfig(): Promise<void> {
    const status = await writeVaultConfig(this.app, this.settings.vaultConfigPath, this.settings);
    this.vaultConfigStatus = status;
    new Notice(`Promptfire exported settings to ${status.path}`);
  }

  syncRibbonIcon(): void {
    this.removeRibbonIcon();

    if (!this.settings.showRibbonIcon) {
      return;
    }

    const activeProfile = this.getActiveProfile();
    this.ribbonIconEl = this.addRibbonIcon(
      "flame",
      `Promptfire: Copy context (${activeProfile.name})`,
      () => {
        void this.copyContext();
      },
    );
  }

  private removeRibbonIcon(): void {
    this.ribbonIconEl?.remove();
    this.ribbonIconEl = null;
  }

  private openProfilePicker(onChooseProfile: (profile: PromptfireProfile) => void): void {
    new PromptfireProfilePickerModal(this.app, this.settings.profiles, onChooseProfile).open();
  }

  private syncProfileCommands(): void {
    this.unregisterProfileCommands();

    if (!this.settings.registerProfileCommands) {
      return;
    }

    for (const profile of this.settings.profiles) {
      const copyCommandId = `copy-context-${profile.id}`;
      const previewCommandId = `preview-context-${profile.id}`;

      this.addCommand({
        id: copyCommandId,
        name: `Copy context: ${profile.name}`,
        callback: () => {
          void this.copyContext(profile.id);
        },
      });
      this.addCommand({
        id: previewCommandId,
        name: `Preview context: ${profile.name}`,
        callback: () => {
          void this.previewContext(profile.id);
        },
      });

      this.registeredProfileCommandIds.push(copyCommandId, previewCommandId);
    }
  }

  private unregisterProfileCommands(): void {
    for (const commandId of this.registeredProfileCommandIds) {
      this.removeCommand(commandId);
    }

    this.registeredProfileCommandIds = [];
  }

  private async resolveSettings(baseSettings: PromptfireSettings): Promise<PromptfireSettings> {
    if (!baseSettings.enableVaultConfig) {
      this.vaultConfigStatus = {
        path: baseSettings.vaultConfigPath,
        state: "disabled",
      };
      return baseSettings;
    }

    const { config, status } = await loadVaultConfig(this.app, baseSettings.vaultConfigPath);
    this.vaultConfigStatus = status;

    if (!config) {
      return baseSettings;
    }

    return normalizeSettings({
      ...baseSettings,
      ...config,
      activeProfileId: config.activeProfileId ?? baseSettings.activeProfileId,
      profiles: config.profiles ?? baseSettings.profiles,
    });
  }

  private async copyContext(profileId?: string): Promise<void> {
    const result = await this.buildPromptResult(profileId);

    if (!result) {
      return;
    }

    await this.copyPrompt(result);
  }

  private async previewContext(profileId?: string): Promise<void> {
    const result = await this.buildPromptResult(profileId);

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

  private async buildPromptResult(profileId?: string): Promise<PromptBuildResult | null> {
    const profile = profileId ? this.getProfileById(profileId) : this.getActiveProfile();

    if (!profile) {
      new Notice(`Promptfire could not find the requested profile.`);
      return null;
    }

    if (!profile.sourceDefinitions.some((sourceDefinition) => sourceDefinition.enabled)) {
      new Notice(
        `Promptfire profile "${profile.name}" has no enabled source definitions. Add or enable sources in the plugin settings.`,
      );
      return null;
    }

    const collectedContext = await collectContext(this.app, profile);
    const result = assemblePrompt(collectedContext, profile);

    if (result.includedSources.length === 0) {
      new Notice(
        `Promptfire profile "${profile.name}" did not collect any usable context. Check its sources, filters, and template blocks.`,
      );
      return null;
    }

    return result;
  }

  private buildCopyNotice(result: PromptBuildResult): string {
    const issueSuffix = result.issues.length > 0 ? ` ${result.issues.length} issue(s) noted.` : "";

    return `Promptfire copied ${result.characterCount.toLocaleString()} characters from ${result.includedSources.length} source(s) using profile "${result.profileName}".${issueSuffix}`;
  }
}
