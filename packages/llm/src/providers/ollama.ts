import type { LLMResponse } from "@ragx/core";
import { BaseLLMProvider } from "../base";

/**
 * Ollama LLM provider for local development
 */
export class OllamaProvider extends BaseLLMProvider {
    private readonly baseUrl: string;
    private readonly model: string;

    constructor(model = "llama3", baseUrl = "http://localhost:11434") {
        super();
        this.model = model;
        this.baseUrl = baseUrl;
    }

    /**
     * Generate a response
     */
    async generate(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): Promise<LLMResponse> {
        return this.withRetry(async () => {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.model,
                    prompt,
                    stream: false,
                    options: {
                        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
                        ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json() as any;

            return {
                content: data.response || "",
                model: this.model,
                usage: {
                    promptTokens: data.prompt_eval_count || 0,
                    completionTokens: data.eval_count || 0,
                    totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
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
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: this.model,
                prompt,
                stream: true,
                options: {
                    ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
                    ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader for Ollama stream");

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(l => l.trim().length > 0);

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.response) {
                        yield data.response;
                    }
                } catch (e) {
                    // Ignore partial lines
                }
            }
        }
    }
}
