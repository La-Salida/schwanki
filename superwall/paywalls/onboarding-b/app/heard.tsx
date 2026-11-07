import { Question } from "../components/Question";
import { HEARD, type Heard } from "../components/answers";

const OPTIONS: readonly Heard[] = ["instagram", "tiktok", "youtube", "reddit", "friend", "store", "other"];

export default function Page() {
  return <Question route="heard" attribute={HEARD} options={OPTIONS} prefix="heard" />;
}
