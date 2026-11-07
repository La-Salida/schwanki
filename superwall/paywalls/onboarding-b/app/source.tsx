import { Question } from "../components/Question";
import { SOURCE, type Source } from "../components/answers";

const OPTIONS: readonly Source[] = ["tutor", "anki", "notes", "media", "none"];

export default function Page() {
  return <Question route="source" attribute={SOURCE} options={OPTIONS} prefix="source" />;
}
