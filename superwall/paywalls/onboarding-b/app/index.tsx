import { useEffect, useState } from "react";
import { useHaptics, useSuperwallSnapshot, useTranslation } from "superwall/hooks";
import { useRouter } from "superwall/navigation";
import goose from "../assets/goose.webp";

export default function Index() {
  const router = useRouter();
  const { t } = useTranslation();
  const haptics = useHaptics();
  // The SDK preloads paywalls hidden; the entrance runs once the paywall is actually open.
  // A host that never says so (an old SDK after a webview reload) gets the page anyway after the framework's own three-second wait.
  const opened = useSuperwallSnapshot().paywall !== undefined;
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 3000);
    return () => clearTimeout(id);
  }, []);
  const open = opened || waited;

  return (
    <main className="page page--welcome" data-open={open || undefined}>
      <div className="hero">
        <img className="hero-goose" src={goose} alt="" width="280" height="280" />
        <div className="lede lede--center">
          <h1 className="display">
            <span>{t("index.titleA")}</span>
            <span>{t("index.titleB")}</span>
          </h1>
          <p>{t("index.subtitle")}</p>
        </div>
      </div>

      <div className="actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            haptics.light();
            router.push("language");
          }}
        >
          {t("index.cta")}
        </button>
        <p className="fineprint">{t("index.fineprint")}</p>
      </div>
    </main>
  );
}
