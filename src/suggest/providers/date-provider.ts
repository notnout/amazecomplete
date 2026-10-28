import { Editor, EditorPosition } from "obsidian";
import type AmazeCompletePlugin from "../../main";
import { generateMarkdownLink } from "../../utils";
import { DateSuggestion } from "../types";

export class DateSuggestionProvider {
  private plugin: AmazeCompletePlugin;

  constructor(plugin: AmazeCompletePlugin) {
    this.plugin = plugin;
  }

  getSuggestions(query: string): DateSuggestion[] {
    if (!this.plugin.settings.enableDates) {
      return [];
    }

    const trimmedQuery = query.trim();
    const lowerQuery = query.toLowerCase();
    const candidateLabels = this.getPresetLabels(query);
    const results: DateSuggestion[] = [];
    const seenLabels = new Set<string>();

    for (let i = 0; i < candidateLabels.length; i++) {
      const label = candidateLabels[i];
      const suggestion = this.buildDateSuggestion(label, lowerQuery, 100 - i);
      if (suggestion) {
        results.push(suggestion);
        seenLabels.add(label.toLowerCase());
      }
    }

    if (trimmedQuery.length > 0 && !seenLabels.has(trimmedQuery.toLowerCase())) {
      const dynamicSuggestion = this.buildDateSuggestion(
        trimmedQuery,
        lowerQuery,
        55
      );
      if (dynamicSuggestion) {
        results.push(dynamicSuggestion);
      }
    }

    return results;
  }

  private getPresetLabels(query: string): string[] {
    const lowerQuery = query.toLowerCase();

    if (/^time/i.test(query)) {
      return ["now", "+15 minutes", "+1 hour", "-15 minutes", "-1 hour"]
        .map((val) => `time:${val}`)
        .filter((label) => label.toLowerCase().startsWith(lowerQuery));
    }

    const refMatch = query.match(/^(next|last|this)\b/i);
    if (refMatch) {
      const reference = refMatch[1];
      return [
        "week",
        "month",
        "year",
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ]
        .map((val) => `${reference} ${val}`)
        .filter((label) => label.toLowerCase().startsWith(lowerQuery));
    }

    const relativeDate =
      query.match(/^in ([+-]?\d+)/i) || query.match(/^([+-]?\d+)/i);
    if (relativeDate) {
      const timeDelta = relativeDate[1];
      return [
        `in ${timeDelta} minutes`,
        `in ${timeDelta} hours`,
        `in ${timeDelta} days`,
        `in ${timeDelta} weeks`,
        `in ${timeDelta} months`,
        `${timeDelta} days ago`,
        `${timeDelta} weeks ago`,
        `${timeDelta} months ago`,
      ].filter((label) => label.toLowerCase().startsWith(lowerQuery));
    }

    return ["Today", "Yesterday", "Tomorrow"].filter((label) =>
      label.toLowerCase().startsWith(lowerQuery)
    );
  }

  private buildDateSuggestion(
    label: string,
    lowerQuery: string,
    baseScore: number
  ): DateSuggestion | null {
    const isTime = label.toLowerCase().startsWith("time:");
    const parsed = isTime
      ? this.plugin.parseTime(label.substring(5) || "now")
      : this.plugin.parseDate(label);

    if (!parsed.moment.isValid()) {
      return null;
    }

    const lowerLabel = label.toLowerCase();
    let score = baseScore;
    if (lowerQuery.length > 0) {
      if (lowerLabel === lowerQuery) {
        score += 50;
      } else if (lowerLabel.startsWith(lowerQuery)) {
        score += 30;
      }
    }

    return {
      category: "date",
      label,
      subLabel: parsed.formattedString,
      formattedValue: parsed.formattedString,
      isTime,
      score,
    };
  }

  selectSuggestion(
    suggestion: DateSuggestion,
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    includeAlias: boolean
  ): void {
    const makeIntoLink =
      !suggestion.isTime && this.plugin.settings.autosuggestToggleLink;

    const output = makeIntoLink
      ? generateMarkdownLink(
          this.plugin.app,
          suggestion.formattedValue,
          includeAlias ? suggestion.label : undefined
        )
      : suggestion.formattedValue;

    editor.replaceRange(output, start, end);
  }
}
