
import Anthropic from "@anthropic-ai/sdk";
import type { ILLMProvider, LLMResponse } from "@ragx/core";

export class AnthropicProvider implements ILLMProvider {
    private client: Anthropic;
    private model: string;

    constructor(config: { apiKey: string; model?: string }) {
        this.client = new Anthropic({
            apiKey: config.apiKey,
        });
        this.model = config.model || "claude-3-opus-20240229";
    }

    async generate(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): Promise<LLMResponse> {
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: options?.maxTokens || 1024,
            temperature: options?.temperature || 0.7,
            messages: [{ role: "user", content: prompt }],
        });

        // The content block type needs to be checked, usually it's text
        const contentBlock = response.content[0];
        const text = contentBlock.type === "text" ? contentBlock.text : "";

        return {
            content: text,
            model: this.model,
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            },
        };
    }

    async *generateStream(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): AsyncGenerator<string, void, unknown> {
        const stream = await this.client.messages.create({
            model: this.model,
            max_tokens: options?.maxTokens || 1024,
            temperature: options?.temperature || 0.7,
            messages: [{ role: "user", content: prompt }],
            stream: true,
        });

        for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                yield chunk.delta.text;
            }
        }
    }
}
