import { definePaywall } from "superwall/config";

/**
 * Flow B: the NomadTable-shaped onboarding that ends on a Plus trial.
 *
 * Questions first (language, where the words come from, how they heard of
 * us, pace), then an honest forecast built from the pace, a reminder
 * prime, and a trial-timeline paywall. Every answer is a user attribute,
 * so closing halfway resumes at the first unanswered question.
 */
export default definePaywall({
  name: "Onboarding B — Plus trial",

  /** Index-card paper in light, deep navy in dark; the same values as `--paper` in theme.css. */
  background: { light: "#FFFFFF", dark: "#14171D" },

  /** Closing the flow never blocks the app: the feed works without Plus. */
  featureGating: "nonGated",

  /** Pages slide like a card deck being dealt. */
  transition: "shift",

  products: {
    annual: "io.lasalida.schwanki.plus.annual",
    monthly: "io.lasalida.schwanki.plus.monthly",
  },

  notifications: {
    trialReminder: {
      title: "trial.reminder.title",
      body: "trial.reminder.body",
      beforeTrialEndDays: 1,
    },
  },
});
