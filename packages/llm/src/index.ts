import type { ModelConfig } from "@ragx/config";
import type { ILLMProvider } from "@ragx/core";
import { MistralProvider } from "./providers/mistral";
import { OpenAIProvider } from "./providers/openai";

/**
 * Create LLM provider from configuration
 */
export function createLLMProvider(config: ModelConfig, apiKey: string): ILLMProvider {
    switch (config.provider) {
        case "openai":
            return new OpenAIProvider(apiKey, config.model);
        case "mistral":
            return new MistralProvider(apiKey, config.model);
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

// Re-export providers
export { BaseLLMProvider } from "./base";
export { OpenAIProvider } from "./providers/openai";
export { MistralProvider } from "./providers/mistral";
