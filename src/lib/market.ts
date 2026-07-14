import YahooFinance from "yahoo-finance2";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const yahooFinance = new YahooFinance();

export const MARKET_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_stock_quote",
      description:
        "Look up the current real market price and recent performance for a stock or ETF ticker (e.g. AAPL, VOO, SPY). Use this whenever the user asks about a specific holding or wants a real price instead of a guess.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Ticker symbol, e.g. AAPL or VOO." },
        },
        required: ["symbol"],
      },
    },
  },
];

interface QuoteFields {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  currency?: string;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketTime?: Date;
}

export async function getStockQuote(symbol: string) {
  const quote = (await yahooFinance.quote(symbol)) as QuoteFields;
  if (!quote || quote.regularMarketPrice == null) {
    return { error: `No quote found for symbol "${symbol}".` };
  }

  return {
    symbol: quote.symbol,
    name: quote.shortName ?? quote.longName ?? quote.symbol,
    price: quote.regularMarketPrice,
    currency: quote.currency,
    change: quote.regularMarketChange,
    change_percent: quote.regularMarketChangePercent,
    day_high: quote.regularMarketDayHigh,
    day_low: quote.regularMarketDayLow,
    fifty_two_week_high: quote.fiftyTwoWeekHigh,
    fifty_two_week_low: quote.fiftyTwoWeekLow,
    as_of: quote.regularMarketTime,
  };
}

export async function runMarketTool(name: string, input: Record<string, unknown>) {
  if (name === "get_stock_quote") {
    return getStockQuote(String(input.symbol));
  }
  return null;
}
