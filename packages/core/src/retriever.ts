import type { DocumentChunk, IEmbeddingProvider, IRetriever, IVectorStore, RetrievedDocument } from "./interfaces";

/**
 * Retriever implementation
 */
export class Retriever implements IRetriever {
    constructor(
        private readonly vectorStore: IVectorStore,
        private readonly embeddingProvider: IEmbeddingProvider,
    ) { }

    /**
     * Retrieve relevant documents for a query
     */
    async retrieve(
        query: string,
        topK = 5,
        scoreThreshold = 0.7,
    ): Promise<RetrievedDocument[]> {
        // Generate query embedding
        const [queryEmbedding] = await this.embeddingProvider.embed([query]);

        if (!queryEmbedding) {
            throw new Error("Failed to generate query embedding");
        }

        // Search vector store
        const results = await this.vectorStore.search(queryEmbedding, topK);

        // Filter by score threshold and format results
        const retrieved = results
            .filter((result) => result.score >= scoreThreshold)
            .map((result) => ({
                chunk: result.chunk,
                score: result.score,
                source: result.chunk.metadata.source as string || "unknown",
            }))
            .sort((a, b) => b.score - a.score); // Deterministic ordering by score (RAGX rule)

        return retrieved;
    }

    /**
     * Add documents to the vector store
     */
    async addDocuments(chunks: DocumentChunk[], embeddings: number[][]): Promise<void> {
        if (chunks.length !== embeddings.length) {
            throw new Error("Number of chunks must match number of embeddings");
        }

        await this.vectorStore.add(embeddings, chunks);
    }

    /**
     * Delete documents by IDs
     */
    async deleteDocuments(documentIds: string[]): Promise<void> {
        await this.vectorStore.delete(documentIds);
    }
}
