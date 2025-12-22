import type { DocumentChunk, IReranker } from "@ragx/core";

/**
 * Cohere Reranker implementation
 */
export class CohereReranker implements IReranker {
    private readonly apiKey: string;
    private readonly model: string;

    constructor(apiKey: string, model = "rerank-english-v3.0") {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Rerank documents using Cohere API
     */
    async rerank(
        query: string,
        documents: DocumentChunk[],
        topK?: number,
    ): Promise<Array<{ index: number; score: number }>> {
        if (documents.length === 0) return [];

        const response = await fetch("https://api.cohere.ai/v1/rerank", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                model: this.model,
                documents: documents.map(d => d.content),
                top_n: topK ?? documents.length,
            }),
        });

        if (!response.ok) {
            const error = await response.json() as any;
            throw new Error(`Cohere Rerank error: ${error.message || response.statusText}`);
        }

        const data = await response.json() as any;

        return data.results.map((r: any) => ({
            index: r.index,
            score: r.relevance_score,
        }));
    }
}
