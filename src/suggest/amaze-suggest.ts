import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  setIcon,
  TFile,
} from "obsidian";
import type AmazeCompletePlugin from "../main";
import { DateSuggestionProvider } from "./providers/date-provider";
import { FileSuggestionProvider } from "./providers/file-provider";
import { TemplateSuggestionProvider } from "./providers/template-provider";
import { AmazeSuggestion, SuggestionCategory } from "./types";

interface SuggestWithInternal {
  suggestions?: {
    useSelectedItem?: (evt: KeyboardEvent) => void;
  };
}

const CATEGORY_ICON: Record<SuggestionCategory, string> = {
  date: "calendar",
  template: "layout-template",
  file: "file-text",
};

const CATEGORY_BADGE: Record<SuggestionCategory, string> = {
  date: "Date",
  template: "Template",
  file: "File",
};

const CATEGORY_PRIORITY: Record<SuggestionCategory, number> = {
  date: 3,
  template: 2,
  file: 1,
};

export default class AmazeSuggest extends EditorSuggest<AmazeSuggestion> {
  app: App;
  private plugin: AmazeCompletePlugin;
  private dateProvider: DateSuggestionProvider;
  private templateProvider: TemplateSuggestionProvider;
  private fileProvider: FileSuggestionProvider;

  constructor(app: App, plugin: AmazeCompletePlugin) {
    super(app);
    this.app = app;
    this.plugin = plugin;

    this.dateProvider = new DateSuggestionProvider(plugin);
    this.templateProvider = new TemplateSuggestionProvider(plugin);
    this.fileProvider = new FileSuggestionProvider(
      plugin,
      this.templateProvider
    );

    this.scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
      (this as unknown as SuggestWithInternal).suggestions?.useSelectedItem?.(
        evt
      );
      return false;
    });

    this.setInstructions([
      { command: "Enter", purpose: "Insert" },
      { command: "Shift + Enter", purpose: "Keep text as alias / link" },
    ]);
  }

  getSuggestions(context: EditorSuggestContext): AmazeSuggestion[] {
    const query = context.query;

    const combined: AmazeSuggestion[] = [
      ...this.dateProvider.getSuggestions(query),
      ...this.templateProvider.getSuggestions(query),
      ...this.fileProvider.getSuggestions(query),
    ];

    if (combined.length > 0) {
      return combined.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (CATEGORY_PRIORITY[b.category] !== CATEGORY_PRIORITY[a.category]) {
          return CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category];
        }
        return a.label.localeCompare(b.label);
      });
    }

    if (this.plugin.settings.enableDates && query.trim().length > 0) {
      const parsed = this.plugin.parseDate(query);
      return [
        {
          category: "date",
          label: query,
          subLabel: parsed.moment.isValid() ? parsed.formattedString : "",
          formattedValue: parsed.formattedString,
          isTime: false,
          score: 1,
        },
      ];
    }

    return [];
  }

  renderSuggestion(suggestion: AmazeSuggestion, el: HTMLElement): void {
    el.empty();
    const container = el.createDiv({ cls: "amaze-suggest-item" });
    const mainEl = container.createDiv({ cls: "amaze-suggest-main" });

    const iconEl = mainEl.createSpan({ cls: "amaze-suggest-icon" });
    setIcon(iconEl, CATEGORY_ICON[suggestion.category]);

    mainEl.createSpan({
      cls: `amaze-suggest-badge amaze-badge-${suggestion.category}`,
      text: CATEGORY_BADGE[suggestion.category],
    });

    mainEl.createSpan({
      cls: "amaze-suggest-label",
      text: suggestion.label,
    });

    if (suggestion.subLabel) {
      container.createDiv({
        cls: "amaze-suggest-aux",
        text: suggestion.subLabel,
      });
    }
  }

  selectSuggestion(
    suggestion: AmazeSuggestion,
    event: KeyboardEvent | MouseEvent
  ): void {
    if (!this.context) {
      return;
    }

    const { editor, start, end, file } = this.context;
    const isShiftHeld = Boolean(event.shiftKey);

    switch (suggestion.category) {
      case "date":
        this.dateProvider.selectSuggestion(
          suggestion,
          editor,
          start,
          end,
          isShiftHeld
        );
        break;

      case "template":
        void this.templateProvider.selectSuggestion(
          suggestion,
          editor,
          start,
          end,
          isShiftHeld
        );
        break;

      case "file":
        this.fileProvider.selectSuggestion(
          suggestion,
          editor,
          start,
          end,
          file?.path ?? "",
          isShiftHeld
        );
        break;
    }
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile
  ): EditorSuggestTriggerInfo | null {
    if (!this.plugin.settings.isAutosuggestEnabled) {
      return null;
    }

    const triggerPhrase = this.plugin.settings.autocompleteTriggerPhrase;
    if (!triggerPhrase) {
      return null;
    }

    const startPos = this.context?.start || {
      line: cursor.line,
      ch: cursor.ch - triggerPhrase.length,
    };

    if (startPos.ch < 0) {
      return null;
    }

    if (!editor.getRange(startPos, cursor).startsWith(triggerPhrase)) {
      return null;
    }

    const precedingChar =
      startPos.ch > 0
        ? editor.getRange(
            {
              line: startPos.line,
              ch: startPos.ch - 1,
            },
            startPos
          )
        : "";

    if (precedingChar && /[`a-zA-Z0-9]/.test(precedingChar)) {
      return null;
    }

    return {
      start: startPos,
      end: cursor,
      query: editor.getRange(startPos, cursor).substring(triggerPhrase.length),
    };
  }
}
