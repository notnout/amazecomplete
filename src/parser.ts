import * as chrono from "chrono-node";
import type { Chrono } from "chrono-node";
import type { Moment } from "moment";

import { DayOfWeek } from "./settings";
import {
  DAYS_OF_WEEK,
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

  getParsedDate(
    selectedText: string,
    weekStartPreference: DayOfWeek,
    referenceDate: Date = new Date()
  ): Date {
    const parser = this.chrono;
    const weekStart =
      weekStartPreference === "locale-default"
        ? getLocaleWeekStart()
        : weekStartPreference;

    const weekMatch = selectedText.match(/^(this|next|last)\s+week$/i);
    if (weekMatch) {
      const refKind = weekMatch[1].toLowerCase();
      const weekStartIdx = DAYS_OF_WEEK.indexOf(weekStart);
      const refMoment = window.moment(referenceDate);
      const daysSinceWeekStart = (refMoment.day() - weekStartIdx + 7) % 7;
      const startOfThisWeek = refMoment
        .clone()
        .subtract(daysSinceWeekStart, "days");

      if (refKind === "this") {
        return startOfThisWeek.toDate();
      }
      if (refKind === "next") {
        return startOfThisWeek.add(1, "weeks").toDate();
      }
      return startOfThisWeek.subtract(1, "weeks").toDate();
    }

    const nextDateMatch = selectedText.match(/^next\s+([\w]+)$/i);
    const lastDayOfMatch = selectedText.match(
      /(last day of|end of)\s*([^\n\r]*)/i
    );
    const midOf = selectedText.match(/mid\s+([\w]+)/i);

    if (nextDateMatch && nextDateMatch[1].toLowerCase() === "month") {
      const thisMonth = parser.parseDate("this month", referenceDate, {
        forwardDate: true,
      });
      return parser.parseDate(selectedText, thisMonth, {
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1].toLowerCase() === "year") {
      const thisYear = parser.parseDate("this year", referenceDate, {
        forwardDate: true,
      });
      return parser.parseDate(selectedText, thisYear, {
        forwardDate: true,
      });
    }

    if (lastDayOfMatch) {
      const tempDate = parser.parse(lastDayOfMatch[2], referenceDate);
      if (tempDate.length > 0) {
        const year = tempDate[0].start.get("year");
        const month = tempDate[0].start.get("month");
        const lastDay = getLastDayOfMonth(year, month);

        return parser.parseDate(`${year}-${month}-${lastDay}`, referenceDate, {
          forwardDate: true,
        });
      }
    }

    if (midOf) {
      return parser.parseDate(`${midOf[1]} 15th`, referenceDate, {
        forwardDate: true,
      });
    }

    return parser.parseDate(selectedText, referenceDate);
  }
}
