import { useHaptics, useTranslation, useUser, useUserAttribute, type Parser } from "superwall/hooks";
import { useRouter, type RouteName } from "superwall/navigation";
import { next } from "./answers";

type Props<T extends string> = {
  /** This page's route, so `next` knows where it leads. */
  route: RouteName;
  attribute: { key: string; parser: Parser<T> };
  options: readonly T[];
  /** Message prefix: `${prefix}.title`, `${prefix}.${option}.name`, optional `.hint`. */
  prefix: string;
  /** Two columns of short labels (languages) instead of one column of cards. */
  grid?: boolean;
};

/**
 * One question page: a title, the options, the saved answer shown as
 * selected. Tapping saves the answer as a user attribute first, then pushes
 * wherever `next` says, so a user who closes here resumes on the next page.
 */
export function Question<T extends string>({ route, attribute, options, prefix, grid }: Props<T>) {
  const router = useRouter();
  const { t } = useTranslation();
  const haptics = useHaptics();
  const user = useUser();
  const [chosen, setChosen] = useUserAttribute(attribute.key, attribute.parser);

  const choose = (value: T) => {
    haptics.selection();
    setChosen(value);
    const to = next(route, { ...user, [attribute.key]: value });
    if (to) router.push(to);
  };

  return (
    <main className="page">
      <div className="lede">
        <h1>{t(`${prefix}.title`)}</h1>
        {t(`${prefix}.subtitle`) !== `${prefix}.subtitle` ? <p>{t(`${prefix}.subtitle`)}</p> : null}
      </div>

      <div className={grid ? "choices choices--grid" : "choices"} role="group">
        {options.map((option) => {
          const hintKey = `${prefix}.${option}.hint`;
          const hint = t(hintKey);
          return (
            <button
              key={option}
              type="button"
              className="choice"
              aria-pressed={chosen === option}
              onClick={() => choose(option)}
            >
              <span className="choice-body">
                <span className="choice-name">{t(`${prefix}.${option}.name`)}</span>
                {hint !== hintKey ? <span className="choice-hint">{hint}</span> : null}
              </span>
              <span className="choice-mark" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
