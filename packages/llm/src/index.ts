import type { ModelConfig } from "@ragx/config";
import type { ILLMProvider, IReranker } from "@ragx/core";
import { MistralProvider } from "./providers/mistral";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";
import { CohereProvider } from "./providers/cohere";
import { OllamaProvider } from "./providers/ollama";
import { CohereReranker } from "./providers/cohere-reranker";

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
        case "cohere":
            return new CohereProvider(apiKey, config.model);
        case "ollama":
            return new OllamaProvider(config.model);
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

/**
 * Create Reranker from configuration
 */
export function createReranker(model: string, apiKey: string): IReranker {
    // Currently only Cohere is supported for reranking
    return new CohereReranker(apiKey, model);
}

// Re-export providers
export { BaseLLMProvider } from "./base";
export { OpenAIProvider } from "./providers/openai";
export { MistralProvider } from "./providers/mistral";
export { AnthropicProvider } from "./providers/anthropic";
export { GoogleProvider } from "./providers/google";
export { CohereProvider } from "./providers/cohere";
export { OllamaProvider } from "./providers/ollama";
export { CohereReranker } from "./providers/cohere-reranker";
