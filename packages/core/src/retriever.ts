import type { DocumentChunk, IEmbeddingProvider, IRetriever, IVectorStore, RetrievedDocument, IReranker } from "./interfaces";

/**
 * Retriever implementation
 */
export class Retriever implements IRetriever {
    constructor(
        private readonly vectorStore: IVectorStore,
        private readonly embeddingProvider: IEmbeddingProvider,
        private readonly reranker?: IReranker,
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

        // If reranking is enabled, we should fetch more candidates initially
        const initialK = this.reranker ? Math.max(topK * 4, 20) : topK;

        // Search vector store
        const results = await this.vectorStore.search(queryEmbedding, initialK, undefined, query);

        if (this.reranker && results.length > 0) {
            const chunks = results.map(r => r.chunk);
            const rerankedResults = await this.reranker.rerank(query, chunks, topK);

            return rerankedResults
                .map(r => ({
                    chunk: chunks[r.index]!,
                    score: r.score,
                    source: chunks[r.index]!.metadata.source as string || "unknown",
                }))
                .filter(r => r.score >= scoreThreshold);
        }

        // Filter by score threshold and format results (Standard Vector Search)
        const retrieved = results
            .filter((result) => result.score >= scoreThreshold)
            .map((result) => ({
                chunk: result.chunk,
                score: result.score,
                source: result.chunk.metadata.source as string || "unknown",
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

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
