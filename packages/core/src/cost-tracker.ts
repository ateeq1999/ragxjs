export interface ModelUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface EstimatedCost {
    amount: number;
    currency: string;
    model: string;
}

/**
 * Maps model names to price per 1M tokens (USD)
 */
const PRICE_MAP: Record<string, { prompt: number; completion: number }> = {
    // OpenAI
    "gpt-4-turbo": { prompt: 10.0, completion: 30.0 },
    "gpt-4": { prompt: 30.0, completion: 60.0 },
    "gpt-3.5-turbo": { prompt: 0.5, completion: 1.5 },
    "text-embedding-3-small": { prompt: 0.02, completion: 0.02 },
    "text-embedding-3-large": { prompt: 0.13, completion: 0.13 },

    // Anthropic
    "claude-3-opus-20240229": { prompt: 15.0, completion: 75.0 },
    "claude-3-sonnet-20240229": { prompt: 3.0, completion: 15.0 },
    "claude-3-haiku-20240307": { prompt: 0.25, completion: 1.25 },

    // Cohere
    "command-r": { prompt: 0.5, completion: 1.5 },
    "command-r-plus": { prompt: 3.0, completion: 15.0 },

    // Google
    "gemini-1.5-pro": { prompt: 3.5, completion: 10.5 },
    "gemini-1.5-flash": { prompt: 0.35, completion: 1.05 },
};

/**
 * Utility for tracking and estimating LLM costs
 */
export class CostTracker {
    /**
     * Estimate cost based on usage and model
     */
    static estimate(model: string, usage: ModelUsage): EstimatedCost {
        const prices = PRICE_MAP[model] || { prompt: 0, completion: 0 };

        const promptCost = (usage.promptTokens / 1_000_000) * prices.prompt;
        const completionCost = (usage.completionTokens / 1_000_000) * prices.completion;

        return {
            amount: Number((promptCost + completionCost).toFixed(6)),
            currency: "USD",
            model,
        };
    }

    /**
     * Format cost for display
     */
    static format(cost: EstimatedCost): string {
        return `${cost.amount.toFixed(4)} ${cost.currency}`;
    }
}
