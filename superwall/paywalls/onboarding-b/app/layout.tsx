import type { PropsWithChildren } from "react";
import { useActions, useHaptics, useTranslation } from "superwall/hooks";
import { replayStack, useRouter, type Entry } from "superwall/navigation";
import { answered, next, QUESTIONS } from "../components/answers";
import "./theme.css";

/** Open on the stack the user would have tapped through: every answered page, then the first unanswered one. */
export const entry: Entry = ({ user }) =>
  replayStack(
    "index",
    (route) => next(route, user),
    (route) => answered(route, user),
  );

export default function Layout({ children }: PropsWithChildren) {
  const { close } = useActions();
  const { t } = useTranslation();
  const haptics = useHaptics();
  const router = useRouter();

  const question = QUESTIONS.indexOf(router.name);

  return (
    <div className="shell">
      {router.canGoBack() ? (
        <button
          type="button"
          className="chrome chrome--back"
          aria-label={t("common.back")}
          onClick={() => {
            haptics.light();
            router.back();
          }}
        >
          <svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
      ) : null}

      {question >= 0 ? (
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={question + 1} aria-label={t("common.progress", { current: question + 1, total: QUESTIONS.length })}>
          {QUESTIONS.map((route, index) => (
            <span key={route} className="progress-mark" data-done={index <= question || undefined} />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="chrome chrome--close"
        aria-label={t("common.close")}
        onClick={() => {
          haptics.light();
          close();
        }}
      >
        <svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M4 4 12 12M12 4 4 12" />
        </svg>
      </button>

      {children}
    </div>
  );
}
