import { Mistral } from "@mistralai/mistralai";
import { BaseEmbeddingProvider } from "../base.ts";

/**
 * Mistral embedding provider
 */
export class MistralEmbeddings extends BaseEmbeddingProvider {
    private readonly client: Mistral;
    private readonly model: string;
    private readonly dimensions: number;

    constructor(
        apiKey: string,
        options?: { model?: string; dimensions?: number; batchSize?: number },
    ) {
        super({ batchSize: options?.batchSize });
        this.client = new Mistral({ apiKey });
        this.model = options?.model || "mistral-embed";
        this.dimensions = options?.dimensions || 1024;
    }

    /**
     * Generate embeddings for texts
     */
    async embed(texts: string[]): Promise<number[][]> {
        return this.processBatches(texts, async (batch) => {
            const response = await this.client.embeddings.create({
                model: this.model,
                inputs: batch,
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
