import { App, SuggestModal } from "obsidian";

import type { PromptfireProfile } from "../context/types";

export class PromptfireProfilePickerModal extends SuggestModal<PromptfireProfile> {
  constructor(
    app: App,
    private readonly profiles: PromptfireProfile[],
    private readonly onChooseProfile: (profile: PromptfireProfile) => void,
  ) {
    super(app);
    this.setPlaceholder("Select a Promptfire profile");
  }

  getSuggestions(query: string): PromptfireProfile[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.profiles;
    }

    return this.profiles.filter((profile) => profile.name.toLowerCase().includes(normalizedQuery));
  }

  renderSuggestion(profile: PromptfireProfile, el: HTMLElement): void {
    el.createEl("div", { text: profile.name });
    el.createEl("small", {
      text: `${profile.sourceDefinitions.filter((sourceDefinition) => sourceDefinition.enabled).length} enabled source definition(s)`,
    });
  }

  onChooseSuggestion(profile: PromptfireProfile): void {
    this.onChooseProfile(profile);
  }
}
