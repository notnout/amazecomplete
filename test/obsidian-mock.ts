export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export function prepareFuzzySearch(query: string) {
  const lowerQuery = query.toLowerCase();
  return (text: string) => {
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx !== -1) {
      return {
        score: -idx * 0.1 - (lowerText.length - lowerQuery.length) * 0.01,
        matches: [[idx, idx + lowerQuery.length]],
      };
    }
    let qIdx = 0;
    for (let i = 0; i < lowerText.length && qIdx < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[qIdx]) {
        qIdx++;
      }
    }
    if (qIdx === lowerQuery.length) {
      return { score: -0.5, matches: [] };
    }
    return null;
  };
}

export function setIcon(el: any, iconId: string): void {
  if (el) {
    el.dataset = { icon: iconId };
  }
}

export function requireApiVersion(_version: string): boolean {
  return true;
}

export class Plugin {}
export class PluginSettingTab {}
export class EditorSuggest<T> {
  app: any;
  context: any;
  scope = { register: () => {} };
  constructor(app: any) {
    this.app = app;
  }
  setInstructions(_instructions: any[]) {}
}
export class Setting {
  descEl: any = {};
  setName() { return this; }
  setDesc() { return this; }
  addToggle() { return this; }
  addText() { return this; }
  addMomentFormat() { return this; }
  addDropdown() { return this; }
}
export class Notice {}
export class TFile {}
