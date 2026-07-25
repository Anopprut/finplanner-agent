import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Deterministic math — the model must call these instead of computing by hand.

export function futureValue(params: {
  presentValue: number;
  monthlyContribution: number;
  annualRatePercent: number;
  years: number;
}) {
  const { presentValue, monthlyContribution, annualRatePercent, years } = params;
  const monthlyRate = annualRatePercent / 100 / 12;
  const months = years * 12;

  const fvOfPresent = presentValue * Math.pow(1 + monthlyRate, months);
  const fvOfContributions =
    monthlyRate === 0
      ? monthlyContribution * months
      : monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

  const totalContributed = presentValue + monthlyContribution * months;
  const futureValue = fvOfPresent + fvOfContributions;

  return {
    future_value: round2(futureValue),
    total_contributed: round2(totalContributed),
    total_growth: round2(futureValue - totalContributed),
    months,
  };
}

export function presentValueNeeded(params: {
  targetFutureValue: number;
  annualRatePercent: number;
  years: number;
}) {
  const { targetFutureValue, annualRatePercent, years } = params;
  const monthlyRate = annualRatePercent / 100 / 12;
  const months = years * 12;
  const pv = targetFutureValue / Math.pow(1 + monthlyRate, months);
  return { present_value_needed: round2(pv), months };
}

