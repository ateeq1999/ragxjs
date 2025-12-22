import type { DocumentChunk, IVectorStore } from "@ragx/core";
import { ChromaClient } from "chromadb";

/**
 * ChromaDB vector store adapter
 */
export class ChromaDB implements IVectorStore {
    private client: ChromaClient;
    private collectionName: string;
    private collection: Awaited<ReturnType<ChromaClient["getOrCreateCollection"]>> | null = null;

    constructor(options: { url?: string; collectionName: string }) {
        this.client = new ChromaClient({ path: options.url || "http://localhost:8000" });
        this.collectionName = options.collectionName;
    }

    /**
     * Initialize collection
     */
    private async ensureCollection() {
        if (!this.collection) {
            this.collection = await this.client.getOrCreateCollection({
                name: this.collectionName,
            });
        }
        return this.collection;
    }

    /**
     * Add vectors with metadata
     */
    async add(vectors: number[][], metadata: DocumentChunk[]): Promise<void> {
        if (vectors.length !== metadata.length) {
            throw new Error("Vectors and metadata length mismatch");
        }

        const collection = await this.ensureCollection();

        // Prepare data for ChromaDB
        const ids = metadata.map((chunk) => chunk.id);
        const documents = metadata.map((chunk) => chunk.content);
        const metadatas = metadata.map((chunk) => ({
            documentId: chunk.documentId,
            position: chunk.position,
            tokenCount: chunk.tokenCount,
            checksum: chunk.checksum,
            createdAt: chunk.createdAt.toISOString(),
            source: chunk.metadata.source as string,
            ...chunk.metadata,
        }));

        await collection.add({
            ids,
            embeddings: vectors,
            documents,
            metadatas,
        });
    }

    /**
     * Search for similar vectors
     */
    async search(
        vector: number[],
        topK: number,
        filter?: Record<string, unknown>,
        _query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
        const collection = await this.ensureCollection();

        const results = await collection.query({
            queryEmbeddings: [vector],
            nResults: topK,
            where: filter as any,
        });

        const chunks: Array<{ chunk: DocumentChunk; score: number }> = [];

        if (results.ids[0] && results.documents[0] && results.metadatas[0] && results.distances && results.distances[0]) {
            for (let i = 0; i < results.ids[0].length; i++) {
                const id = results.ids[0][i];
                const document = results.documents[0][i];
                const metadata = results.metadatas[0][i];
                const distance = results.distances[0][i];

                if (id && document && metadata && distance !== undefined) {
                    // Convert distance to similarity score (1 - normalized distance)
                    const score = 1 - distance;

                    chunks.push({
                        chunk: {
                            id,
                            content: document,
                            documentId: metadata.documentId as string,
                            position: metadata.position as number,
                            tokenCount: metadata.tokenCount as number,
                            checksum: metadata.checksum as string,
                            createdAt: new Date(metadata.createdAt as string),
                            metadata: metadata as Record<string, unknown>,
                        },
                        score,
                    });
                }
            }
        }

        return chunks;
    }

    /**
     * Delete vectors by document IDs
     */
    async delete(documentIds: string[]): Promise<void> {
        const collection = await this.ensureCollection();

        // Query for all chunks with matching document IDs
        const results = await collection.get({
            where: {
                documentId: { $in: documentIds },
            },
        });

        if (results.ids.length > 0) {
            await collection.delete({
                ids: results.ids,
            });
        }
    }

    /**
     * Get collection info
     */
    async getInfo(): Promise<{ count: number; dimensions: number }> {
        const collection = await this.ensureCollection();
        const count = await collection.count();

        // ChromaDB doesn't expose dimensions directly, use a default
        return {
            count,
            dimensions: 1536, // Default, should be configured
        };
    }
}
