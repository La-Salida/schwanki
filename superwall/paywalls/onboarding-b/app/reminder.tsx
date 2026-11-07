import { useActions, useHaptics, useTranslation, useUser, useUserAttribute } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import { next, REMINDER, type Reminder } from "../components/answers";
import sleep from "../assets/goose-sleep.webp";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reminder priming before the OS prompt. The answer saved is whether they
 * wanted a nudge, not what iOS said: the permission can change in Settings,
 * the answer is what the flow branches on. Either answer moves on; the
 * permission prompt is never a wall.
 */
export default function ReminderPage() {
  const router = useRouter();
  const { requestPermission } = useActions();
  const { t } = useTranslation();
  const haptics = useHaptics();
  const user = useUser();
  const [, setReminder] = useUserAttribute(REMINDER.key, REMINDER.parser);

  const answer = async (value: Reminder) => {
    haptics.selection();
    setReminder(value);
    // The OS sheet is the feedback; the button stays enabled, and a denial still moves on.
    // A host that never answers (nothing to prompt, an old SDK) must not strand the flow here.
    if (value === "yes") await Promise.race([requestPermission("notification"), wait(15_000)]);
    const to = next("reminder", { ...user, [REMINDER.key]: value });
    if (to) router.push(to);
  };

  return (
    <main className="page">
      <div className="lede">
        <h1>{t("reminder.title")}</h1>
        <p>{t("reminder.subtitle")}</p>
      </div>

      <section className="card nudge" aria-hidden="true">
        <img className="nudge-goose" src={sleep} alt="" width="96" height="96" />
        <div className="nudge-bubble">
          <span className="nudge-app">{t("reminder.previewApp")}</span>
          <span className="nudge-text">{t("reminder.previewBody")}</span>
        </div>
      </section>

      <div className="actions">
        <button type="button" className="button button--primary" onClick={() => void answer("yes")}>
          {t("reminder.yes")}
        </button>
        <button type="button" className="link" onClick={() => void answer("no")}>
          {t("reminder.no")}
        </button>
      </div>
    </main>
  );
}
