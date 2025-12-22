import type { EmbeddingsConfig } from "@ragx/config";
import type { IEmbeddingProvider } from "@ragx/core";
import { MistralEmbeddings } from "./providers/mistral.ts";
import { OpenAIEmbeddings } from "./providers/openai.ts";

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
                model: config.model,
                dimensions: config.dimensions,
                batchSize: config.batchSize,
            });
        case "mistral":
            return new MistralEmbeddings(apiKey, {
                model: config.model,
                dimensions: config.dimensions,
                batchSize: config.batchSize,
            });
        default:
            throw new Error(`Unsupported embedding provider: ${config.provider}`);
    }
}

// Re-export providers
export { BaseEmbeddingProvider } from "./base.ts";
export { OpenAIEmbeddings } from "./providers/openai.ts";
export { MistralEmbeddings } from "./providers/mistral.ts";
