import { useState } from "react";
import {
  useActions,
  useHaptics,
  useIntroductoryOffer,
  useProducts,
  usePurchase,
  useTranslation,
} from "superwall/hooks";

type Slot = "annual" | "monthly";

const TERMS = "https://schwankiapp.com/terms";
const PRIVACY = "https://schwankiapp.com/privacy";

/**
 * The trial-timeline paywall. Annual with its free trial is selected; monthly
 * is the fallback for people who won't commit to a year. Every price comes
 * from the store at runtime, so each line guards its variable and the
 * unpriced state still reads as a complete page.
 */
export default function Paywall() {
  const { restore, openUrl } = useActions();
  const { getProduct } = useProducts();
  const { purchase } = usePurchase();
  const { eligible } = useIntroductoryOffer();
  const { t } = useTranslation();
  const haptics = useHaptics();

  const [slot, setSlot] = useState<Slot>("annual");
  // One line of copy for an outcome worth saying; nothing for an abandoned sheet.
  const [notice, setNotice] = useState<string>();

  const annual = getProduct("annual")?.variables;
  const monthly = getProduct("monthly")?.variables;
  const trialDays = Number(annual?.trialPeriodDays ?? 0);
  // Trial copy only for shoppers the store says are eligible; `undefined` reads as not yet, so it stays plain.
  const trial = slot === "annual" && eligible === true && trialDays > 0;

  const choose = (value: Slot) => {
    if (value === slot) return;
    haptics.selection();
    setSlot(value);
  };

  const buy = async () => {
    haptics.light();
    setNotice(undefined);
    // Never a loading state: the store sheet is the feedback and the SDK owns it.
    const result = await purchase(slot);
    if (result.status === "completed") haptics.success(); // the SDK dismisses the paywall
    else if (result.status === "failed") setNotice(t("purchase.failed")); // iOS only; the button stays enabled
    // abandoned: the user closed the sheet; nothing changes, nothing is said
  };

  const cta = trial ? t("paywall.ctaTrial", { days: trialDays }) : t("paywall.cta");

  let terms: string;
  if (slot === "monthly") terms = monthly?.price ? t("paywall.termsMonthly", { price: monthly.price }) : t("paywall.termsBare");
  else if (trial) terms = annual?.price ? t("paywall.termsTrial", { days: trialDays, price: annual.price }) : t("paywall.termsBare");
  else terms = annual?.price ? t("paywall.termsAnnual", { price: annual.price }) : t("paywall.termsBare");

  return (
    <main className="page page--paywall">
      <div className="lede">
        <h1>{trial ? t("paywall.titleTrial", { days: trialDays }) : t("paywall.title")}</h1>
        <p>{t("paywall.subtitle")}</p>
      </div>

      <ul className="perks">
        <li>{t("paywall.perk.aids")}</li>
        <li>{t("paywall.perk.photos")}</li>
        <li>{t("paywall.perk.everywhere")}</li>
      </ul>

      {trial ? (
        <ol className="timeline" aria-label={t("paywall.timelineLabel")}>
          <li className="timeline-step">
            <span className="timeline-dot timeline-dot--now" aria-hidden="true" />
            <span className="timeline-when">{t("paywall.today")}</span>
            <span className="timeline-what">{t("paywall.todayWhat")}</span>
          </li>
          <li className="timeline-step">
            <span className="timeline-dot" aria-hidden="true" />
            <span className="timeline-when">{t("paywall.day", { day: Math.max(1, trialDays - 1) })}</span>
            <span className="timeline-what">{t("paywall.dayBeforeWhat")}</span>
          </li>
          <li className="timeline-step">
            <span className="timeline-dot" aria-hidden="true" />
            <span className="timeline-when">{t("paywall.day", { day: trialDays })}</span>
            <span className="timeline-what">
              {annual?.price ? t("paywall.endWhat", { price: annual.price }) : t("paywall.endWhatBare")}
            </span>
          </li>
        </ol>
      ) : null}

      <div className="plans" role="radiogroup" aria-label={t("paywall.plansLabel")}>
        <button
          type="button"
          role="radio"
          className="plan"
          aria-checked={slot === "annual"}
          onClick={() => choose("annual")}
        >
          <span className="plan-ring" aria-hidden="true" />
          <span className="plan-body">
            <span className="plan-name">
              {t("paywall.annual")}
              {annual?.monthlyPrice ? <span className="plan-tag">{t("paywall.perMonth", { price: annual.monthlyPrice })}</span> : null}
            </span>
            <span className="plan-price">
              {annual?.price
                ? eligible === true && trialDays > 0
                  ? t("paywall.annualTrialPrice", { days: trialDays, price: annual.price })
                  : t("paywall.annualPrice", { price: annual.price })
                : t("paywall.priceSoon")}
            </span>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          className="plan"
          aria-checked={slot === "monthly"}
          onClick={() => choose("monthly")}
        >
          <span className="plan-ring" aria-hidden="true" />
          <span className="plan-body">
            <span className="plan-name">{t("paywall.monthly")}</span>
            <span className="plan-price">
              {monthly?.price ? t("paywall.monthlyPrice", { price: monthly.price }) : t("paywall.priceSoon")}
            </span>
          </span>
        </button>
      </div>

      <div className="actions">
        {notice ? (
          <p className="notice" role="status">
            {notice}
          </p>
        ) : null}
        <button type="button" className="button button--primary" onClick={() => void buy()}>
          {cta}
        </button>
        <p className="fineprint">{terms}</p>
        <div className="legal">
          <button
            type="button"
            className="link"
            onClick={async () => {
              haptics.light();
              setNotice(undefined);
              // "Nothing to restore" and a store error both resolve `failed`; the copy covers both.
              const result = await restore();
              if (result.status === "restored") haptics.success();
              setNotice(result.status === "restored" ? t("restore.restored") : t("restore.failed"));
            }}
          >
            {t("paywall.restore")}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              haptics.light();
              openUrl(TERMS);
            }}
          >
            {t("paywall.terms")}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              haptics.light();
              openUrl(PRIVACY);
            }}
          >
            {t("paywall.privacy")}
          </button>
        </div>
      </div>
    </main>
  );
}
