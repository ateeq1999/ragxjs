import type { ModelConfig } from "@ragx/config";
import type { ILLMProvider } from "@ragx/core";
import { MistralProvider } from "./providers/mistral";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";

/**
 * Create LLM provider from configuration
 */
export function createLLMProvider(config: ModelConfig, apiKey: string): ILLMProvider {
    switch (config.provider) {
        case "openai":
            return new OpenAIProvider(apiKey, config.model);
        case "mistral":
            return new MistralProvider(apiKey, config.model);
        case "anthropic":
            return new AnthropicProvider({ apiKey, model: config.model });
        case "google":
            return new GoogleProvider({ apiKey, model: config.model });
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

// Re-export providers
export { BaseLLMProvider } from "./base";
export { OpenAIProvider } from "./providers/openai";
export { MistralProvider } from "./providers/mistral";
export { AnthropicProvider } from "./providers/anthropic";
export { GoogleProvider } from "./providers/google";
