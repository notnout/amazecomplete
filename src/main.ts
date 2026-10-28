import { MarkdownView, ObsidianProtocolData, Plugin } from "obsidian";

import DatePickerModal from "./modals/date-picker";
import NLDParser, { NLDResult } from "./parser";
import { AmazeSettingsTab, AmazeSettings, DEFAULT_SETTINGS } from "./settings";
import AmazeSuggest from "./suggest/amaze-suggest";
import {
  getParseCommand,
  getCurrentDateCommand,
  getCurrentTimeCommand,
  getNowCommand,
} from "./commands";
import { getFormattedDate, getOrCreateDailyNote, parseTruthy } from "./utils";

export default class AmazeCompletePlugin extends Plugin {
  private parser: NLDParser;
  public settings: AmazeSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize parser immediately and re-initialize on layout ready to ensure correct Moment locale
    this.parser = new NLDParser();

    this.addCommand({
      id: "nlp-dates",
      name: "Parse natural language date",
      callback: () => getParseCommand(this, "replace"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-dates-link",
      name: "Parse natural language date (as link)",
      callback: () => getParseCommand(this, "link"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-date-clean",
      name: "Parse natural language date (as plain text)",
      callback: () => getParseCommand(this, "clean"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-parse-time",
      name: "Parse natural language time",
      callback: () => getParseCommand(this, "time"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-now",
      name: "Insert the current date and time",
      callback: () => getNowCommand(this),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-today",
      name: "Insert the current date",
      callback: () => getCurrentDateCommand(this),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-time",
      name: "Insert the current time",
      callback: () => getCurrentTimeCommand(this),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-picker",
      name: "Date picker",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        }
        new DatePickerModal(this.app, this).open();
      },
      hotkeys: [],
    });

    this.addSettingTab(new AmazeSettingsTab(this.app, this));
    this.registerObsidianProtocolHandler("nldates", this.actionHandler.bind(this));
    this.registerEditorSuggest(new AmazeSuggest(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.parser = new NLDParser();
    });
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  parse(dateString: string, format: string): NLDResult {
    if (!this.parser) {
      this.parser = new NLDParser();
    }
    const date = this.parser.getParsedDate(
      dateString,
      this.settings.weekStart
    );
    const momentObj = date ? window.moment(date) : window.moment.invalid();
    const formattedString = momentObj.isValid()
      ? getFormattedDate(date, format)
      : "Invalid date";

    if (formattedString === "Invalid date") {
      console.debug("Input date " + dateString + " can't be parsed by AmazeComplete");
    }

    return {
      formattedString,
      date,
      moment: momentObj,
    };
  }

  parseDate(dateString: string): NLDResult {
    return this.parse(dateString, this.settings.format);
  }

  parseTime(dateString: string): NLDResult {
    return this.parse(dateString, this.settings.timeFormat);
  }

  async actionHandler(params: ObsidianProtocolData): Promise<void> {
    const { workspace } = this.app;

    const date = this.parseDate(params.day);
    const newPane = parseTruthy(params.newPane || "yes");

    if (date.moment.isValid()) {
      const dailyNote = await getOrCreateDailyNote(date.moment);
      if (dailyNote) {
        workspace.getLeaf(newPane).openFile(dailyNote);
      }
    }
  }
}
