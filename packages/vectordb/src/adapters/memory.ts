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
    /**
     * Search for similar vectors or by keyword
     */
    async search(
        vector: number[] | undefined,
        topK: number,
        filter?: Record<string, unknown>,
        query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
        let vectorResults: Array<{ chunk: DocumentChunk; score: number }> = [];
        let keywordResults: Array<{ chunk: DocumentChunk; score: number }> = [];

        // 1. Vector Search
        if (vector) {
            const similarities = this.vectors.map(({ vector: v, chunk }) => {
                if (filter && !this.matchesFilter(chunk, filter)) {
                    return { chunk, score: -1 };
                }
                const score = this.cosineSimilarity(vector, v);
                return { chunk, score };
            });

            vectorResults = similarities
                .filter((item) => item.score >= 0)
                .sort((a, b) => b.score - a.score);
        }

        // 2. Keyword Search
        if (query) {
            const words = query.toLowerCase().split(/\s+/);
            keywordResults = this.vectors
                .map(({ chunk }) => {
                    if (filter && !this.matchesFilter(chunk, filter)) {
                        return { chunk, score: -1 };
                    }

                    const content = chunk.content.toLowerCase();
                    let matches = 0;
                    for (const word of words) {
                        if (content.includes(word)) matches++;
                    }
                    const score = matches / words.length;
                    return { chunk, score };
                })
                .filter((item) => item.score > 0)
                .sort((a, b) => b.score - a.score);
        }

        // 3. Combine results
        if (vector && query) {
            // Hybrid Search using Reciprocal Rank Fusion (RRF)
            return this.reciprocalRankFusion(vectorResults, keywordResults).slice(0, topK);
        } else if (vector) {
            return vectorResults.slice(0, topK);
        } else if (query) {
            return keywordResults.slice(0, topK);
        }

        return [];
    }

    private matchesFilter(chunk: DocumentChunk, filter: Record<string, unknown>): boolean {
        return Object.entries(filter).every(([key, value]) => {
            return chunk.metadata[key] === value;
        });
    }

    /**
     * Reciprocal Rank Fusion (RRF)
     * score = sum(1 / (k + rank))
     */
    private reciprocalRankFusion(
        vectorResults: Array<{ chunk: DocumentChunk; score: number }>,
        keywordResults: Array<{ chunk: DocumentChunk; score: number }>,
        k = 60,
    ): Array<{ chunk: DocumentChunk; score: number }> {
        const scores = new Map<string, { chunk: DocumentChunk; score: number }>();

        // Rank by vector score
        vectorResults.forEach((res, index) => {
            const rank = index + 1;
            const rrfScore = 1 / (k + rank);
            scores.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
        });

        // Rank by keyword score and combine
        keywordResults.forEach((res, index) => {
            const rank = index + 1;
            const rrfScore = 1 / (k + rank);
            const existing = scores.get(res.chunk.id);
            if (existing) {
                existing.score += rrfScore;
            } else {
                scores.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
            }
        });

        return Array.from(scores.values())
            .sort((a, b) => b.score - a.score);
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
