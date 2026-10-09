import { Link } from "react-router-dom";

export function ImportProgress({ label, error, compact = false }: {
  label: string;
  error?: string | null;
  compact?: boolean;
}) {
  const Heading = compact ? "h2" : "h1";
  return (
    <section className={`import-progress${compact ? " import-progress--compact" : ""}`} aria-labelledby="import-title">
      <div className="import-progress__intro">
        <div>
          <p className="import-progress__eyebrow">YOUR CLASS NOTES</p>
          <Heading id="import-title">{error ? "These notes need another look." : "Your notes are in."}</Heading>
          <p className="import-progress__class">{label}</p>
        </div>
        {!compact && <img src="/goose.png" alt="" className="import-progress__goose" />}
      </div>

      {error ? (
        <div className="import-progress__problem" role="alert">
          <h2>We couldn’t prepare this class</h2>
          <p>{error}</p>
          <Link to="/sources" className="secondary-button">Check class notes</Link>
        </div>
      ) : (
        <>
          <ol className="import-progress__steps" aria-label="Import progress">
            <li className="is-complete"><span aria-hidden="true">✓</span><div><strong>Notes uploaded</strong><p>Your class file is saved.</p></div></li>
            <li className="is-current" aria-current="step"><span className="import-progress__pulse" aria-hidden="true" /><div><strong>Preparing vocabulary</strong><p>Finding words, meanings, and readings.</p></div></li>
            <li><span aria-hidden="true">3</span><div><strong>Check your words</strong><p>Keep the ones you want to learn.</p></div></li>
          </ol>
          <div className="import-progress__footer">
            <p role="status">Words will appear here automatically.<br /><span>This can take a few minutes. You can leave and come back.</span></p>
            <Link to="/sources">Back to class notes <span aria-hidden="true">↗</span></Link>
          </div>
        </>
      )}
    </section>
  );
}
