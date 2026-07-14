"use client";

import { useRef, useState, type FormEvent } from "react";

type Role = "user" | "assistant";
type ToolCall = { name: string; input: unknown; output: unknown };
type Message = { role: Role; content: string; toolCalls?: ToolCall[]; model?: string };
type Mode = "menu" | "chat";
type CardKey = "retirement" | "savings-goal" | "stock" | "chat";

const TOOL_LABEL: Record<string, string> = {
  future_value: "Projected future value",
  present_value_needed: "Lump sum needed",
  monthly_savings_for_goal: "Monthly savings needed",
  retirement_projection: "Retirement projection",
  get_stock_quote: "Live stock quote",
};

const CARDS: {
  key: CardKey;
  icon: string;
  title: string;
  description: string;
  accent: string;
}[] = [
  {
    key: "retirement",
    icon: "🏖️",
    title: "Retirement readiness",
    description: "See if your savings will fund your target retirement income.",
    accent: "bg-indigo-50 dark:bg-indigo-500/10",
  },
  {
    key: "savings-goal",
    icon: "🎯",
    title: "Savings goal",
    description: "Find the monthly amount needed to hit a target by a date.",
    accent: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    key: "stock",
    icon: "📈",
    title: "Stock / ETF price",
    description: "Look up a real, live quote for any ticker.",
    accent: "bg-amber-50 dark:bg-amber-500/10",
  },
  {
    key: "chat",
    icon: "💬",
    title: "Just chat",
    description: "Ask anything in your own words.",
    accent: "bg-slate-100 dark:bg-slate-500/10",
  },
];

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
  );
}

function RetirementForm({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [age, setAge] = useState("30");
  const [retireAge, setRetireAge] = useState("65");
  const [savings, setSavings] = useState("10000");
  const [monthly, setMonthly] = useState("500");
  const [income, setIncome] = useState("60000");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(
      `I'm ${age} years old and want to retire at ${retireAge} with $${income}/year in income. ` +
        `I currently have $${savings} saved and add $${monthly}/month. ` +
        `Assume a 7% annual return and a 4% withdrawal rule unless a different assumption fits better. Am I on track?`
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <NumberField label="Current age" value={age} onChange={setAge} />
      <NumberField label="Retirement age" value={retireAge} onChange={setRetireAge} />
      <NumberField label="Current savings ($)" value={savings} onChange={setSavings} />
      <NumberField label="Monthly contribution ($)" value={monthly} onChange={setMonthly} />
      <div className="col-span-2">
        <NumberField label="Desired annual retirement income ($)" value={income} onChange={setIncome} />
      </div>
      <button
        type="submit"
        className="col-span-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Check readiness
      </button>
    </form>
  );
}

function SavingsGoalForm({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [target, setTarget] = useState("50000");
  const [current, setCurrent] = useState("0");
  const [years, setYears] = useState("5");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(
      `I want to have $${target} in ${years} years. I currently have $${current} saved. ` +
        `Assuming a 7% annual return, how much do I need to save monthly to hit that goal?`
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <NumberField label="Target amount ($)" value={target} onChange={setTarget} />
      </div>
      <NumberField label="Already saved ($)" value={current} onChange={setCurrent} />
      <NumberField label="Years to reach it" value={years} onChange={setYears} />
      <button
        type="submit"
        className="col-span-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Calculate monthly savings
      </button>
    </form>
  );
}

function StockForm({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [symbol, setSymbol] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) return;
    onSubmit(`What is the current price of ${symbol.trim().toUpperCase()}?`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
        Ticker symbol
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. VOO, AAPL, SPY"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={!symbol.trim()}
        className="rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
      >
        Get live quote
      </button>
    </form>
  );
}

export default function Chat() {
  const [mode, setMode] = useState<Mode>("menu");
  const [activeForm, setActiveForm] = useState<CardKey | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: data.reply, toolCalls: data.toolCalls, model: data.model },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  function selectCard(key: CardKey) {
    if (key === "chat") {
      setMode("chat");
      return;
    }
    setActiveForm(key);
  }

  function submitFromForm(message: string) {
    setActiveForm(null);
    setMode("chat");
    send(message);
  }

  function backToMenu() {
    setMode("menu");
    setActiveForm(null);
    setMessages([]);
    setError(null);
  }

  if (mode === "menu") {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CARDS.map((card) => (
            <button
              key={card.key}
              onClick={() => selectCard(card.key)}
              className={`flex flex-col items-start gap-2 rounded-2xl border border-slate-200 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 ${
                activeForm === card.key ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${card.accent}`}>
                {card.icon}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</span>
              <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {card.description}
              </span>
            </button>
          ))}
        </div>

        {activeForm && activeForm !== "chat" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {activeForm === "retirement" && <RetirementForm onSubmit={submitFromForm} />}
            {activeForm === "savings-goal" && <SavingsGoalForm onSubmit={submitFromForm} />}
            {activeForm === "stock" && <StockForm onSubmit={submitFromForm} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <button
        onClick={backToMenu}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
      >
        ← Menu
      </button>

      <div
        ref={scrollRef}
        className="flex h-[60vh] flex-col gap-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ask a real planning question — every number comes from a calculation tool
              or a live market quote, not a guess.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {m.content}
              {((m.toolCalls && m.toolCalls.length > 0) || m.model) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-300/50 pt-2 dark:border-slate-600/50">
                  {m.toolCalls?.map((tc, j) => (
                    <span
                      key={j}
                      title={JSON.stringify(tc.output, null, 2)}
                      className="cursor-help rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    >
                      🔧 {TOOL_LABEL[tc.name] ?? tc.name}
                    </span>
                  ))}
                  {m.model && (
                    <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                      via {m.model}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about savings, retirement, or a stock price…"
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
