import { Editor, EditorPosition, prepareFuzzySearch, TFile } from "obsidian";
import type AmazeCompletePlugin from "../../main";
import {
  generateMarkdownLink,
  isFileInFolder,
  scoreFuzzyMatch,
} from "../../utils";
import { FileSuggestion } from "../types";
import { TemplateSuggestionProvider } from "./template-provider";

const MAX_FILE_SUGGESTIONS = 10;

export class FileSuggestionProvider {
  private plugin: AmazeCompletePlugin;
  private templateProvider: TemplateSuggestionProvider;

  constructor(
    plugin: AmazeCompletePlugin,
    templateProvider: TemplateSuggestionProvider
  ) {
    this.plugin = plugin;
    this.templateProvider = templateProvider;
  }

  getSuggestions(query: string): FileSuggestion[] {
    if (!this.plugin.settings.enableFiles) {
      return [];
    }

    const { app, settings } = this.plugin;
    const templateFolder =
      settings.enableTemplates && settings.excludeTemplatesFromFiles
        ? this.templateProvider.getTemplateFolderPath()
        : null;

    const candidateFiles = app.vault
      .getMarkdownFiles()
      .filter((file) => !isFileInFolder(file, templateFolder));

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return candidateFiles
        .slice()
        .sort((a, b) => b.stat.mtime - a.stat.mtime)
        .slice(0, MAX_FILE_SUGGESTIONS)
        .map((file, idx) => ({
          category: "file",
          label: file.basename,
          subLabel:
            file.parent?.path && file.parent.path !== "/"
              ? file.parent.path
              : "",
          file,
          score: 60 - idx,
        }));
    }

    const lowerQuery = trimmedQuery.toLowerCase();
    const fuzzy = prepareFuzzySearch(lowerQuery);
    const matched: FileSuggestion[] = [];

    for (const file of candidateFiles) {
      const basenameMatch = fuzzy(file.basename);
      let bestScore = basenameMatch
        ? scoreFuzzyMatch(file.basename, lowerQuery, basenameMatch.score, 85)
        : -Infinity;
      let matchedAlias: string | undefined;

      if (settings.includeFileAliases) {
        for (const alias of this.getFileAliases(file)) {
          const aliasMatch = fuzzy(alias);
          if (aliasMatch) {
            const aliasScore = scoreFuzzyMatch(
              alias,
              lowerQuery,
              aliasMatch.score,
              82
            );
            if (aliasScore > bestScore) {
              bestScore = aliasScore;
              matchedAlias = alias;
            }
          }
        }
      }

      if (bestScore > -Infinity) {
        matched.push({
          category: "file",
          label: matchedAlias
            ? `${matchedAlias} (${file.basename})`
            : file.basename,
          subLabel:
            file.parent?.path && file.parent.path !== "/"
              ? file.parent.path
              : "",
          file,
          alias: matchedAlias,
          score: bestScore,
        });
      }
    }

    return matched
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, MAX_FILE_SUGGESTIONS);
  }

  private getFileAliases(file: TFile): string[] {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const rawAliases =
      cache?.frontmatter?.aliases ?? cache?.frontmatter?.alias;
    if (Array.isArray(rawAliases)) {
      return rawAliases
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim());
    }
    if (typeof rawAliases === "string" && rawAliases.trim().length > 0) {
      return [rawAliases.trim()];
    }
    return [];
  }

  selectSuggestion(
    suggestion: FileSuggestion,
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    sourcePath: string,
    includeAlias: boolean
  ): void {
    const { app } = this.plugin;
    const aliasToUse =
      suggestion.alias || (includeAlias ? suggestion.file.basename : undefined);

    const linkStr = app.fileManager?.generateMarkdownLink
      ? app.fileManager.generateMarkdownLink(
          suggestion.file,
          sourcePath,
          undefined,
          aliasToUse
        )
      : generateMarkdownLink(app, suggestion.file.basename, aliasToUse);

    editor.replaceRange(linkStr, start, end);
  }
}
