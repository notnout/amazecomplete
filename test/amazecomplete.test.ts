import assert from "node:assert";
import moment from "moment";

(globalThis as any).window = {
  moment,
};

import NLDParser from "../src/parser";
import { DEFAULT_SETTINGS } from "../src/settings";
import { DateSuggestionProvider } from "../src/suggest/providers/date-provider";
import { TemplateSuggestionProvider } from "../src/suggest/providers/template-provider";
import { FileSuggestionProvider } from "../src/suggest/providers/file-provider";
import { getFormattedDate } from "../src/utils";

function createMockPlugin(
  files: { path: string; basename: string; parentPath: string; mtime?: number; aliases?: string[] }[],
  templaterFolder = "Templates"
) {
  const settings = { ...DEFAULT_SETTINGS };
  const parser = new NLDParser();
  const templaterCalls: string[] = [];

  const tFiles = files.map((f) => ({
    path: f.path,
    basename: f.basename,
    name: `${f.basename}.md`,
    extension: "md",
    parent: { path: f.parentPath },
    stat: { mtime: f.mtime ?? Date.now(), ctime: Date.now(), size: 100 },
  }));

  const aliasMap = new Map(files.map((f) => [f.path, f.aliases]));

  const app: any = {
    vault: {
      getMarkdownFiles: () => tFiles,
      cachedRead: async (file: any) => `# Template Content for ${file.basename}`,
      getConfig: (key: string) => (key === "useMarkdownLinks" ? false : undefined),
    },
    metadataCache: {
      getFileCache: (file: any) => {
        const aliases = aliasMap.get(file.path);
        return aliases ? { frontmatter: { aliases } } : {};
      },
    },
    fileManager: {
      generateMarkdownLink: (file: any, _sourcePath: string, _subpath?: string, alias?: string) => {
        return alias ? `[[${file.basename}|${alias}]]` : `[[${file.basename}]]`;
      },
    },
    plugins: {
      plugins: {
        "templater-obsidian": {
          settings: {
            templates_folder: templaterFolder,
          },
          templater: {
            append_template_to_active_file: async (file: any) => {
              templaterCalls.push(file.path);
            },
          },
        },
      },
    },
  };

  const plugin: any = {
    app,
    settings,
    parser,
    templaterCalls,
    parse(dateString: string, format: string) {
      const date = parser.getParsedDate(dateString, settings.weekStart);
      const momentObj = date ? moment(date) : moment.invalid();
      const formattedString = momentObj.isValid()
        ? getFormattedDate(date, format)
        : "Invalid date";
      return {
        formattedString,
        date,
        moment: momentObj,
      };
    },
    parseDate(dateString: string) {
      return this.parse(dateString, settings.format);
    },
    parseTime(dateString: string) {
      return this.parse(dateString, settings.timeFormat);
    },
  };

  return plugin;
}

function createMockEditor(initialText: string) {
  let content = initialText;
  return {
    getText: () => content,
    replaceRange(replacement: string, start: { line: number; ch: number }, end?: { line: number; ch: number }) {
      const endPos = end ?? start;
      content =
        content.slice(0, start.ch) +
        replacement +
        content.slice(endPos.ch);
    },
    setCursor(_pos: { line: number; ch: number }) {},
  };
}

