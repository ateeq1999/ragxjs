export const VERSION = "0.1.0";

// Core interfaces and types
export {
    Document,
    DocumentChunk,
    RetrievedDocument,
    RAGContext,
    RAGResponse,
    LLMResponse,
    ChatMessage,
    IVectorStore,
    ILLMProvider,
    IEmbeddingProvider,
    IMemoryManager,
    IContextBuilder,
    IReranker,
    IRAGEngine,
    ChunkingStrategy,
    IDocumentProcessor
} from "./interfaces";

// Document processor
export { DocumentProcessor } from "./document-processor";
export type { ChunkingOptions } from "./document-processor";

// Retriever
export { Retriever } from "./retriever";

// Context builder
export { ContextBuilder } from "./context-builder";

// RAG engine
export { RAGEngine } from "./rag-engine";
