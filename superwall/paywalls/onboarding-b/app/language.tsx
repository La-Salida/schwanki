import { Question } from "../components/Question";
import { LANGUAGE, type Language } from "../components/answers";

const OPTIONS: readonly Language[] = [
  "spanish",
  "french",
  "german",
  "italian",
  "portuguese",
  "japanese",
  "korean",
  "chinese",
  "other",
];

export default function Page() {
  return <Question route="language" attribute={LANGUAGE} options={OPTIONS} prefix="language" grid />;
}
