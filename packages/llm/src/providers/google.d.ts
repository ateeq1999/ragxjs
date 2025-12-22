import type { ILLMProvider, LLMResponse } from "@ragx/core";
export declare class GoogleProvider implements ILLMProvider {
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
//# sourceMappingURL=google.d.ts.map