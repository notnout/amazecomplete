import {
  Editor,
  EditorPosition,
  normalizePath,
  prepareFuzzySearch,
  TFile,
} from "obsidian";
import type AmazeCompletePlugin from "../../main";
import { generateMarkdownLink } from "../../utils";
import { FileSuggestion } from "../types";
import { TemplateSuggestionProvider } from "./template-provider";

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
    const allFiles = app.vault.getMarkdownFiles();
    const templateFolder =
      settings.enableTemplates && settings.excludeTemplatesFromFiles
        ? this.templateProvider.getTemplateFolderPath()
        : null;
    const templatePrefix =
      templateFolder && templateFolder !== "/" ? `${templateFolder}/` : null;

    const excludedPrefixes = (settings.excludedFolders || [])
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => `${normalizePath(f)}/`);

    const candidateFiles = allFiles.filter((file) => {
      if (
        templatePrefix &&
        (file.path === templateFolder || file.path.startsWith(templatePrefix))
      ) {
        return false;
      }
      for (const prefix of excludedPrefixes) {
        if (file.path.startsWith(prefix)) {
          return false;
        }
      }
      return true;
    });

    const trimmedQuery = query.trim();
    const maxResults = settings.maxFileSuggestions || 10;

    if (!trimmedQuery) {
      return candidateFiles
        .slice()
        .sort((a, b) => b.stat.mtime - a.stat.mtime)
        .slice(0, maxResults)
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
      let bestScore = -Infinity;
      let matchedAlias: string | undefined;
      let bestMatch = basenameMatch ?? undefined;

      if (basenameMatch) {
        const lowerName = file.basename.toLowerCase();
        bestScore = 85 + basenameMatch.score * 20;
        if (lowerName === lowerQuery) {
          bestScore += 60;
        } else if (lowerName.startsWith(lowerQuery)) {
          bestScore += 35;
        }
      }

      if (settings.includeFileAliases) {
        const aliases = this.getFileAliases(file);
        for (const alias of aliases) {
          const aliasMatch = fuzzy(alias);
          if (aliasMatch) {
            const lowerAlias = alias.toLowerCase();
            let aliasScore = 82 + aliasMatch.score * 20;
            if (lowerAlias === lowerQuery) {
              aliasScore += 55;
            } else if (lowerAlias.startsWith(lowerQuery)) {
              aliasScore += 30;
            }

            if (aliasScore > bestScore) {
              bestScore = aliasScore;
              matchedAlias = alias;
              bestMatch = aliasMatch;
            }
          }
        }
      }

      if (bestScore > -Infinity) {
        const folderLabel =
          file.parent?.path && file.parent.path !== "/"
            ? file.parent.path
            : "";

        matched.push({
          category: "file",
          label: matchedAlias
            ? `${matchedAlias} (${file.basename})`
            : file.basename,
          subLabel: folderLabel,
          file,
          alias: matchedAlias,
          match: bestMatch,
          score: bestScore,
        });
      }
    }

    return matched
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, maxResults);
  }

  private getFileAliases(file: TFile): string[] {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const rawAliases =
      cache?.frontmatter?.aliases ?? cache?.frontmatter?.alias;
    if (!rawAliases) {
      return [];
    }
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

    let linkStr: string;
    if (app.fileManager?.generateMarkdownLink) {
      linkStr = app.fileManager.generateMarkdownLink(
        suggestion.file,
        sourcePath,
        undefined,
        aliasToUse
      );
    } else {
      linkStr = generateMarkdownLink(
        app,
        suggestion.file.basename,
        aliasToUse
      );
    }

    editor.replaceRange(linkStr, start, end);
  }
}
