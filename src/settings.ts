import { App, PluginSettingTab, Setting } from "obsidian";
import AmazeCompletePlugin from "./main";
import { DAYS_OF_WEEK, getLocaleWeekStart } from "./utils";

export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "locale-default";

export type TemplateEngineMode = "auto" | "templater" | "core-templates";

export interface AmazeSettings {
  // Trigger settings
  isAutosuggestEnabled: boolean;
  autocompleteTriggerPhrase: string;

  // Natural Language Dates settings
  enableDates: boolean;
  autosuggestToggleLink: boolean;
  format: string;
  timeFormat: string;
  weekStart: DayOfWeek;

  // Template settings
  enableTemplates: boolean;
  templateEngine: TemplateEngineMode;
  customTemplateFolder: string;

  // File settings
  enableFiles: boolean;
  includeFileAliases: boolean;
  excludeTemplatesFromFiles: boolean;
}

export const DEFAULT_SETTINGS: AmazeSettings = {
  isAutosuggestEnabled: true,
  autocompleteTriggerPhrase: "@",

  enableDates: true,
  autosuggestToggleLink: true,
  format: "YYYY-MM-DD",
  timeFormat: "HH:mm",
  weekStart: "locale-default",

  enableTemplates: true,
  templateEngine: "auto",
  customTemplateFolder: "",

  enableFiles: true,
  includeFileAliases: true,
  excludeTemplatesFromFiles: true,
};

export class AmazeSettingsTab extends PluginSettingTab {
  plugin: AmazeCompletePlugin;

  constructor(app: App, plugin: AmazeCompletePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private setSectionSettingsDisabled(
    settings: Setting[],
    disabled: boolean
  ): void {
    for (const setting of settings) {
      setting.setDisabled(disabled);
      setting.settingEl.toggleClass("amaze-setting-disabled", disabled);
      setting.controlEl
        .querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLButtonElement
        >("input, select, button, textarea")
        .forEach((el) => {
          el.disabled = disabled;
        });
    }
  }

  display(): void {
    const { containerEl } = this;
    const localizedWeekdays = window.moment.weekdays();
    const localeWeekStart = getLocaleWeekStart();

    containerEl.empty();

    // --- Section 1: Autosuggest trigger ---
    containerEl.createEl("h3", {
      text: "Autosuggest trigger",
    });

    const triggerSectionSettings: Setting[] = [];

    new Setting(containerEl)
      .setName("Enable autosuggest")
      .setDesc(
        "Open the unified autocomplete menu (dates, templates, files) with trigger phrase"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isAutosuggestEnabled)
          .onChange(async (value) => {
            this.plugin.settings.isAutosuggestEnabled = value;
            this.setSectionSettingsDisabled(triggerSectionSettings, !value);
            await this.plugin.saveSettings();
          })
      );

    triggerSectionSettings.push(
      new Setting(containerEl)
        .setName("Trigger phrase")
        .setDesc("Character(s) that will cause the autosuggest menu to open")
        .addMomentFormat((text) =>
          text
            .setPlaceholder(DEFAULT_SETTINGS.autocompleteTriggerPhrase)
            .setValue(this.plugin.settings.autocompleteTriggerPhrase || "@")
            .onChange(async (value) => {
              this.plugin.settings.autocompleteTriggerPhrase =
                value.trim() || "@";
              await this.plugin.saveSettings();
            })
        )
    );

    this.setSectionSettingsDisabled(
      triggerSectionSettings,
      !this.plugin.settings.isAutosuggestEnabled
    );

    // --- Section 2: Natural Language Dates ---
    containerEl.createEl("h3", {
      text: "Natural Language Dates",
    });

    const dateSectionSettings: Setting[] = [];

    new Setting(containerEl)
      .setName("Enable date suggestions")
      .setDesc("Suggest natural language dates (e.g., Today, Tomorrow, next Friday)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDates)
          .onChange(async (value) => {
            this.plugin.settings.enableDates = value;
            this.setSectionSettingsDisabled(dateSectionSettings, !value);
            await this.plugin.saveSettings();
          })
      );

    dateSectionSettings.push(
      new Setting(containerEl)
        .setName("Add dates as link?")
        .setDesc(
          "If enabled, dates created via autosuggest will be wrapped in [[wikilinks]]"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.autosuggestToggleLink)
            .onChange(async (value) => {
              this.plugin.settings.autosuggestToggleLink = value;
              await this.plugin.saveSettings();
            })
        ),

      new Setting(containerEl)
        .setName("Date format")
        .setDesc("Output format for parsed dates")
        .addMomentFormat((text) =>
          text
            .setDefaultFormat("YYYY-MM-DD")
            .setValue(this.plugin.settings.format)
            .onChange(async (value) => {
              this.plugin.settings.format = value || "YYYY-MM-DD";
              await this.plugin.saveSettings();
            })
        ),

      new Setting(containerEl)
        .setName("Week starts on")
        .setDesc("Which day to consider as the start of the week")
        .addDropdown((dropdown) => {
          dropdown.addOption(
            "locale-default",
            `Locale default (${localeWeekStart})`
          );
          localizedWeekdays.forEach((day, i) => {
            dropdown.addOption(DAYS_OF_WEEK[i], day);
          });
          dropdown.setValue(this.plugin.settings.weekStart.toLowerCase());
          dropdown.onChange(async (value: DayOfWeek) => {
            this.plugin.settings.weekStart = value;
            await this.plugin.saveSettings();
          });
        }),

      new Setting(containerEl)
        .setName("Time format")
        .setDesc("Output format for time expressions (e.g., time:now)")
        .addMomentFormat((text) =>
          text
            .setDefaultFormat("HH:mm")
            .setValue(this.plugin.settings.timeFormat)
            .onChange(async (value) => {
              this.plugin.settings.timeFormat = value || "HH:mm";
              await this.plugin.saveSettings();
            })
        )
    );

