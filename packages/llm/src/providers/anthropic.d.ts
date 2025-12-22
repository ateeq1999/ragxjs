import type { ILLMProvider, LLMResponse } from "@ragx/core";
export declare class AnthropicProvider implements ILLMProvider {
    private client;
    private model;
    constructor(config: {
        apiKey: string;
        model?: string;
    });
    generate(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<LLMResponse>;
    generateStream(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): AsyncGenerator<string, void, unknown>;
}
//# sourceMappingURL=anthropic.d.ts.map