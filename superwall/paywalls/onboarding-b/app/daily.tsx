import { Question } from "../components/Question";
import { DAILY, type Daily } from "../components/answers";

const OPTIONS: readonly Daily[] = ["5", "10", "20", "40"];

export default function Page() {
  return <Question route="daily" attribute={DAILY} options={OPTIONS} prefix="daily" />;
}