    this.setSectionSettingsDisabled(
      dateSectionSettings,
      !this.plugin.settings.enableDates
    );

    // --- Section 3: Templates (Templater) ---
    containerEl.createEl("h3", {
      text: "Templates (Templater)",
    });

    const templateSectionSettings: Setting[] = [];

    new Setting(containerEl)
      .setName("Enable template suggestions")
      .setDesc("Suggest and insert available templates inline at the cursor")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableTemplates)
          .onChange(async (value) => {
            this.plugin.settings.enableTemplates = value;
            this.setSectionSettingsDisabled(templateSectionSettings, !value);
            await this.plugin.saveSettings();
          })
      );

    templateSectionSettings.push(
      new Setting(containerEl)
        .setName("Template engine")
        .setDesc("How templates should be discovered and executed when selected")
        .addDropdown((dropdown) =>
          dropdown
            .addOption(
              "auto",
              "Auto-detect (Templater, fallback to Core Templates)"
            )
            .addOption("templater", "Templater only")
            .addOption("core-templates", "Core Templates only")
            .setValue(this.plugin.settings.templateEngine)
            .onChange(async (value: TemplateEngineMode) => {
              this.plugin.settings.templateEngine = value;
              await this.plugin.saveSettings();
            })
        ),

      new Setting(containerEl)
        .setName("Template folder override")
        .setDesc(
          "Optional folder path for templates. Leave empty to automatically use Templater's configured template folder."
        )
        .addText((text) =>
          text
            .setPlaceholder("e.g. Templates")
            .setValue(this.plugin.settings.customTemplateFolder)
            .onChange(async (value) => {
              this.plugin.settings.customTemplateFolder = value.trim();
              await this.plugin.saveSettings();
            })
        )
    );

    this.setSectionSettingsDisabled(
      templateSectionSettings,
      !this.plugin.settings.enableTemplates
    );

    // --- Section 4: Files & Links ---
    containerEl.createEl("h3", {
      text: "Files & Links",
    });

    const fileSectionSettings: Setting[] = [];

    new Setting(containerEl)
      .setName("Enable file suggestions")
      .setDesc("Suggest vault files and insert them as [[wikilinks]]")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFiles)
          .onChange(async (value) => {
            this.plugin.settings.enableFiles = value;
            this.setSectionSettingsDisabled(fileSectionSettings, !value);
            await this.plugin.saveSettings();
          })
      );

    fileSectionSettings.push(
      new Setting(containerEl)
        .setName("Include frontmatter aliases")
        .setDesc("Match against YAML frontmatter aliases when searching for files")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.includeFileAliases)
            .onChange(async (value) => {
              this.plugin.settings.includeFileAliases = value;
              await this.plugin.saveSettings();
            })
        ),

      new Setting(containerEl)
        .setName("Exclude template folder from file suggestions")
        .setDesc(
          "Prevent files inside the template folder from appearing twice (as both a Template and a File link)"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.excludeTemplatesFromFiles)
            .onChange(async (value) => {
              this.plugin.settings.excludeTemplatesFromFiles = value;
              await this.plugin.saveSettings();
            })
        )
    );

    this.setSectionSettingsDisabled(
      fileSectionSettings,
      !this.plugin.settings.enableFiles
    );
  }
}
