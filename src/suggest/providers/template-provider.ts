import {
  Editor,
  EditorPosition,
  Notice,
  normalizePath,
  prepareFuzzySearch,
  TFile,
} from "obsidian";
import type AmazeCompletePlugin from "../../main";
import { generateMarkdownLink } from "../../utils";
import { TemplateSuggestion } from "../types";

export class TemplateSuggestionProvider {
  private plugin: AmazeCompletePlugin;

  constructor(plugin: AmazeCompletePlugin) {
    this.plugin = plugin;
  }

  /**
   * Resolves the active template folder path from plugin settings,
   * Templater settings, or Obsidian's core Templates plugin.
   */
  getTemplateFolderPath(): string | null {
    const { settings, app } = this.plugin;

    if (settings.customTemplateFolder?.trim()) {
      return normalizePath(settings.customTemplateFolder.trim());
    }

    const mode = settings.templateEngine;

    if (mode === "auto" || mode === "templater") {
      const templaterPlugin = (app as any).plugins?.plugins?.[
        "templater-obsidian"
      ];
      const templaterFolder = templaterPlugin?.settings?.templates_folder;
      if (templaterFolder && typeof templaterFolder === "string") {
        return normalizePath(templaterFolder.trim());
      }
      if (mode === "templater") {
        return null;
      }
    }

    if (mode === "auto" || mode === "core-templates") {
      const coreTemplates = (app as any).internalPlugins?.plugins?.[
        "templates"
      ];
      const coreFolder = coreTemplates?.instance?.options?.folder;
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

    const prefix = folderPath === "/" ? "" : `${folderPath}/`;
    return this.plugin.app.vault
      .getMarkdownFiles()
      .filter(
        (file) => file.path === folderPath || file.path.startsWith(prefix)
      );
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
    const maxResults = this.plugin.settings.maxTemplateSuggestions || 10;

    if (!trimmedQuery) {
      return templateFiles
        .slice()
        .sort((a, b) => a.basename.localeCompare(b.basename))
        .slice(0, maxResults)
        .map((file, idx) => ({
          category: "template",
          label: file.basename,
          subLabel: file.parent?.path && file.parent.path !== "/" ? file.parent.path : "Template",
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

      const lowerName = file.basename.toLowerCase();
      let score = 90 + match.score * 20;
      if (lowerName === lowerQuery) {
        score += 60;
      } else if (lowerName.startsWith(lowerQuery)) {
        score += 35;
      }

      matched.push({
        category: "template",
        label: file.basename,
        subLabel:
          file.parent?.path && file.parent.path !== "/"
            ? file.parent.path
            : "Template",
        file,
        match,
        score,
      });
    }

    return matched
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, maxResults);
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

    // Remove the trigger and query text (e.g., "@Book") before inserting the template
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

      // Fallback: Read raw markdown content and insert at cursor
      const rawContent = await app.vault.cachedRead(suggestion.file);
      editor.replaceRange(rawContent, start);
    } catch (err) {
      console.error("AmazeComplete failed to insert template:", err);
      new Notice(`Failed to insert template "${suggestion.label}".`);
    }
  }
}
