import type { IEmbeddingProvider } from "@ragx/core";

/**
 * Base embedding provider with caching
 */
export abstract class BaseEmbeddingProvider implements IEmbeddingProvider {
    protected readonly cache: Map<string, number[]>;
    protected readonly batchSize: number;

    constructor(options?: { batchSize?: number }) {
        this.cache = new Map();
        this.batchSize = options?.batchSize || 100;
    }

    abstract embed(texts: string[]): Promise<number[][]>;
    abstract getDimensions(): number;

    /**
     * Generate cache key for text
     */
    protected getCacheKey(text: string): string {
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(text);
        return hasher.digest("hex");
    }

    /**
     * Get embeddings with caching
     */
    protected async embedWithCache(texts: string[]): Promise<number[][]> {
        const results: number[][] = [];
        const uncachedTexts: string[] = [];
        const uncachedIndices: number[] = [];

        // Check cache
        for (const [index, text] of texts.entries()) {
            const cacheKey = this.getCacheKey(text);
            const cached = this.cache.get(cacheKey);

            if (cached) {
                results[index] = cached;
            } else {
                uncachedTexts.push(text);
                uncachedIndices.push(index);
            }
        }

        // Generate embeddings for uncached texts
        if (uncachedTexts.length > 0) {
            const embeddings = await this.embed(uncachedTexts);

            for (const [i, embedding] of embeddings.entries()) {
                const originalIndex = uncachedIndices[i];
                if (originalIndex !== undefined) {
                    results[originalIndex] = embedding;

                    // Cache the result
                    const cacheKey = this.getCacheKey(uncachedTexts[i] || "");
                    this.cache.set(cacheKey, embedding);
                }
            }
        }

        return results;
    }

    /**
     * Process texts in batches
     */
    protected async processBatches(
        texts: string[],
        embedFn: (batch: string[]) => Promise<number[][]>,
    ): Promise<number[][]> {
        const results: number[][] = [];

        for (let i = 0; i < texts.length; i += this.batchSize) {
            const batch = texts.slice(i, i + this.batchSize);
            const batchEmbeddings = await embedFn(batch);
            results.push(...batchEmbeddings);
        }

        return results;
    }
}
