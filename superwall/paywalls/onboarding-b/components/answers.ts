import { parseAsStringEnum, readAttribute, type UserAttributes } from "superwall/hooks";
import type { RouteName } from "superwall/navigation";

/*
 * Every answer is a user attribute: stable snake_case keys campaigns can
 * target and analytics can segment by, short enum ids as values. Never
 * rename a key that has shipped; add a new one.
 */
export const LANGUAGE = {
  key: "onboarding_language",
  parser: parseAsStringEnum([
    "spanish",
    "french",
    "german",
    "italian",
    "portuguese",
    "japanese",
    "korean",
    "chinese",
    "other",
  ]),
};
export const SOURCE = {
  key: "onboarding_source",
  parser: parseAsStringEnum(["tutor", "anki", "notes", "media", "none"]),
};
export const HEARD = {
  key: "onboarding_heard",
  parser: parseAsStringEnum(["instagram", "tiktok", "youtube", "reddit", "friend", "store", "other"]),
};
export const DAILY = {
  key: "onboarding_daily",
  parser: parseAsStringEnum(["5", "10", "20", "40"]),
};
/** Whether they asked for a daily nudge. The answer, not the OS permission. */
export const REMINDER = {
  key: "onboarding_reminder",
  parser: parseAsStringEnum(["yes", "no"]),
};

export type Language = NonNullable<ReturnType<typeof LANGUAGE.parser.parse>>;
export type Source = NonNullable<ReturnType<typeof SOURCE.parser.parse>>;
export type Heard = NonNullable<ReturnType<typeof HEARD.parser.parse>>;
export type Daily = NonNullable<ReturnType<typeof DAILY.parser.parse>>;
export type Reminder = NonNullable<ReturnType<typeof REMINDER.parser.parse>>;

export type Answers = {
  language: Language | null;
  source: Source | null;
  heard: Heard | null;
  daily: Daily | null;
  reminder: Reminder | null;
};

export const answersOf = (user: UserAttributes): Answers => ({
  language: readAttribute(user, LANGUAGE.key, LANGUAGE.parser),
  source: readAttribute(user, SOURCE.key, SOURCE.parser),
  heard: readAttribute(user, HEARD.key, HEARD.parser),
  daily: readAttribute(user, DAILY.key, DAILY.parser),
  reminder: readAttribute(user, REMINDER.key, REMINDER.parser),
});

/** The flow, in one place. The buttons push what it returns and `entry` replays it. */
export const next = (route: RouteName, _user: UserAttributes): RouteName | undefined => {
  switch (route) {
    case "index":
      return "language";
    case "language":
      return "source";
    case "source":
      return "heard";
    case "heard":
      return "daily";
    case "daily":
      return "plan";
    case "plan":
      return "reminder";
    case "reminder":
      return "paywall";
    default:
      return undefined;
  }
};

/** Whether the user is past a page. The intro counts once the first question is answered; the plan once the pace is set. */
export const answered = (route: RouteName, user: UserAttributes): boolean => {
  const answers = answersOf(user);
  switch (route) {
    case "index":
    case "language":
      return answers.language !== null;
    case "source":
      return answers.source !== null;
    case "heard":
      return answers.heard !== null;
    case "daily":
    case "plan":
      return answers.daily !== null;
    case "reminder":
      return answers.reminder !== null;
    default:
      return false;
  }
};

/** The question pages, for the progress marks. */
export const QUESTIONS: readonly RouteName[] = ["language", "source", "heard", "daily"];

/**
 * The forecast, from the pace. Words met is plain arithmetic; the minutes
 * are a rough figure for new cards plus the reviews they generate once the
 * deck is rolling (about half a minute per new card including its reviews).
 */
export const forecastOf = (daily: Daily) => {
  const perDay = Number(daily);
  return {
    perDay,
    week: perDay * 7,
    month: perDay * 30,
    quarter: perDay * 90,
    minutes: Math.max(3, Math.round(perDay * 0.6)),
  };
};
