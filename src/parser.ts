import * as chrono from "chrono-node";
import type { Chrono } from "chrono-node";
import type { Moment } from "moment";

import { DayOfWeek } from "./settings";
import {
  ORDINAL_NUMBER_PATTERN,
  getLastDayOfMonth,
  getLocaleWeekStart,
  parseOrdinalNumberPattern,
} from "./utils";

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: Moment;
}

function getLocalizedChrono(): Chrono {
  const locale = window.moment?.locale?.() ?? "en";
  const littleEndian = locale === "en-gb";
  return new chrono.Chrono(
    chrono.en.configuration.createCasualConfiguration(littleEndian)
  );
}

function getConfiguredChrono(): Chrono {
  const localizedChrono = getLocalizedChrono();
  localizedChrono.parsers.push({
    pattern: () => /\bChristmas\b/i,
    extract: () => ({ day: 25, month: 12 }),
  });

  localizedChrono.parsers.push({
    pattern: () => new RegExp(ORDINAL_NUMBER_PATTERN),
    extract: (_context, match) => ({
      day: parseOrdinalNumberPattern(match[0]),
      month: (window.moment?.().month?.() ?? new Date().getMonth()) + 1,
    }),
  });

  return localizedChrono;
}

export default class NLDParser {
  chrono: Chrono;

  constructor() {
    this.chrono = getConfiguredChrono();
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    const parser = this.chrono;
    const initialParse = parser.parse(selectedText);
    const weekdayIsCertain = Boolean(
      initialParse[0]?.start?.isCertain("weekday")
    );

    const weekStart =
      weekStartPreference === "locale-default"
        ? getLocaleWeekStart()
        : weekStartPreference;

    const thisDateMatch = selectedText.match(/this\s([\w]+)/i);
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const lastDayOfMatch = selectedText.match(
      /(last day of|end of)\s*([^\n\r]*)/i
    );
    const midOf = selectedText.match(/mid\s([\w]+)/i);

    const referenceDate = weekdayIsCertain
      ? window.moment().weekday(0).toDate()
      : new Date();

    if (thisDateMatch && thisDateMatch[1].toLowerCase() === "week") {
      return parser.parseDate(`this ${weekStart}`, referenceDate);
    }

    if (nextDateMatch && nextDateMatch[1].toLowerCase() === "week") {
      return parser.parseDate(`next ${weekStart}`, referenceDate, {
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1].toLowerCase() === "month") {
      const thisMonth = parser.parseDate("this month", new Date(), {
        forwardDate: true,
      });
      return parser.parseDate(selectedText, thisMonth, {
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1].toLowerCase() === "year") {
      const thisYear = parser.parseDate("this year", new Date(), {
        forwardDate: true,
      });
      return parser.parseDate(selectedText, thisYear, {
        forwardDate: true,
      });
    }

    if (lastDayOfMatch) {
      const tempDate = parser.parse(lastDayOfMatch[2]);
      if (tempDate.length > 0) {
        const year = tempDate[0].start.get("year");
        const month = tempDate[0].start.get("month");
        const lastDay = getLastDayOfMonth(year, month);

        return parser.parseDate(`${year}-${month}-${lastDay}`, new Date(), {
          forwardDate: true,
        });
      }
    }

    if (midOf) {
      return parser.parseDate(`${midOf[1]} 15th`, new Date(), {
        forwardDate: true,
      });
    }

    return parser.parseDate(selectedText, referenceDate);
  }
}
