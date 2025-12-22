import type { DocumentChunk, IVectorStore } from "@ragx/core";

/**
 * In-memory vector store for development
 * WARNING: No persistence, data is lost on restart
 */
export class MemoryVectorStore implements IVectorStore {
    private vectors: Array<{ vector: number[]; chunk: DocumentChunk }> = [];

    /**
     * Add vectors with metadata
     */
    async add(vectors: number[][], metadata: DocumentChunk[]): Promise<void> {
        if (vectors.length !== metadata.length) {
            throw new Error("Vectors and metadata length mismatch");
        }

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const chunk = metadata[i];
            if (vector && chunk) {
                this.vectors.push({ vector, chunk });
            }
        }
    }

    /**
     * Search for similar vectors using cosine similarity
     */
    async search(
        vector: number[],
        topK: number,
        filter?: Record<string, unknown>,
        _query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
        // Calculate cosine similarity for all vectors
        const similarities = this.vectors.map(({ vector: v, chunk }) => {
            // Apply filter if provided
            if (filter) {
                const matches = Object.entries(filter).every(([key, value]) => {
                    return chunk.metadata[key] === value;
                });
                if (!matches) {
                    return { chunk, score: -1 };
                }
            }

            const score = this.cosineSimilarity(vector, v);
            return { chunk, score };
        });

        // Filter out non-matches and sort by score
        const results = similarities
            .filter((item) => item.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        return results;
    }

    /**
     * Delete vectors by document IDs
     */
    async delete(documentIds: string[]): Promise<void> {
        this.vectors = this.vectors.filter(
            ({ chunk }) => !documentIds.includes(chunk.documentId),
        );
    }

    /**
     * Get collection info
     */
    async getInfo(): Promise<{ count: number; dimensions: number }> {
        const dimensions = this.vectors[0]?.vector.length || 0;
        return {
            count: this.vectors.length,
            dimensions,
        };
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error("Vectors must have same dimensions");
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            const aVal = a[i] || 0;
            const bVal = b[i] || 0;
            dotProduct += aVal * bVal;
            normA += aVal * aVal;
            normB += bVal * bVal;
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) {
            return 0;
        }

        return dotProduct / denominator;
    }

    /**
     * Clear all vectors (useful for testing)
     */
    async clear(): Promise<void> {
        this.vectors = [];
    }
}
