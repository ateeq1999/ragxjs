import type { IVectorStore, DocumentChunk } from "@ragx/core";
export interface PineconeConfig {
    apiKey: string;
    index: string;
    namespace?: string;
}
export declare class PineconeStore implements IVectorStore {
    private client;
    private indexName;
    private namespace;
    constructor(config: PineconeConfig);
    add(vectors: number[][], chunks: DocumentChunk[]): Promise<void>;
    search(vector: number[], topK: number, filter?: Record<string, unknown>, _query?: string): Promise<Array<{
        chunk: DocumentChunk;
        score: number;
    }>>;
    delete(documentIds: string[]): Promise<void>;
    getInfo(): Promise<{
        count: number;
        dimensions: number;
    }>;
}
//# sourceMappingURL=pinecone.d.ts.map