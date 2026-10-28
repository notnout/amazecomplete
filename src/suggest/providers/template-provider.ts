import {
  Editor,
  EditorPosition,
  Notice,
  normalizePath,
  prepareFuzzySearch,
  TFile,
} from "obsidian";
import type AmazeCompletePlugin from "../../main";
import {
  generateMarkdownLink,
  isFileInFolder,
  scoreFuzzyMatch,
} from "../../utils";
import { TemplateSuggestion } from "../types";

const MAX_TEMPLATE_SUGGESTIONS = 10;

export class TemplateSuggestionProvider {
  private plugin: AmazeCompletePlugin;

  constructor(plugin: AmazeCompletePlugin) {
    this.plugin = plugin;
  }

  getTemplateFolderPath(): string | null {
    const { settings, app } = this.plugin;

    if (settings.customTemplateFolder?.trim()) {
      return normalizePath(settings.customTemplateFolder.trim());
    }

    const mode = settings.templateEngine;

    if (mode === "auto" || mode === "templater") {
      const templaterFolder = (app as any).plugins?.plugins?.[
        "templater-obsidian"
      ]?.settings?.templates_folder;
      if (templaterFolder && typeof templaterFolder === "string") {
        return normalizePath(templaterFolder.trim());
      }
      if (mode === "templater") {
        return null;
      }
    }

    if (mode === "auto" || mode === "core-templates") {
      const coreFolder = (app as any).internalPlugins?.plugins?.["templates"]
        ?.instance?.options?.folder;
      if (coreFolder && typeof coreFolder === "string") {
        return normalizePath(coreFolder.trim());
      }
    }

    return null;
  }

  getTemplateFiles(): TFile[] {
    const folderPath = this.getTemplateFolderPath();
    if (!folderPath) {
      return [];
    }

    return this.plugin.app.vault
      .getMarkdownFiles()
      .filter((file) => isFileInFolder(file, folderPath));
  }

  getSuggestions(query: string): TemplateSuggestion[] {
    if (!this.plugin.settings.enableTemplates) {
      return [];
    }

    const templateFiles = this.getTemplateFiles();
    if (templateFiles.length === 0) {
      return [];
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return templateFiles
        .slice()
        .sort((a, b) => a.basename.localeCompare(b.basename))
        .slice(0, MAX_TEMPLATE_SUGGESTIONS)
        .map((file, idx) => ({
          category: "template",
          label: file.basename,
          subLabel:
            file.parent?.path && file.parent.path !== "/"
              ? file.parent.path
              : "Template",
          file,
          score: 80 - idx,
        }));
    }

    const lowerQuery = trimmedQuery.toLowerCase();
    const fuzzy = prepareFuzzySearch(lowerQuery);
    const matched: TemplateSuggestion[] = [];

    for (const file of templateFiles) {
      const match = fuzzy(file.basename);
      if (!match) {
        continue;
      }

      matched.push({
        category: "template",
        label: file.basename,
        subLabel:
          file.parent?.path && file.parent.path !== "/"
            ? file.parent.path
            : "Template",
        file,
        score: scoreFuzzyMatch(file.basename, lowerQuery, match.score, 90),
      });
    }

    return matched
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, MAX_TEMPLATE_SUGGESTIONS);
  }

  async selectSuggestion(
    suggestion: TemplateSuggestion,
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    insertAsLinkOnly: boolean
  ): Promise<void> {
    if (insertAsLinkOnly) {
      const linkText = generateMarkdownLink(
        this.plugin.app,
        suggestion.file.basename
      );
      editor.replaceRange(linkText, start, end);
      return;
    }

    editor.replaceRange("", start, end);
    editor.setCursor(start);

    const { app, settings } = this.plugin;
    const mode = settings.templateEngine;

    try {
      if (mode === "auto" || mode === "templater") {
        const templaterPlugin = (app as any).plugins?.plugins?.[
          "templater-obsidian"
        ];
        if (templaterPlugin?.templater?.append_template_to_active_file) {
          await templaterPlugin.templater.append_template_to_active_file(
            suggestion.file
          );
          return;
        }
        if (mode === "templater") {
          new Notice(
            "AmazeComplete: Templater plugin is not enabled or available."
          );
          return;
        }
      }

      if (mode === "auto" || mode === "core-templates") {
        const coreTemplates = (app as any).internalPlugins?.plugins?.[
          "templates"
        ];
        if (coreTemplates?.enabled && coreTemplates?.instance?.insertTemplate) {
          await coreTemplates.instance.insertTemplate(suggestion.file);
          return;
        }
      }

      const rawContent = await app.vault.cachedRead(suggestion.file);
      editor.replaceRange(rawContent, start);
    } catch (err) {
      console.error("AmazeComplete failed to insert template:", err);
      new Notice(`Failed to insert template "${suggestion.label}".`);
    }
  }
}
