import type { DocumentChunk, IEmbeddingProvider, IRetriever, IVectorStore, RetrievedDocument, IReranker, IDocumentStore } from "./interfaces";
import type { RetrievalConfig } from "@ragx/config";

/**
 * Retriever implementation
 */
export class Retriever implements IRetriever {
    constructor(
        private readonly vectorStore: IVectorStore,
        private readonly embeddingProvider: IEmbeddingProvider,
        private readonly reranker?: IReranker,
        private readonly config?: RetrievalConfig,
        private readonly docStore?: IDocumentStore,
    ) { }

    /**
     * Retrieve relevant documents for a query
     */
    async retrieve(
        query: string,
        topK = 5,
        scoreThreshold = 0.7,
    ): Promise<RetrievedDocument[]> {
        const strategy = this.config?.strategy || "vector";
        let queryEmbedding: number[] | undefined;

        // Generate query embedding only if needed for vector or hybrid search
        if (strategy === "vector" || strategy === "hybrid") {
            const embeddings = await this.embeddingProvider.embed([query]);
            queryEmbedding = embeddings[0];

            if (!queryEmbedding && strategy === "vector") {
                throw new Error("Failed to generate query embedding for vector search");
            }
        }

        // If reranking is enabled, we should fetch more candidates initially
        const initialK = this.reranker ? Math.max(topK * 4, 20) : topK;

        // Search vector store
        // We pass query for hybrid/keyword, and vector for vector/hybrid
        const results = await this.vectorStore.search(
            queryEmbedding,
            initialK,
            undefined,
            (strategy === "keyword" || strategy === "hybrid") ? query : undefined
        );

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

        const retrieved = results
            .filter((result) => result.score >= scoreThreshold)
            .map((result) => ({
                chunk: result.chunk,
                score: result.score,
                source: result.chunk.metadata.source as string || "unknown",
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        // Final Step: Parent Document Retrieval
        if (this.docStore && retrieved.length > 0) {
            const parentResults: RetrievedDocument[] = [];
            const seenParentIds = new Set<string>();

            for (const res of retrieved) {
                const parentId = res.chunk.metadata.parentId as string || res.chunk.documentId;

                if (seenParentIds.has(parentId)) continue;
                seenParentIds.add(parentId);

                const parentDoc = await this.docStore.get(parentId);
                if (parentDoc) {
                    parentResults.push({
                        ...res,
                        chunk: {
                            ...res.chunk,
                            content: parentDoc.content, // Return parent content
                        }
                    });
                } else {
                    parentResults.push(res);
                }
            }
            return parentResults;
        }

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
        if (this.docStore) {
            await this.docStore.delete(documentIds);
        }
    }
}
