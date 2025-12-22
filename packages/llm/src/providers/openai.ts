import type { LLMResponse } from "@ragx/core";
import OpenAI from "openai";
import { BaseLLMProvider } from "../base";

/**
 * OpenAI LLM provider
 */
export class OpenAIProvider extends BaseLLMProvider {
    private readonly client: OpenAI;
    private readonly model: string;

    constructor(apiKey: string, model = "gpt-4-turbo") {
        super();
        this.client = new OpenAI({ apiKey });
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
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: "user", content: prompt }],
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
            });

            const choice = completion.choices[0];
            if (!choice?.message?.content) {
                throw new Error("No content in OpenAI response");
            }

            return {
                content: choice.message.content || "",
                model: completion.model,
                ...(completion.usage
                    ? {
                        usage: {
                            promptTokens: completion.usage.prompt_tokens,
                            completionTokens: completion.usage.completion_tokens,
                            totalTokens: completion.usage.total_tokens,
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
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: "user", content: prompt }],
            ...(options?.temperature ? { temperature: options.temperature } : {}),
            ...(options?.maxTokens ? { max_tokens: options.maxTokens as number } : {}),
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }
}
