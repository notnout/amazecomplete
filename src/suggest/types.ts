import { SearchResult, TFile } from "obsidian";

export type SuggestionCategory = "date" | "template" | "file";

export interface BaseSuggestion {
  category: SuggestionCategory;
  label: string;
  subLabel?: string;
  score: number;
}

export interface DateSuggestion extends BaseSuggestion {
  category: "date";
  rawQuery: string;
  parsedPreview: string;
  isTime: boolean;
}

export interface TemplateSuggestion extends BaseSuggestion {
  category: "template";
  file: TFile;
  match?: SearchResult;
}

export interface FileSuggestion extends BaseSuggestion {
  category: "file";
  file: TFile;
  alias?: string;
  match?: SearchResult;
}

export type AmazeSuggestion =
  | DateSuggestion
  | TemplateSuggestion
  | FileSuggestion;
