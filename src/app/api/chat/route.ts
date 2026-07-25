import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { pickProvider, isConfigured } from "@/lib/openrouter";
import { FINANCE_TOOL_DEFINITIONS, runFinanceTool } from "@/lib/finance-tools";
import { MARKET_TOOL_DEFINITIONS, runMarketTool } from "@/lib/market";

const SYSTEM_PROMPT = `You are the Financial Planner agent inside a personal finance planning tool.

Your job in a conversation:
1. Understand the user's goal (e.g. retirement, buying a house, an emergency fund) and time horizon.
2. Get a rough sense of their risk tolerance if it's relevant to the question — don't interrogate them with a long questionnaire, just ask naturally.
3. For ANY numeric calculation (future value, required monthly savings, retirement projections), you MUST call the matching tool. Never compute financial math yourself — you will get it wrong on compounding. Use round, sensible default assumptions (state them) if the user hasn't given a number, e.g. a 7% long-term annual return for a diversified stock portfolio, unless they tell you otherwise.
4. If the user asks about a specific stock, ETF, or fund price, call get_stock_quote — never guess or recall a price from memory, it will be stale.
5. If the user asks how to divide up income or wants a simple budgeting framework, call budget_split_50_20_30. If they ask about stock/bond mix for their age or investment risk appropriate for their age, call age_based_asset_allocation.
6. Keep replies short and concrete. Show the key number first, then 1-3 sentences of context.
7. You are not a licensed financial advisor and this is not regulated financial advice. Say so briefly the first time you give a concrete recommendation in a conversation, then don't repeat it every message.
8. Be honest about uncertainty (market returns are not guaranteed) but don't be so hedgy that the answer becomes useless.
9. Where relevant to what the user is asking (not forced into every reply), you can also offer these practical habits: put a purchase on a "wait list" and revisit it after a cooling-off period instead of buying immediately; audit phone subscriptions for ones no longer used; set a reminder to cancel free trials before they convert to paid; avoid shopping decisions when hungry or tired since it skews toward impulse buying; consider paying a specialist for tasks outside your strengths so your own time goes toward higher-value work. These are conversational suggestions, not tool calls.`;

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!isConfigured()) {
    return Response.json(
      { error: "OPENROUTER_API_KEYS is not configured on the server." },
      { status: 500 }
    );
  }

  const { messages } = (await request.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const tools = [...FINANCE_TOOL_DEFINITIONS, ...MARKET_TOOL_DEFINITIONS];

  const conversation: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ];

  const toolCallsUsed: { name: string; input: unknown; output: unknown }[] = [];
  let lastModel = "";

  for (let turn = 0; turn < 6; turn++) {
    // Each turn picks the next account/model in rotation so concurrent
    // sessions spread across configured OpenRouter keys and models.
    const { client, model } = pickProvider();
    lastModel = model;

    let response;
    try {
      response = await client.chat.completions.create({
        model,
        max_tokens: 1024,
        tools,
        messages: conversation,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenRouter request failed";
      return Response.json({ error: `[${model}] ${message}` }, { status: 502 });
    }

    const choice = response.choices[0];
    const message = choice.message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return Response.json({
        reply: message.content ?? "",
        toolCalls: toolCallsUsed,
        model: lastModel,
      });
    }

    conversation.push(message);

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;

      const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      let output: unknown;
      try {
        output =
          (await runMarketTool(toolCall.function.name, input)) ??
          runFinanceTool(toolCall.function.name, input) ?? {
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      } catch (err) {
        output = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }

      toolCallsUsed.push({ name: toolCall.function.name, input, output });
      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(output),
      });
    }
  }

  return Response.json(
    { error: "The agent didn't finish in time — try rephrasing your question." },
    { status: 500 }
  );
}
