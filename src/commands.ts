import { MarkdownView } from "obsidian";
import { adjustCursor, getSelectedText } from "./utils";
import AmazeCompletePlugin from "./main";

export function getParseCommand(
  plugin: AmazeCompletePlugin,
  mode: string
): void {
  const { workspace } = plugin.app;
  const activeView = workspace.getActiveViewOfType(MarkdownView);

  if (!activeView) {
    return;
  }

  const editor = activeView.editor;
  const cursor = editor.getCursor();
  const selectedText = getSelectedText(editor);

  const date = plugin.parseDate(selectedText);

  if (!date.moment.isValid()) {
    editor.setCursor({
      line: cursor.line,
      ch: cursor.ch,
    });
    return;
  }

  let newStr = `[[${date.formattedString}]]`;

  if (mode === "link") {
    newStr = `[${selectedText}](${date.formattedString})`;
  } else if (mode === "clean") {
    newStr = `${date.formattedString}`;
  } else if (mode === "time") {
    const time = plugin.parseTime(selectedText);
    newStr = `${time.formattedString}`;
  }

  editor.replaceSelection(newStr);
  adjustCursor(editor, cursor, newStr, selectedText);
  editor.focus();
}

export function insertMomentCommand(
  plugin: AmazeCompletePlugin,
  date: Date,
  format: string
): void {
  const { workspace } = plugin.app;
  const activeView = workspace.getActiveViewOfType(MarkdownView);

  if (activeView) {
    const editor = activeView.editor;
    editor.replaceSelection(window.moment(date).format(format));
  }
}

export function getNowCommand(plugin: AmazeCompletePlugin): void {
  const format = `${plugin.settings.format}${plugin.settings.separator}${plugin.settings.timeFormat}`;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}

export function getCurrentDateCommand(plugin: AmazeCompletePlugin): void {
  const format = plugin.settings.format;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}

export function getCurrentTimeCommand(plugin: AmazeCompletePlugin): void {
  const format = plugin.settings.timeFormat;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}
