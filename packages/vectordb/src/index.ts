import type { VectorStoreConfig } from "@ragx/config";
import type { IVectorStore } from "@ragx/core";
import { ChromaDB } from "./adapters/chroma.ts";
import { MemoryVectorStore } from "./adapters/memory.ts";

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
                url: config.url,
                collectionName: config.collection,
            });
        case "memory":
            return new MemoryVectorStore();
        default:
            throw new Error(`Unsupported vector store provider: ${config.provider}`);
    }
}

// Re-export adapters
export { ChromaDB } from "./adapters/chroma.ts";
export { MemoryVectorStore } from "./adapters/memory.ts";
