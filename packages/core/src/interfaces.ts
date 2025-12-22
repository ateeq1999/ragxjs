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
    metadata: Record<string, unknown> & {
        isChild?: boolean;
        parentId?: string;
    };
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
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    toolCallId?: string; // For role: "tool"
}

/**
 * Tool call from LLM
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

/**
 * Tool definition
 */
export interface ITool {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
    execute(args: any): Promise<any>;
}

/**
 * Tool registry interface
 */
export interface IToolRegistry {
    register(tool: ITool): void;
    getTool(name: string): ITool | undefined;
    getAllTools(): ITool[];
    executeTool(name: string, args: any): Promise<any>;
}

/**
 * Document store interface for parent document retrieval
 */
export interface IDocumentStore {
    /** Add documents to store */
    add(documents: Document[]): Promise<void>;
    /** Get document by ID */
    get(id: string): Promise<Document | undefined>;
    /** Delete documents by IDs */
    delete(ids: string[]): Promise<void>;
    /** Get all documents */
    getAll?(): Promise<Document[]>;
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

    /**
     * Format context into a list of chat messages
     */
    buildMessages(context: RAGContext): ChatMessage[];
}

/**
 * Contextual compressor interface
 */
export interface ICompressor {
    /**
     * Compress retrieved documents based on query
     */
    compress(query: string, documents: RetrievedDocument[]): Promise<RetrievedDocument[]>;
}

/**
 * LLM response
 */
export interface LLMResponse {
    /** Generated content */
    content: string;
    /** Tool calls if model requested them */
    toolCalls?: ToolCall[];
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
    generate(
        input: string | ChatMessage[],
        options?: {
            temperature?: number;
            maxTokens?: number;
            tools?: ITool[];
        }
    ): Promise<LLMResponse>;

    /**
     * Generate a streaming response
     */
    generateStream(
        input: string | ChatMessage[],
        options?: {
            temperature?: number;
            maxTokens?: number;
            tools?: ITool[];
        },
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
     * Search for similar vectors or by keyword
     */
    search(
        vector: number[] | undefined,
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
    } | undefined;
    /** Estimated cost */
    cost?: {
        amount: number;
        currency: string;
    } | undefined;
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
