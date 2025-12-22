
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ILLMProvider, LLMResponse } from "@ragx/core";

export class GoogleProvider implements ILLMProvider {
    private client: GoogleGenerativeAI;
    private model: string;

    constructor(config: { apiKey: string; model?: string }) {
        this.client = new GoogleGenerativeAI(config.apiKey);
        this.model = config.model || "gemini-pro";
    }

    async generate(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): Promise<LLMResponse> {
        const model = this.client.getGenerativeModel({ model: this.model });

        const generationConfig: { temperature?: number; maxOutputTokens?: number } = {};
        if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
        if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
        });

        const response = await result.response;
        const text = response.text();

        // Gemini doesn't always provide usage in standard response object easily without beta API
        // For MVP we might default usage to 0 or estimate if needed
        return {
            content: text,
            model: this.model,
            // usage: { ... } // Todo: Add usage when available in stable SDK
        };
    }

    async *generateStream(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): AsyncGenerator<string, void, unknown> {
        const model = this.client.getGenerativeModel({ model: this.model });

        const generationConfig: { temperature?: number; maxOutputTokens?: number } = {};
        if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
        if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;

        const result = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
        });

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            yield chunkText;
        }
    }
}
