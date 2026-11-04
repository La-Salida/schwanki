import { Link } from "react-router-dom";
import { COMPARISONS, COMPARISON_DATE, type Comparison } from "@/lib/comparisons";
import { COMPARISON_PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";

const comparisonDateLabel = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
}).format(new Date(COMPARISON_DATE));

export default function ComparisonPage({ comparison }: { comparison: Comparison }) {
  usePageMeta(COMPARISON_PAGES[comparison.path]!);
  const { name, title, answer, rows, example, questions, sources } = comparison;

  return (
    <main id="main-content" className="page-shell">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <nav aria-label="Breadcrumb" className="text-sm text-ink/70">
            <Link to="/" className="underline">Schwanki</Link> › <span>Schwanki vs {name}</span>
          </nav>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">{title}</h1>
          <p className="text-sm text-ink/70">Sources checked <time dateTime={COMPARISON_DATE}>{comparisonDateLabel}</time></p>
          <p className="text-lg leading-relaxed">{answer}</p>
          <a href="/#review-demo" className="primary-button">Try the review demo</a>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="mb-3 text-left text-xl font-black">Schwanki and {name} at a glance</caption>
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="p-2 sm:p-3">Workflow</th>
                <th scope="col" className="bg-ruled/10 p-2 sm:p-3">Schwanki</th>
                <th scope="col" className="p-2 sm:p-3">{name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/20">
              {rows.map(({ topic, schwanki, other }) => (
                <tr key={topic} className="align-top">
                  <th scope="row" className="p-2 sm:p-3">{topic}</th>
                  <td className="bg-ruled/10 p-2 sm:p-3">{schwanki}</td>
                  <td className="p-2 sm:p-3">{other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-black">{example.title}</h2>
          <p className="leading-relaxed">{example.text}</p>
        </section>

        <section className="space-y-5" aria-labelledby="comparison-questions">
          <h2 id="comparison-questions" className="text-2xl font-black">Common questions</h2>
          {questions.map(({ question, answer }) => (
            <div key={question} className="space-y-1">
              <h3 className="font-bold">{question}</h3>
              <p className="leading-relaxed">{answer}</p>
            </div>
          ))}
        </section>

        <section className="space-y-2 border-t border-ink/20 pt-5" aria-labelledby="comparison-sources">
          <h2 id="comparison-sources" className="font-bold">Sources</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {sources.map(({ title, url }) => <li key={url}><a href={url} className="underline">{title}</a></li>)}
          </ul>
        </section>

        <nav aria-label="More comparisons" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-ink/20 pt-5 text-sm">
          {COMPARISONS.filter(({ path }) => path !== comparison.path).map(({ name, path }) => (
            <Link key={path} to={path} className="underline">Schwanki vs {name}</Link>
          ))}
          <Link to="/anki-alternative" className="underline">Schwanki as an Anki alternative</Link>
        </nav>
      </article>
    </main>
  );
}
