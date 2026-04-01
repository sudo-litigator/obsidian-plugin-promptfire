import { Notice, Plugin } from "obsidian";

import { loadVaultConfig, writeVaultConfig, type VaultConfigStatus } from "./config/vault-config";
import { assemblePrompt } from "./context/assembler";
import { collectContext } from "./context/collector";
import type {
  CollectedContext,
  PromptBuildOverrides,
  PromptBuildResult,
  PromptExportFormat,
  PromptfireOutputTarget,
  PromptfireProfile,
  PromptfireSourceDefinition,
  PromptfireTemplateBlock,
  TemplateBlockId,
} from "./context/types";
import { executeOutputTarget } from "./services/output-targets";
import {
  createDefaultProfile,
  createSourceDefinition,
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
      name: "Run default output target for active profile",
      callback: () => {
        void this.runDefaultOutputTarget();
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
      name: "Run default output target for selected profile",
      callback: () => {
        this.openProfilePicker((profile) => {
          void this.runDefaultOutputTarget(profile.id);
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

  getOutputTarget(profileId: string, outputTargetId: string): PromptfireOutputTarget | undefined {
    return this.getProfileById(profileId)?.outputTargets.find((target) => target.id === outputTargetId);
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

    new Notice(this.getVaultConfigStatusText());
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
      `Promptfire: Run default output target (${activeProfile.name})`,
      () => {
        void this.runDefaultOutputTarget();
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
      const runCommandId = `run-default-output-target-${profile.id}`;
      const previewCommandId = `preview-context-${profile.id}`;

      this.addCommand({
        id: runCommandId,
        name: `Run default output target: ${profile.name}`,
        callback: () => {
          void this.runDefaultOutputTarget(profile.id);
        },
      });
      this.addCommand({
        id: previewCommandId,
        name: `Preview context: ${profile.name}`,
        callback: () => {
          void this.previewContext(profile.id);
        },
      });

      this.registeredProfileCommandIds.push(runCommandId, previewCommandId);
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

  private getDefaultOutputTarget(profile: PromptfireProfile): PromptfireOutputTarget {
    const defaultTarget = profile.outputTargets.find(
      (target) => target.id === profile.defaultOutputTargetId && target.enabled,
    );

    if (defaultTarget) {
      return defaultTarget;
    }

    const fallbackTarget = profile.outputTargets.find((target) => target.enabled);

    if (fallbackTarget) {
      return fallbackTarget;
    }

    return profile.outputTargets[0] ?? {
      appendSeparator: "\n\n",
      enabled: true,
      format: "markdown",
      id: "clipboard-fallback",
      label: "Clipboard",
      openAfterWrite: false,
      pathTemplate: "",
      type: "clipboard",
      urlTemplate: "",
    };
  }

  private buildPromptResult(
    profile: PromptfireProfile,
    context: CollectedContext,
    overrides?: PromptBuildOverrides,
    outputFormat?: PromptExportFormat,
  ): PromptBuildResult {
    return assemblePrompt(context, profile, {
      ...overrides,
      outputFormat: outputFormat ?? overrides?.outputFormat ?? "markdown",
    });
  }

  private async collectProfileContext(profileId?: string): Promise<{
    context: CollectedContext;
    profile: PromptfireProfile;
  } | null> {
    const profile = profileId ? this.getProfileById(profileId) : this.getActiveProfile();

    if (!profile) {
      new Notice("Promptfire could not find the requested profile.");
      return null;
    }

    if (!profile.sourceDefinitions.some((sourceDefinition) => sourceDefinition.enabled)) {
      new Notice(
        `Promptfire profile "${profile.name}" has no enabled source definitions. Add or enable sources in the plugin settings.`,
      );
      return null;
    }

    const context = await collectContext(this.app, profile);

    if (context.sources.length === 0) {
      new Notice(
        `Promptfire profile "${profile.name}" did not collect any usable context. Check its sources, filters, and template blocks.`,
      );
      return null;
    }

    return {
      context,
      profile,
    };
  }

  private async runDefaultOutputTarget(profileId?: string): Promise<void> {
    const collected = await this.collectProfileContext(profileId);

    if (!collected) {
      return;
    }

    const { context, profile } = collected;
    const outputTarget = this.getDefaultOutputTarget(profile);
    const result = this.buildPromptResult(profile, context, undefined, outputTarget.format);

    if (!result.prompt.trim()) {
      new Notice(`Promptfire compiled an empty prompt for profile "${profile.name}".`);
      return;
    }

    try {
      const message = await executeOutputTarget(this.app, profile, outputTarget, result, {
        activeNotePath: context.activeNotePath,
        now: new Date(),
        outputTarget,
        profile,
        result,
      });
      new Notice(`${message} ${this.buildRunNotice(result, outputTarget)}`.trim());
    } catch (error) {
      console.error("Promptfire output target error", error);
      new Notice(
        error instanceof Error
          ? `Promptfire could not execute "${outputTarget.label}": ${error.message}`
          : `Promptfire could not execute "${outputTarget.label}".`,
      );
    }
  }

  private async previewContext(profileId?: string): Promise<void> {
    const collected = await this.collectProfileContext(profileId);

    if (!collected) {
      return;
    }

    const { context, profile } = collected;
    const defaultTarget = this.getDefaultOutputTarget(profile);
    const initialResult = this.buildPromptResult(profile, context, undefined, defaultTarget.format);

    new PromptfirePreviewModal(this.app, {
      context,
      initialProfile: profile,
      initialResult,
      outputTargets: profile.outputTargets.filter((target) => target.enabled),
      compile: (overrides) => {
        const target = profile.outputTargets.find((candidate) => candidate.id === profile.defaultOutputTargetId);
        return this.buildPromptResult(
          profile,
          context,
          overrides,
          overrides.outputFormat ?? target?.format ?? defaultTarget.format,
        );
      },
      executeOutputTarget: async (outputTargetId, overrides) => {
        const target =
          profile.outputTargets.find((candidate) => candidate.id === outputTargetId && candidate.enabled) ??
          defaultTarget;
        const result = this.buildPromptResult(
          profile,
          context,
          overrides,
          overrides.outputFormat ?? target.format,
        );

        if (!result.prompt.trim()) {
          new Notice(`Promptfire compiled an empty prompt for profile "${profile.name}".`);
          return false;
        }

        try {
          const message = await executeOutputTarget(this.app, profile, target, result, {
            activeNotePath: context.activeNotePath,
            now: new Date(),
            outputTarget: target,
            profile,
            result,
          });
          new Notice(`${message} ${this.buildRunNotice(result, target)}`.trim());
          return true;
        } catch (error) {
          console.error("Promptfire preview output target error", error);
          new Notice(
            error instanceof Error
              ? `Promptfire could not execute "${target.label}": ${error.message}`
              : `Promptfire could not execute "${target.label}".`,
          );
          return false;
        }
      },
      saveProfileSnapshot: async (name, overrides, outputTargetId) => {
        await this.saveProfileSnapshot(profile, context, name, overrides, outputTargetId);
      },
    }).open();
  }

  private async saveProfileSnapshot(
    baseProfile: PromptfireProfile,
    context: CollectedContext,
    name: string,
    overrides: PromptBuildOverrides,
    outputTargetId: string,
  ): Promise<void> {
    const snapshotProfile = duplicateProfile(baseProfile);
    const enabledSourceIds = new Set(overrides.enabledSourceIds ?? context.sources.map((source) => source.id));
    const manualOrder = overrides.reorderedSourceIds ?? context.sources.map((source) => source.id);
    const orderedSources = manualOrder
      .map((sourceId) => context.sources.find((source) => source.id === sourceId))
      .filter((source): source is CollectedContext["sources"][number] => Boolean(source))
      .filter((source) => enabledSourceIds.has(source.id));

    if (orderedSources.length === 0) {
      new Notice("Promptfire could not save a snapshot profile with zero enabled sources.");
      return;
    }

    snapshotProfile.id = createDefaultProfile().id;
    snapshotProfile.name = name.trim() || `${baseProfile.name} Snapshot`;
    snapshotProfile.defaultOutputTargetId = outputTargetId;
    snapshotProfile.templateBlocks = snapshotProfile.templateBlocks.map((block) => ({
      ...block,
      enabled: overrides.enabledBlockIds
        ? overrides.enabledBlockIds.includes(block.id)
        : block.enabled,
    }));
    snapshotProfile.sourceDefinitions = orderedSources.map((source, index) => {
      const sourceDefinition = this.getSourceDefinition(baseProfile.id, source.sourceDefinitionId);
      const snapshotSource = createSourceDefinition("file");
      snapshotSource.id = createSourceDefinition("file").id;
      snapshotSource.extractMode = sourceDefinition?.extractMode ?? snapshotSource.extractMode;
      snapshotSource.headingFilters = [...(sourceDefinition?.headingFilters ?? [])];
      snapshotSource.label = source.title;
      snapshotSource.maxCharacters = sourceDefinition?.maxCharacters;
      snapshotSource.path = source.path;
      snapshotSource.priority = orderedSources.length - index;
      snapshotSource.regexExclude = sourceDefinition?.regexExclude ?? "";
      snapshotSource.regexInclude = sourceDefinition?.regexInclude ?? "";
      snapshotSource.section = source.section;
      return snapshotSource;
    });

    const selectedTarget = snapshotProfile.outputTargets.find((target) => target.id === outputTargetId);

    if (selectedTarget && overrides.outputFormat) {
      selectedTarget.format = overrides.outputFormat;
    }

    this.settings.profiles.push(snapshotProfile);
    this.settings.activeProfileId = snapshotProfile.id;
    await this.saveSettings();
    new Notice(`Promptfire saved preview snapshot as profile "${snapshotProfile.name}".`);
  }

  private buildRunNotice(result: PromptBuildResult, outputTarget: PromptfireOutputTarget): string {
    const issueSuffix = result.issues.length > 0 ? ` ${result.issues.length} issue(s) noted.` : "";

    return `Profile "${result.profileName}" produced ${result.characterCount.toLocaleString()} characters from ${result.includedSources.length} source(s) in ${result.outputFormat} via "${outputTarget.label}".${issueSuffix}`;
  }
}
