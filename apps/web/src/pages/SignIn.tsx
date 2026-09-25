import { signInWithGoogle } from "@/lib/auth";

export default function SignIn() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-sm text-center space-y-6">
        <img src="/goose.png" alt="The Schwanki goose" className="w-40 mx-auto" />
        <h1 className="text-5xl font-black tracking-tight">Schwanki</h1>
        <p className="text-lg">Your teachers write the words down. I make sure you actually learn them. — 🪿</p>
        <button
          onClick={() => void signInWithGoogle()}
          className="w-full rounded-2xl bg-beak px-6 py-4 text-xl font-bold text-cream shadow-lg hover:scale-[1.02] transition"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
