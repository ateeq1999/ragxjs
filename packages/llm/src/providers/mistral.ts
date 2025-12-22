import type { LLMResponse } from "@ragx/core";
import { Mistral } from "@mistralai/mistralai";
import { BaseLLMProvider } from "../base";

/**
 * Mistral LLM provider
 */
export class MistralProvider extends BaseLLMProvider {
    private readonly client: Mistral;
    private readonly model: string;

    constructor(apiKey: string, model = "mistral-large-latest") {
        super();
        this.client = new Mistral({ apiKey });
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
            const completion = await this.client.chat.complete({
                model: this.model,
                messages: [{ role: "user", content: prompt }],
                temperature: options?.temperature ?? 0.7,
                maxTokens: options?.maxTokens,
            });

            const choice = completion.choices?.[0];
            if (!choice?.message?.content) {
                throw new Error("No content in Mistral response");
            }

            return {
                content: (choice.message.content || "") as string,
                model: completion.model || this.model,
                ...(completion.usage
                    ? {
                        usage: {
                            promptTokens: completion.usage.promptTokens || 0,
                            completionTokens: completion.usage.completionTokens || 0,
                            totalTokens: completion.usage.totalTokens || 0,
                        },
                    }
                    : {}),
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
        const stream = await this.client.chat.stream({
            model: this.model,
            messages: [{ role: "user", content: prompt }],
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens,
        });

        for await (const chunk of stream) {
            const content = (chunk.data.choices[0]?.delta?.content || "") as string;
            if (content) {
                yield content;
            }
        }
    }
}
