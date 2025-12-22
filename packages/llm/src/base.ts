import type { ILLMProvider, LLMResponse } from "@ragx/core";

/**
 * Base LLM provider with retry logic
 */
export abstract class BaseLLMProvider implements ILLMProvider {
    protected readonly maxRetries: number;
    protected readonly retryDelay: number;

    constructor(options?: { maxRetries?: number; retryDelay?: number }) {
        this.maxRetries = options?.maxRetries || 3;
        this.retryDelay = options?.retryDelay || 1000;
    }

    abstract generate(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): Promise<LLMResponse>;

    abstract generateStream(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): AsyncGenerator<string, void, unknown>;

    /**
     * Retry wrapper with exponential backoff
     */
    protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                // Don't retry on certain errors (e.g., invalid API key)
                if (this.isNonRetryableError(error)) {
                    throw error;
                }

                if (attempt < this.maxRetries - 1) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error("Max retries exceeded");
    }

    /**
     * Check if error should not be retried
     */
    protected isNonRetryableError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (
                message.includes("invalid api key") ||
                message.includes("unauthorized") ||
                message.includes("forbidden")
            );
        }
        return false;
    }
}
