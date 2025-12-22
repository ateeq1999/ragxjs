import type { VectorStoreConfig } from "@ragx/config";
import type { IVectorStore } from "@ragx/core";
import { ChromaDB } from "./adapters/chroma";
import { MemoryVectorStore } from "./adapters/memory";
import { PineconeStore } from "./adapters/pinecone";
import { LibSQLStore } from "./adapters/libsql";

/**
 * Create vector store from configuration
 */
export function createVectorStore(config: VectorStoreConfig): IVectorStore {
    switch (config.provider) {
        case "chroma":
            if (!config.collection) {
                throw new Error("ChromaDB requires a collection name");
            }
            return new ChromaDB({
                ...(config.url ? { url: config.url } : {}),
                collectionName: config.collection as string,
            });
        case "memory":
            return new MemoryVectorStore();
        case "pinecone":
            if (!config.apiKey || !config.index) {
                throw new Error("Pinecone requires apiKey and index");
            }
            return new PineconeStore({
                apiKey: config.apiKey,
                index: config.index,
                namespace: config.namespace || "",
            });
        case "libsql":
            if (!config.url) {
                throw new Error("LibSQL requires a url");
            }
            return new LibSQLStore({
                url: config.url,
                authToken: config.apiKey || "",
                table: config.collection || "ragx_embeddings",
            });
        default:
            throw new Error(`Unsupported vector store provider: ${config.provider}`);
    }
}

// Re-export adapters
export { ChromaDB } from "./adapters/chroma";
export { MemoryVectorStore } from "./adapters/memory";
export { PineconeStore } from "./adapters/pinecone";
export { LibSQLStore } from "./adapters/libsql";
