import {
  App,
  PluginSettingTab,
  requireApiVersion,
  Setting,
  SettingDefinitionItem,
} from "obsidian";
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

  // Natural language dates settings
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

  getSettingDefinitions(): SettingDefinitionItem<keyof AmazeSettings>[] {
    const localizedWeekdays = window.moment.weekdays();
    const localeWeekStart = getLocaleWeekStart();
    const weekdayOptions: Record<string, string> = {
      "locale-default": `Locale default (${localeWeekStart})`,
    };
    localizedWeekdays.forEach((day, i) => {
      weekdayOptions[DAYS_OF_WEEK[i]] = day;
    });

    return [
      {
        type: "group",
        heading: "Autosuggest trigger",
        items: [
          {
            name: "Enable autosuggest",
            desc: "Open the unified autocomplete menu (dates, templates, files) with trigger phrase",
            control: {
              type: "toggle",
              key: "isAutosuggestEnabled",
              defaultValue: DEFAULT_SETTINGS.isAutosuggestEnabled,
            },
          },
          {
            name: "Trigger phrase",
            desc: "Character(s) that will cause the autosuggest menu to open",
            control: {
              type: "text",
              key: "autocompleteTriggerPhrase",
              placeholder: DEFAULT_SETTINGS.autocompleteTriggerPhrase,
              defaultValue: DEFAULT_SETTINGS.autocompleteTriggerPhrase,
              disabled: () => !this.plugin.settings.isAutosuggestEnabled,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Natural language dates",
        items: [
          {
            name: "Enable date suggestions",
            desc: "Suggest natural language dates (e.g., today, tomorrow)",
            control: {
              type: "toggle",
              key: "enableDates",
              defaultValue: DEFAULT_SETTINGS.enableDates,
            },
          },
          {
            name: "Add dates as link?",
            desc: "If enabled, dates created via autosuggest will be wrapped in [[wikilinks]]",
            control: {
              type: "toggle",
              key: "autosuggestToggleLink",
              defaultValue: DEFAULT_SETTINGS.autosuggestToggleLink,
              disabled: () => !this.plugin.settings.enableDates,
            },
          },
          {
            name: "Date format",
            desc: "Output format for parsed dates",
            control: {
              type: "text",
              key: "format",
              placeholder: DEFAULT_SETTINGS.format,
              defaultValue: DEFAULT_SETTINGS.format,
              disabled: () => !this.plugin.settings.enableDates,
            },
          },
          {
            name: "Week starts on",
            desc: "Which day to consider as the start of the week",
            control: {
              type: "dropdown",
              key: "weekStart",
              options: weekdayOptions,
              defaultValue: DEFAULT_SETTINGS.weekStart,
              disabled: () => !this.plugin.settings.enableDates,
            },
          },
          {
            name: "Time format",
            desc: "Output format for time expressions (e.g., time:now)",
            control: {
              type: "text",
              key: "timeFormat",
              placeholder: DEFAULT_SETTINGS.timeFormat,
              defaultValue: DEFAULT_SETTINGS.timeFormat,
              disabled: () => !this.plugin.settings.enableDates,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Templates",
        items: [
          {
            name: "Enable template suggestions",
            desc: "Suggest and insert available templates inline",
            control: {
              type: "toggle",
              key: "enableTemplates",
              defaultValue: DEFAULT_SETTINGS.enableTemplates,
            },
          },
          {
            name: "Template engine",
            desc: "How templates should be discovered and executed when selected",
            control: {
              type: "dropdown",
              key: "templateEngine",
              options: {
                auto: "Templater (fallback to core templates)",
                templater: "Templater only",
                "core-templates": "Core templates only",
              },
              defaultValue: DEFAULT_SETTINGS.templateEngine,
              disabled: () => !this.plugin.settings.enableTemplates,
            },
          },
          {
            name: "Template folder override",
            desc: "Optional folder path for templates. Leave empty to use the configured template folder automatically.",
            control: {
              type: "text",
              key: "customTemplateFolder",
              placeholder: "Templates",
              defaultValue: DEFAULT_SETTINGS.customTemplateFolder,
              disabled: () => !this.plugin.settings.enableTemplates,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Files & links",
        items: [
          {
            name: "Enable file suggestions",
            desc: "Suggest vault files and insert them as [[wikilinks]]",
            control: {
              type: "toggle",
              key: "enableFiles",
              defaultValue: DEFAULT_SETTINGS.enableFiles,
            },
          },
          {
            name: "Include frontmatter aliases",
            desc: "Match against YAML frontmatter aliases when searching for files",
            control: {
              type: "toggle",
              key: "includeFileAliases",
              defaultValue: DEFAULT_SETTINGS.includeFileAliases,
              disabled: () => !this.plugin.settings.enableFiles,
            },
          },
          {
            name: "Exclude template folder from file suggestions",
            desc: "Prevent files inside the template folder from appearing twice (as both a template and a file link)",
            control: {
              type: "toggle",
              key: "excludeTemplatesFromFiles",
              defaultValue: DEFAULT_SETTINGS.excludeTemplatesFromFiles,
              disabled: () => !this.plugin.settings.enableFiles,
            },
          },
        ],
      },
    ];
  }

  getControlValue<K extends keyof AmazeSettings>(key: K): AmazeSettings[K] {
    return this.plugin.settings[key];
  }

  async setControlValue<K extends keyof AmazeSettings>(
    key: K,
    value: AmazeSettings[K]
  ): Promise<void> {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
    if (requireApiVersion("1.13.0")) {
      this.refreshDomState();
    }
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
    new Setting(containerEl).setName("Autosuggest trigger").setHeading();

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

    // --- Section 2: Natural language dates ---
    new Setting(containerEl).setName("Natural language dates").setHeading();

    const dateSectionSettings: Setting[] = [];

    new Setting(containerEl)
      .setName("Enable date suggestions")
      .setDesc("Suggest natural language dates (e.g., today, tomorrow)")
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

    // --- Section 3: Templates ---
    new Setting(containerEl).setName("Templates").setHeading();

    const templateSectionSettings: Setting[] = [];

    new Setting(containerEl)
      .setName("Enable template suggestions")
      .setDesc("Suggest and insert available templates inline")
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
              "Templater (fallback to core templates)"
            )
            .addOption("templater", "Templater only")
            .addOption("core-templates", "Core templates only")
            .setValue(this.plugin.settings.templateEngine)
            .onChange(async (value: TemplateEngineMode) => {
              this.plugin.settings.templateEngine = value;
              await this.plugin.saveSettings();
            })
        ),

      new Setting(containerEl)
        .setName("Template folder override")
        .setDesc(
          "Optional folder path for templates. Leave empty to use the configured template folder automatically."
        )
        .addText((text) =>
          text
            .setPlaceholder("Templates")
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

    // --- Section 4: Files & links ---
    new Setting(containerEl).setName("Files & links").setHeading();

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
          "Prevent files inside the template folder from appearing twice (as both a template and a file link)"
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