export function monthlySavingsForGoal(params: {
  targetFutureValue: number;
  presentValue: number;
  annualRatePercent: number;
  years: number;
}) {
  const { targetFutureValue, presentValue, annualRatePercent, years } = params;
  const monthlyRate = annualRatePercent / 100 / 12;
  const months = years * 12;

  const fvOfPresent = presentValue * Math.pow(1 + monthlyRate, months);
  const remaining = targetFutureValue - fvOfPresent;

  if (remaining <= 0) {
    return {
      required_monthly_contribution: 0,
      note: "Present value alone already reaches the target at this rate.",
    };
  }

  const annuityFactor =
    monthlyRate === 0 ? months : (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;

  return {
    required_monthly_contribution: round2(remaining / annuityFactor),
    months,
  };
}

export function retirementProjection(params: {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  annualRatePercent: number;
  desiredAnnualIncome: number;
  withdrawalRatePercent: number;
}) {
  const {
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    annualRatePercent,
    desiredAnnualIncome,
    withdrawalRatePercent,
  } = params;

  const years = retirementAge - currentAge;
  if (years <= 0) {
    throw new Error("retirementAge must be greater than currentAge");
  }

  const projected = futureValue({
    presentValue: currentSavings,
    monthlyContribution,
    annualRatePercent,
    years,
  });

  const nestEggNeeded = desiredAnnualIncome / (withdrawalRatePercent / 100);
  const shortfall = nestEggNeeded - projected.future_value;

  return {
    years_to_retirement: years,
    projected_nest_egg: projected.future_value,
    total_contributed: projected.total_contributed,
    nest_egg_needed: round2(nestEggNeeded),
    shortfall: round2(Math.max(shortfall, 0)),
    on_track: shortfall <= 0,
  };
}

export function budgetSplit503020(params: { monthlyIncome: number }) {
  const { monthlyIncome } = params;
  return {
    needs_50_percent: round2(monthlyIncome * 0.5),
    savings_20_percent: round2(monthlyIncome * 0.2),
    wants_30_percent: round2(monthlyIncome * 0.3),
  };
}

export function ageBasedAssetAllocation(params: { age: number }) {
  const { age } = params;
  const stockPercent = Math.max(0, Math.min(100, 100 - age));
  const bondPercent = 100 - stockPercent;
  return {
    stock_percent: stockPercent,
    bond_percent: bondPercent,
    rule: "100 minus age = suggested stock allocation; a simplified heuristic that gets more conservative as you get older, not personalized advice.",
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const FINANCE_TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "future_value",
      description:
        "Compute the future value of a lump sum plus recurring monthly contributions, compounded monthly at a given annual rate. Use this for any 'how much will I have' question.",
      parameters: {
        type: "object",
        properties: {
          presentValue: { type: "number", description: "Starting lump sum, in the user's currency." },
          monthlyContribution: { type: "number", description: "Amount added every month." },
          annualRatePercent: { type: "number", description: "Expected annual return, as a percent (e.g. 7 for 7%)." },
          years: { type: "number", description: "Number of years to project forward." },
        },
        required: ["presentValue", "monthlyContribution", "annualRatePercent", "years"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "present_value_needed",
      description:
        "Compute the lump sum needed today to reach a target future value at a given annual rate, with no further contributions.",
      parameters: {
        type: "object",
        properties: {
          targetFutureValue: { type: "number" },
          annualRatePercent: { type: "number" },
          years: { type: "number" },
        },
        required: ["targetFutureValue", "annualRatePercent", "years"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "monthly_savings_for_goal",
      description:
        "Compute the required monthly contribution to reach a target future value, given a starting balance, rate, and time horizon. Use this for 'how much should I save per month' questions.",
      parameters: {
        type: "object",
        properties: {
          targetFutureValue: { type: "number" },
          presentValue: { type: "number" },
          annualRatePercent: { type: "number" },
          years: { type: "number" },
        },
        required: ["targetFutureValue", "presentValue", "annualRatePercent", "years"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "retirement_projection",
      description:
        "Project whether current savings and contributions will fund a target annual retirement income, using a withdrawal-rate rule (e.g. 4%). Use this for retirement-readiness questions.",
      parameters: {
        type: "object",
        properties: {
          currentAge: { type: "number" },
          retirementAge: { type: "number" },
          currentSavings: { type: "number" },
          monthlyContribution: { type: "number" },
          annualRatePercent: { type: "number" },
          desiredAnnualIncome: { type: "number", description: "Desired annual income in retirement, in today's money." },
          withdrawalRatePercent: {
            type: "number",
            description: "Safe withdrawal rate as a percent, e.g. 4 for the classic 4% rule.",
          },
        },
        required: [
          "currentAge",
          "retirementAge",
          "currentSavings",
          "monthlyContribution",
          "annualRatePercent",
          "desiredAnnualIncome",
          "withdrawalRatePercent",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "budget_split_50_20_30",
      description:
        "Split a monthly income into the 50/30/20-style budget: 50% necessary expenses, 20% savings, 30% discretionary wants. Use this when the user asks how to divide up their income or wants a simple budgeting framework.",
      parameters: {
        type: "object",
        properties: {
          monthlyIncome: { type: "number", description: "Take-home monthly income, in the user's currency." },
        },
        required: ["monthlyIncome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "age_based_asset_allocation",
      description:
        "Suggest a stock/bond split using the '100 minus age' rule of thumb. Use this when the user asks how much of their portfolio should be in stocks vs bonds, or about investment risk appropriate for their age.",
      parameters: {
        type: "object",
        properties: {
          age: { type: "number", description: "The user's current age." },
        },
        required: ["age"],
      },
    },
  },
];

export function runFinanceTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case "future_value":
      return futureValue(input as Parameters<typeof futureValue>[0]);
    case "present_value_needed":
      return presentValueNeeded(input as Parameters<typeof presentValueNeeded>[0]);
    case "monthly_savings_for_goal":
      return monthlySavingsForGoal(input as Parameters<typeof monthlySavingsForGoal>[0]);
    case "retirement_projection":
      return retirementProjection(input as Parameters<typeof retirementProjection>[0]);
    case "budget_split_50_20_30":
      return budgetSplit503020(input as Parameters<typeof budgetSplit503020>[0]);
    case "age_based_asset_allocation":
      return ageBasedAssetAllocation(input as Parameters<typeof ageBasedAssetAllocation>[0]);
    default:
      return null;
  }
}
