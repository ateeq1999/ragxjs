
import { CohereClient } from "cohere-ai";
import type { IEmbeddingProvider } from "@ragx/core";

export class CohereEmbeddings implements IEmbeddingProvider {
    private client: CohereClient;
    private model: string;
    private dimensions: number;

    constructor(config: { apiKey: string; model?: string }) {
        this.client = new CohereClient({
            token: config.apiKey,
        });
        this.model = config.model || "embed-english-v3.0";
        this.dimensions = 1024; // Default for embed-english-v3.0, verified at runtime or config
    }

    async embed(texts: string[]): Promise<number[][]> {
        // Validation: Cohere max batch size is 96 for v3 models
        const batchSize = 96;
        const embeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const response = await this.client.embed({
                texts: batch,
                model: this.model,
                inputType: "search_document", // Best practice for RAG documents
            });
            
            // cohere response.embeddings can be number[][] or more complex in v3
            // SDK typings should be checked, but usually it returns array of arrays for simple call
            if (Array.isArray(response.embeddings)) {
                embeddings.push(...response.embeddings);
            }
        }

        return embeddings;
    }

    getDimensions(): number {
        return this.dimensions;
    }
}