async function runTests() {
  const plugin = createMockPlugin([
    { path: "Templates/Book.md", basename: "Book", parentPath: "Templates" },
    { path: "Templates/Meeting.md", basename: "Meeting", parentPath: "Templates" },
    { path: "Notes/TODO.md", basename: "TODO", parentPath: "Notes", aliases: ["Tasks"] },
    { path: "Projects/Roadmap.md", basename: "Roadmap", parentPath: "Projects" },
  ]);

  const dateProvider = new DateSuggestionProvider(plugin);
  const templateProvider = new TemplateSuggestionProvider(plugin);
  const fileProvider = new FileSuggestionProvider(plugin, templateProvider);

  // 1. Test Natural Language Date suggestions ("Today")
  const dateSuggestions = dateProvider.getSuggestions("Tod");
  assert.ok(dateSuggestions.length >= 1, "Expected at least 1 date suggestion for 'Tod'");
  assert.strictEqual(dateSuggestions[0].label, "Today");
  assert.strictEqual(dateSuggestions[0].category, "date");
  assert.strictEqual(
    dateSuggestions[0].formattedValue,
    moment().format("YYYY-MM-DD")
  );

  // Test selecting "Today" inserts [[YYYY-MM-DD]]
  const dateEditor = createMockEditor("@Tod");
  dateProvider.selectSuggestion(
    dateSuggestions[0],
    dateEditor as any,
    { line: 0, ch: 0 },
    { line: 0, ch: 4 },
    false
  );
  assert.strictEqual(dateEditor.getText(), `[[${moment().format("YYYY-MM-DD")}]]`);

  // Test Shift+Enter on "Today" inserts [[YYYY-MM-DD|Today]]
  const dateAliasEditor = createMockEditor("@Tod");
  dateProvider.selectSuggestion(
    dateSuggestions[0],
    dateAliasEditor as any,
    { line: 0, ch: 0 },
    { line: 0, ch: 4 },
    true
  );
  assert.strictEqual(
    dateAliasEditor.getText(),
    `[[${moment().format("YYYY-MM-DD")}|Today]]`
  );

  // Test "Next Friday", "This Friday", "Last Friday", "Next week" when reference date is a Friday (2026-10-30)
  const fridayRef = new Date("2026-10-30T12:00:00");
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("Today", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-30"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("Tomorrow", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-31"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("Yesterday", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-29"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("Next Friday", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-11-06"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("This Friday", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-30"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("Last Friday", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-23"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("this week", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-25"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("next week", "sunday", fridayRef)).format("YYYY-MM-DD"),
    "2026-11-01"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("this week", "monday", fridayRef)).format("YYYY-MM-DD"),
    "2026-10-26"
  );
  assert.strictEqual(
    moment(plugin.parser.getParsedDate("next week", "monday", fridayRef)).format("YYYY-MM-DD"),
    "2026-11-02"
  );

  // 2. Test Templater Template suggestions ("Book")
  const templateSuggestions = templateProvider.getSuggestions("Book");
  assert.strictEqual(templateSuggestions.length, 1);
  assert.strictEqual(templateSuggestions[0].label, "Book");
  assert.strictEqual(templateSuggestions[0].category, "template");
  assert.strictEqual(templateSuggestions[0].file.path, "Templates/Book.md");

  // Test selecting "Book" strips "@Book" and invokes Templater append_template_to_active_file
  const templateEditor = createMockEditor("Prefix @Book Suffix");
  await templateProvider.selectSuggestion(
    templateSuggestions[0],
    templateEditor as any,
    { line: 0, ch: 7 },
    { line: 0, ch: 12 },
    false
  );
  assert.strictEqual(templateEditor.getText(), "Prefix  Suffix");
  assert.deepStrictEqual(plugin.templaterCalls, ["Templates/Book.md"]);

  // 3. Test File suggestions ("TODO") and verify Templates folder is excluded from File suggestions
  const fileSuggestionsForBook = fileProvider.getSuggestions("Book");
  assert.strictEqual(
    fileSuggestionsForBook.length,
    0,
    "Templates/Book.md should be excluded from file link suggestions when excludeTemplatesFromFiles is true"
  );

  const fileSuggestionsForTodo = fileProvider.getSuggestions("TODO");
  assert.strictEqual(fileSuggestionsForTodo.length, 1);
  assert.strictEqual(fileSuggestionsForTodo[0].label, "TODO");
  assert.strictEqual(fileSuggestionsForTodo[0].category, "file");

  const fileEditor = createMockEditor("Check @TODO now");
  fileProvider.selectSuggestion(
    fileSuggestionsForTodo[0],
    fileEditor as any,
    { line: 0, ch: 6 },
    { line: 0, ch: 11 },
    "Daily/2026-10-26.md",
    false
  );
  assert.strictEqual(fileEditor.getText(), "Check [[TODO]] now");

  // 4. Test File Alias matching ("Tasks" -> [[TODO|Tasks]])
  const aliasSuggestions = fileProvider.getSuggestions("Tasks");
  assert.strictEqual(aliasSuggestions.length, 1);
  assert.strictEqual(aliasSuggestions[0].alias, "Tasks");

  const aliasEditor = createMockEditor("@Tasks");
  fileProvider.selectSuggestion(
    aliasSuggestions[0],
    aliasEditor as any,
    { line: 0, ch: 0 },
    { line: 0, ch: 6 },
    "Daily/2026-10-26.md",
    false
  );
  assert.strictEqual(aliasEditor.getText(), "[[TODO|Tasks]]");

  console.log("All AmazeComplete tests passed!");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
