import { App, normalizePath, TFile } from "obsidian";
import { DayOfWeek } from "./settings";

interface VaultWithConfig {
  getConfig?: (key: string) => unknown;
}

export const DAYS_OF_WEEK: Exclude<DayOfWeek, "locale-default">[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function getFormattedDate(date: Date, format: string): string {
  return window.moment(date).format(format);
}

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getLocaleWeekStart(): Exclude<DayOfWeek, "locale-default"> {
  const startOfWeek = window.moment?.localeData?.()?.firstDayOfWeek?.() ?? 0;
  return DAYS_OF_WEEK[startOfWeek] || "sunday";
}

export function generateMarkdownLink(
  app: App,
  subpath: string,
  alias?: string
): string {
  const vaultWithConfig = app.vault as unknown as VaultWithConfig;
  const useMarkdownLinks = vaultWithConfig.getConfig?.("useMarkdownLinks") === true;
  const path = normalizePath(subpath);

  if (useMarkdownLinks) {
    return alias
      ? `[${alias}](${path.replace(/ /g, "%20")})`
      : `[${subpath}](${path})`;
  }
  return alias ? `[[${path}|${alias}]]` : `[[${path}]]`;
}

export function isFileInFolder(file: TFile, folderPath: string | null): boolean {
  if (!folderPath) {
    return false;
  }
  const prefix = folderPath === "/" ? "" : `${folderPath}/`;
  return file.path === folderPath || file.path.startsWith(prefix);
}

export function scoreFuzzyMatch(
  text: string,
  lowerQuery: string,
  matchScore: number,
  baseScore: number
): number {
  const lowerText = text.toLowerCase();
  let score = baseScore + matchScore * 20;
  if (lowerText === lowerQuery) {
    score += 60;
  } else if (lowerText.startsWith(lowerQuery)) {
    score += 35;
  }
  return score;
}

const ORDINAL_WORD_DICTIONARY: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  thirtieth: 30,
  "thirty first": 31,
  "thirty-first": 31,
};

const ORDINAL_WORDS_JOINED = Object.keys(ORDINAL_WORD_DICTIONARY)
  .sort((a, b) => b.length - a.length)
  .join("|");

export const ORDINAL_NUMBER_PATTERN = `(?:${ORDINAL_WORDS_JOINED}|[0-9]{1,2}(?:st|nd|rd|th)?)`;

export function parseOrdinalNumberPattern(match: string): number {
  const num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY[num] !== undefined) {
    return ORDINAL_WORD_DICTIONARY[num];
  }
  return parseInt(num.replace(/(?:st|nd|rd|th)$/i, ""), 10);
}
