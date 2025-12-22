/**
 * Document chunk with metadata
 */
export interface DocumentChunk {
    /** Unique chunk identifier */
    id: string;
    /** Chunk content */
    content: string;
    /** Parent document ID */
    documentId: string;
    /** Chunk position in document */
    position: number;
    /** Token count */
    tokenCount: number;
    /** Content checksum for deduplication */
    checksum: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Metadata */
    metadata: Record<string, unknown>;
}

/**
 * Document to be processed
 */
export interface Document {
    /** Document ID */
    id: string;
    /** Document content */
    content: string;
    /** Source information */
    source: string;
    /** Metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Chunking strategy
 */
export type ChunkingStrategy = "fixed" | "semantic" | "recursive";

/**
 * Document loader interface
 */
export interface IDocumentLoader {
    /**
     * Load a document from a source
     */
    load(): Promise<Document[]>;
}

/**
 * Document processor interface
 */
export interface IDocumentProcessor {
    /**
     * Process a document into chunks
     */
    process(document: Document, strategy?: ChunkingStrategy): Promise<DocumentChunk[]>;

    /**
     * Calculate token count for text
     */
    countTokens(text: string): number;

    /**
     * Generate checksum for content
     */
    generateChecksum(content: string): string;
}

/**
 * Retrieved document with score
 */
export interface RetrievedDocument {
    /** Document chunk */
    chunk: DocumentChunk;
    /** Similarity score */
    score: number;
    /** Source reference */
    source: string;
}

/**
 * Retriever interface
 */
export interface IRetriever {
    /**
     * Retrieve relevant documents for a query
     */
    retrieve(query: string, topK?: number, scoreThreshold?: number): Promise<RetrievedDocument[]>;

    /**
     * Add documents to the vector store
     */
    addDocuments(chunks: DocumentChunk[], embeddings: number[][]): Promise<void>;

    /**
     * Delete documents by IDs
     */
    deleteDocuments(documentIds: string[]): Promise<void>;
}

/**
 * Context for RAG generation
 */
export interface RAGContext {
    /** User query */
    query: string;
    /** Retrieved documents */
    documents: RetrievedDocument[];
    /** Conversation history (optional) */
    history?: ChatMessage[];
    /** System prompt (optional) */
    systemPrompt?: string;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}

/**
 * Memory manager interface
 */
export interface IMemoryManager {
    /**
     * Add a message to the conversation history
     */
    addMessage(sessionId: string, message: ChatMessage): Promise<void>;

    /**
     * Get conversation history
     */
    getHistory(sessionId: string): Promise<ChatMessage[]>;

    /**
     * Clear conversation history
     */
    clearHistory(sessionId: string): Promise<void>;
}

/**
 * Context builder interface
 */
export interface IContextBuilder {
    /**
     * Build context from query and retrieved documents
     */
    build(
        query: string,
        documents: RetrievedDocument[],
        maxTokens: number,
        history?: ChatMessage[],
    ): RAGContext;

    /**
     * Format context into a prompt string
     */
    formatPrompt(context: RAGContext): string;
}

/**
 * LLM response
 */
export interface LLMResponse {
    /** Generated content */
    content: string;
    /** Token usage */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** Model used */
    model: string;
}

/**
 * LLM provider interface
 */
export interface ILLMProvider {
    /**
     * Generate a response
     */
    generate(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse>;

    /**
     * Generate a streaming response
     */
    generateStream(
        prompt: string,
        options?: { temperature?: number; maxTokens?: number },
    ): AsyncGenerator<string, void, unknown>;
}

/**
 * Embedding provider interface
 */
export interface IEmbeddingProvider {
    /**
     * Generate embeddings for texts
     */
    embed(texts: string[]): Promise<number[][]>;

    /**
     * Get embedding dimensions
     */
    getDimensions(): number;
}

/**
 * Reranker interface
 */
export interface IReranker {
    /**
     * Rerank retrieved documents based on query relevance
     */
    rerank(query: string, documents: DocumentChunk[], topK?: number): Promise<Array<{ index: number; score: number }>>;
}

/**
 * Vector store interface
 */
export interface IVectorStore {
    /**
     * Add vectors with metadata
     */
    add(vectors: number[][], metadata: DocumentChunk[]): Promise<void>;

    /**
     * Search for similar vectors
     */
    search(
        vector: number[],
        topK: number,
        filter?: Record<string, unknown>,
        query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>>;

    /**
     * Delete vectors by document IDs
     */
    delete(documentIds: string[]): Promise<void>;

    /**
     * Get collection/namespace info
     */
    getInfo(): Promise<{ count: number; dimensions: number }>;
}

/**
 * RAG engine response
 */
export interface RAGResponse {
    /** Generated answer */
    answer: string;
    /** Retrieved sources */
    sources: Array<{ content: string; source: string; score: number }>;
    /** Whether context was sufficient */
    contextSufficient: boolean;
    /** Token usage */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * RAG engine interface
 */
export interface IRAGEngine {
    /**
     * Query the RAG system
     */
    query(
        query: string,
        options?: { topK?: number; temperature?: number; sessionId?: string },
    ): Promise<RAGResponse>;

    /**
     * Query with streaming response
     */
    queryStream(
        query: string,
        options?: { topK?: number; temperature?: number; sessionId?: string },
    ): AsyncGenerator<string, RAGResponse, unknown>;

    /**
     * Ingest documents
     */
    ingest(documents: Document[]): Promise<{ processed: number; chunks: number }>;

    /**
     * Delete documents
     */
    deleteDocuments(documentIds: string[]): Promise<void>;
}
