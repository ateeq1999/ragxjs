import type { LLMResponse } from "@ragx/core";
import { BaseLLMProvider } from "../base";

/**
 * Cohere LLM provider
 */
export class CohereProvider extends BaseLLMProvider {
    private readonly apiKey: string;
    private readonly model: string;

    constructor(apiKey: string, model = "command-r-plus") {
        super();
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Generate a response
     */
    async generate(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): Promise<LLMResponse> {
        return this.withRetry(async () => {
            const response = await fetch("https://api.cohere.ai/v1/chat", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "accept": "application/json",
                },
                body: JSON.stringify({
                    message: prompt,
                    model: this.model,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens,
                }),
            });

            if (!response.ok) {
                const error = await response.json() as any;
                throw new Error(`Cohere API error: ${error.message || response.statusText}`);
            }

            const data = await response.json() as any;

            return {
                content: data.text || "",
                model: this.model,
                usage: {
                    promptTokens: data.token_count?.prompt_tokens || 0,
                    completionTokens: data.token_count?.response_tokens || 0,
                    totalTokens: data.token_count?.total_tokens || 0,
                },
            };
        });
    }

    /**
     * Generate a streaming response
     */
    async *generateStream(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): AsyncGenerator<string, void, unknown> {
        const response = await fetch("https://api.cohere.ai/v1/chat", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                "accept": "application/json",
            },
            body: JSON.stringify({
                message: prompt,
                model: this.model,
                stream: true,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
            }),
        });

        if (!response.ok) {
            throw new Error(`Cohere API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader for Cohere stream");

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(l => l.trim().length > 0);

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.event_type === "text-generation") {
                        yield data.text;
                    }
                } catch (e) {
                    // Ignore partial lines
                }
            }
        }
    }
}
