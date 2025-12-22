
import { Pinecone } from "@pinecone-database/pinecone";
import type { IVectorStore, DocumentChunk } from "@ragx/core";

export interface PineconeConfig {
    apiKey: string;
    index: string;
    namespace?: string;
}

export class PineconeStore implements IVectorStore {
    private client: Pinecone;
    private indexName: string;
    private namespace: string;

    constructor(config: PineconeConfig) {
        this.client = new Pinecone({
            apiKey: config.apiKey,
        });
        this.indexName = config.index;
        this.namespace = config.namespace || ""; // Default namespace
    }

    async add(vectors: number[][], chunks: DocumentChunk[]): Promise<void> {
        const index = this.client.index(this.indexName);
        const ns = index.namespace(this.namespace);

        const records = chunks.map((chunk, i) => ({
            id: chunk.id,
            values: vectors[i] || [],
            metadata: {
                ...chunk.metadata,
                content: chunk.content, // duplicative but useful if pinecone is source of truth
                documentId: chunk.documentId,
                source: chunk.metadata.source as string, // Ensure string type for metadata
            },
        }));

        // Batch upsert (Pinecone limit is usually 100-1000 records per request)
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            await ns.upsert(batch);
        }
    }

    async search(
        vector: number[],
        topK: number,
        filter?: Record<string, unknown>,
        _query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
        const index = this.client.index(this.indexName);
        const ns = index.namespace(this.namespace);

        const results = await ns.query({
            vector,
            topK,
            filter: filter as any, // Pinecone filter types are strict, casting for now
            includeMetadata: true,
        });

        return results.matches.map((match) => ({
            score: match.score || 0,
            chunk: {
                id: match.id,
                content: (match.metadata?.content as string) || "",
                documentId: (match.metadata?.documentId as string) || "",
                position: 0, // Metadata storage usually lossy for exact struct, need robust serialization if full hydration needed
                tokenCount: 0,
                checksum: "",
                createdAt: new Date(),
                metadata: match.metadata || {},
            },
        }));
    }

    async delete(documentIds: string[]): Promise<void> {
        const index = this.client.index(this.indexName);
        const ns = index.namespace(this.namespace);

        // Delete by ID is supported, but if mapped to documentIds we might need to find chunk IDs first
        // Assuming checkIds are what's passed or used? 
        // Interface says `documentIds`. In `add`, we used `chunk.id`.
        // If we want to delete by documentId, we need delete by filter.

        await ns.deleteMany({
            filter: {
                documentId: { $in: documentIds }
            }
        });
    }

    async getInfo(): Promise<{ count: number; dimensions: number }> {
        const indexDescription = await this.client.describeIndex(this.indexName);
        const dimensions = indexDescription.dimension || 0;

        // Exact count per namespace is expensive, usually we get total stats
        const stats = await this.client.index(this.indexName).describeIndexStats();
        const count = stats.namespaces?.[this.namespace]?.recordCount || 0;

        return { count, dimensions };
    }
}
