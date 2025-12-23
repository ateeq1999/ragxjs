import type { EmbeddingsConfig } from "@ragx/config";
import type { IEmbeddingProvider } from "@ragx/core";
import { MistralEmbeddings } from "./providers/mistral";
import { OpenAIEmbeddings } from "./providers/openai";
import { CohereEmbeddings } from "./providers/cohere";

/**
 * Create embedding provider from configuration
 */
export function createEmbeddingProvider(
    config: EmbeddingsConfig,
    apiKey: string,
): IEmbeddingProvider {
    switch (config.provider) {
        case "openai":
            return new OpenAIEmbeddings(apiKey, {
                ...(config.model ? { model: config.model } : {}),
                ...(config.dimensions ? { dimensions: config.dimensions } : {}),
                ...(config.batchSize ? { batchSize: config.batchSize } : {}),
            });
        case "mistral":
            return new MistralEmbeddings(apiKey, {
                ...(config.model ? { model: config.model } : {}),
                ...(config.dimensions ? { dimensions: config.dimensions } : {}),
                ...(config.batchSize ? { batchSize: config.batchSize } : {}),
            });
        case "cohere":
            return new CohereEmbeddings({
                apiKey,
                model: config.model || "no key",
            });
        default:
            throw new Error(`Unsupported embedding provider: ${config.provider}`);
    }
}

// Re-export providers
export { BaseEmbeddingProvider } from "./base";
export { OpenAIEmbeddings } from "./providers/openai";
export { MistralEmbeddings } from "./providers/mistral";
export { CohereEmbeddings } from "./providers/cohere";
