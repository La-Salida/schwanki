import { useHaptics, useTranslation, useUser } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import { answersOf, forecastOf, next } from "../components/answers";
import celebrate from "../assets/goose-celebrate.webp";

/**
 * The forecast. Plain arithmetic from the pace they chose, labelled as what
 * it is: words met if they show up most days. No invented user counts, no
 * fake precision.
 */
export default function Plan() {
  const router = useRouter();
  const { t } = useTranslation();
  const haptics = useHaptics();
  const user = useUser();
  const answers = answersOf(user);

  // `entry` only opens here once the pace is answered; the fallback covers a dev reload.
  const forecast = forecastOf(answers.daily ?? "20");
  const language = answers.language ? t(`language.${answers.language}.name`) : t("plan.anyLanguage");
  const source = answers.source ? t(`plan.source.${answers.source}`) : null;

  return (
    <main className="page">
      <div className="lede">
        <h1>{t("plan.title", { language })}</h1>
        <p>{source ? t("plan.subtitle", { source, minutes: forecast.minutes }) : t("plan.subtitleBare", { minutes: forecast.minutes })}</p>
      </div>

      <section className="card forecast" aria-label={t("plan.forecastLabel")}>
        <div className="forecast-pace">
          <span className="forecast-number">{forecast.perDay}</span>
          <span className="forecast-caption">{t("plan.perDay")}</span>
        </div>
        <dl className="forecast-rows">
          <div className="forecast-row">
            <dt>{t("plan.week")}</dt>
            <dd>{t("plan.words", { count: forecast.week })}</dd>
          </div>
          <div className="forecast-row">
            <dt>{t("plan.month")}</dt>
            <dd>{t("plan.words", { count: forecast.month })}</dd>
          </div>
          <div className="forecast-row">
            <dt>{t("plan.quarter")}</dt>
            <dd>{t("plan.words", { count: forecast.quarter })}</dd>
          </div>
        </dl>
        <p className="forecast-note">{t("plan.note")}</p>
        <img className="forecast-goose" src={celebrate} alt="" width="120" height="120" />
      </section>

      <div className="actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            haptics.light();
            const to = next("plan", user);
            if (to) router.push(to);
          }}
        >
          {t("plan.cta")}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            haptics.light();
            router.back();
          }}
        >
          {t("plan.changePace")}
        </button>
      </div>
    </main>
  );
}
