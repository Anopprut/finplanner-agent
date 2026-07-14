import Chat from "./chat";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex max-w-2xl flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Financial Planner Agent
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Not a licensed financial advisor. Every number is computed by a tool or
          pulled from a live market quote — not guessed by the model.
        </p>
      </div>
      <Chat />
    </main>
  );
}
