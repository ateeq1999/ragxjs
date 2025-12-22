import OpenAI from "openai";
import { BaseEmbeddingProvider } from "../base.ts";

/**
 * OpenAI embedding provider
 */
export class OpenAIEmbeddings extends BaseEmbeddingProvider {
    private readonly client: OpenAI;
    private readonly model: string;
    private readonly dimensions: number;

    constructor(
        apiKey: string,
        options?: { model?: string; dimensions?: number; batchSize?: number },
    ) {
        super({ batchSize: options?.batchSize });
        this.client = new OpenAI({ apiKey });
        this.model = options?.model || "text-embedding-3-small";
        this.dimensions = options?.dimensions || 1536;
    }

    /**
     * Generate embeddings for texts
     */
    async embed(texts: string[]): Promise<number[][]> {
        return this.processBatches(texts, async (batch) => {
            const response = await this.client.embeddings.create({
                model: this.model,
                input: batch,
                dimensions: this.dimensions,
            });

            return response.data.map((item) => item.embedding);
        });
    }

    /**
     * Get embedding dimensions
     */
    getDimensions(): number {
        return this.dimensions;
    }
}
