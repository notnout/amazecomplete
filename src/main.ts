import { Plugin } from "obsidian";

import NLDParser, { NLDResult } from "./parser";
import { AmazeSettingsTab, AmazeSettings, DEFAULT_SETTINGS } from "./settings";
import AmazeSuggest from "./suggest/amaze-suggest";
import { getFormattedDate } from "./utils";

export default class AmazeCompletePlugin extends Plugin {
  private parser: NLDParser;
  public settings: AmazeSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.parser = new NLDParser();
    this.addSettingTab(new AmazeSettingsTab(this.app, this));
    this.registerEditorSuggest(new AmazeSuggest(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.parser = new NLDParser();
    });
  }

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
}
