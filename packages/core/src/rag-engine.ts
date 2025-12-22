import type { AgentConfig } from "@ragx/config";
import { ContextBuilder } from "./context-builder";
import { DocumentProcessor } from "./document-processor";
import type {
    Document,
    IEmbeddingProvider,
    ILLMProvider,
    IRAGEngine,
    IVectorStore,
    LLMResponse,
    RAGResponse,
    RetrievedDocument,
    ChatMessage,
    ToolCall,
    IReranker,
    IToolRegistry,
} from "./interfaces";
import { ToolRegistry } from "./tool-registry";
import { QueryTransformer } from "./query-transformer";
import { MemoryManager } from "./memory";
import { Retriever } from "./retriever";
import { MemoryDocumentStore } from "./document-store";
import { LLMCompressor, EmbeddingsCompressor } from "./compressor";
import type { IDocumentStore, ICompressor } from "./interfaces";

/**
 * RAG Engine implementation
 * Main orchestrator for the RAG pipeline
 */
export class RAGEngine implements IRAGEngine {
    private readonly documentProcessor: DocumentProcessor;
    private readonly retriever: Retriever;
    private readonly contextBuilder: ContextBuilder;
    private readonly queryTransformer: QueryTransformer;
    private readonly memoryManager: MemoryManager;
    private readonly docStore?: IDocumentStore;
    private readonly toolRegistry: IToolRegistry;
    private readonly compressor?: ICompressor;

    constructor(
        private readonly config: AgentConfig,
        private readonly llmProvider: ILLMProvider,
        private readonly embeddingProvider: IEmbeddingProvider,
        vectorStore: IVectorStore,
        private readonly reranker?: IReranker,
        toolRegistry?: IToolRegistry,
    ) {
        this.toolRegistry = toolRegistry || new ToolRegistry();
        this.documentProcessor = new DocumentProcessor({
            maxTokens: 500,
            overlap: 50,
            minTokens: 100,
        });

        if (config.retrieval?.parentRetrieval) {
            this.docStore = new MemoryDocumentStore();
        }

        this.retriever = new Retriever(
            vectorStore,
            embeddingProvider,
            reranker,
            config.retrieval,
            this.docStore
        );
        this.contextBuilder = new ContextBuilder();
        this.queryTransformer = new QueryTransformer(llmProvider);
        this.memoryManager = new MemoryManager(config.memory);

        if (config.retrieval?.compression?.enabled) {
            const compression = config.retrieval.compression;
            if (compression.strategy === "llm") {
                this.compressor = new LLMCompressor(this.llmProvider, {
                    maxTokensPerDoc: compression.maxTokensPerDoc,
                });
            } else {
                this.compressor = new EmbeddingsCompressor(this.embeddingProvider, {
                    maxTokensPerDoc: compression.maxTokensPerDoc,
                });
            }
        }
    }

    /**
     * Query the RAG system
     */
    async query(
        query: string,
        options?: { topK?: number; temperature?: number; sessionId?: string },
    ): Promise<RAGResponse> {
        const topK = options?.topK || this.config.retrieval?.topK || 5;
        const temperature = options?.temperature || this.config.model.temperature || 0.7;
        const scoreThreshold = this.config.retrieval?.scoreThreshold || 0.7;
        const sessionId = options?.sessionId;

        // Step 0: Get History
        let history: ChatMessage[] = [];
        if (sessionId) {
            history = await this.memoryManager.getHistory(sessionId);
        }

        // Step 1: Query Transformation
        let searchQueries = [query];

        if (this.config.queryTransformation?.rewrite) {
            // We pass history to rewrite if available
            // Converting ChatMessage[] to string for simple history string in rewriter if needed
            // For now passing plain query, assuming rewrite uses only last query or we enhance rewrite signature later
            const rewritten = await this.queryTransformer.rewrite(query);
            // Replace original if rewritten (single query mode)
            // Or maybe keep both? Standard practice is usually to use the better query. 
            // Let's use rewritten for now as the "better" version.
            searchQueries = [rewritten];
        }

        if (this.config.queryTransformation?.expand) {
            // Expansion adds more queries
            const expanded = await this.queryTransformer.expand(
                searchQueries[0] || query,
                this.config.queryTransformation.maxExpansions
            );
            searchQueries = Array.from(new Set([...searchQueries, ...expanded]));
        }

        if (this.config.queryTransformation?.decompose) {
            // Decomposition breaks query into sub-questions
            const decomposed = await this.queryTransformer.decompose(searchQueries[0] || query);
            searchQueries = Array.from(new Set([...searchQueries, ...decomposed]));
        }

        // Step 2: Retrieve relevant documents (Hybrid/Multi-query)
        // We'll search for all queries and deduplicate
        const allDocs: RetrievedDocument[] = [];
        const seenIds = new Set<string>();

        // We run retrievals in parallel for better performance
        const retrievalPromises = searchQueries.map(async (q) => {
            let retrievalQuery = q;
            if (this.config.queryTransformation?.hyde) {
                retrievalQuery = await this.queryTransformer.generateHypotheticalDocument(q);
            }
            return this.retriever.retrieve(retrievalQuery, topK, scoreThreshold);
        });

        const results = await Promise.all(retrievalPromises);

        for (const docList of results) {
            for (const doc of docList) {
                if (!seenIds.has(doc.chunk.id)) {
                    seenIds.add(doc.chunk.id);
                    allDocs.push(doc);
                }
            }
        }

        // If using expansion, we might have too many docs, maybe re-rank or just take topK * 2?
        // For now, let's just sort by score again (naive fusion) and take unique top K*2 to provide broad context
        // But since scores across different queries might not be comparable without advanced fusion (RRF),
        // we'll stick to a simple deduplication and keeping high variance.
        // Let's enforce topK limit globally for the context builder to avoid flooding
        let retrievedDocs = allDocs.sort((a, b) => b.score - a.score).slice(0, topK * 2);

        // Step 2.1: Contextual Compression
        if (this.compressor) {
            retrievedDocs = await this.compressor.compress(query, retrievedDocs);
        }

        // Step 2: Check if we have sufficient context
        if (retrievedDocs.length === 0) {
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: [],
                contextSufficient: false,
            };
        }

        // Step 3: Build context
        const maxContextTokens = 4000;
        const context = this.contextBuilder.build(query, retrievedDocs, maxContextTokens, history);
        let messages = this.contextBuilder.buildMessages(context);

        // Stage 4: Execution Loop (Tool Calling)
        let iteration = 0;
        const maxIterations = 5;
        let lastResponse: LLMResponse | undefined;

        while (iteration < maxIterations) {
            lastResponse = await this.llmProvider.generate(messages, {
                temperature,
                tools: this.toolRegistry.getAllTools(),
                ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
            });

            if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) {
                break;
            }

            // Add model's choice to messages
            messages.push({
                role: "assistant",
                content: lastResponse.content,
                timestamp: new Date(),
                toolCalls: lastResponse.toolCalls,
            });

            // Execute all requested tools
            const toolPromises = lastResponse.toolCalls.map(async (call: ToolCall) => {
                const result = await this.toolRegistry.executeTool(call.name, call.arguments);
                return {
                    role: "tool" as const,
                    content: typeof result === "string" ? result : JSON.stringify(result),
                    timestamp: new Date(),
                    toolCallId: call.id,
                };
            });

            const toolResults = await Promise.all(toolPromises);
            messages.push(...toolResults);

            iteration++;
        }

        if (!lastResponse) {
            throw new Error("Failed to generate response from LLM");
        }

        // Step 5: Verify grounding on final content
        const isGrounded = this.contextBuilder.verifyGrounding(lastResponse.content, context);

        // Step 6: Return INSUFFICIENT_CONTEXT if not grounded
        if (!isGrounded && lastResponse.content !== "INSUFFICIENT_CONTEXT") {
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: retrievedDocs.map((doc) => ({
                    content: doc.chunk.content,
                    source: doc.source,
                    score: doc.score,
                })),
                contextSufficient: false,
                ...(lastResponse.usage ? { usage: lastResponse.usage } : {}),
            };
        }

        // Step 7: Save to memory
        if (sessionId) {
            await this.memoryManager.addMessage(sessionId, {
                role: "user",
                content: query,
                timestamp: new Date(),
            });
            await this.memoryManager.addMessage(sessionId, {
                role: "assistant",
                content: lastResponse.content,
                timestamp: new Date(),
            });
        }

        return {
            answer: lastResponse.content,
            sources: retrievedDocs.map((doc) => ({
                content: doc.chunk.content,
                source: doc.source,
                score: doc.score,
            })),
            contextSufficient: true,
            ...(lastResponse.usage ? { usage: lastResponse.usage } : {}),
        };
    }

    /**
     * Query with streaming response
     */
    async *queryStream(
        query: string,
        options?: { topK?: number; temperature?: number; sessionId?: string },
    ): AsyncGenerator<string, RAGResponse, unknown> {
        const topK = options?.topK || this.config.retrieval?.topK || 5;
        const temperature = options?.temperature || this.config.model.temperature || 0.7;
        const scoreThreshold = this.config.retrieval?.scoreThreshold || 0.7;
        const sessionId = options?.sessionId;

        // Step 0: Get History
        let history: ChatMessage[] = [];
        if (sessionId) {
            history = await this.memoryManager.getHistory(sessionId);
        }

        // Step 1: Query Transformation
        let searchQueries = [query];

        if (this.config.queryTransformation?.rewrite) {
            const rewritten = await this.queryTransformer.rewrite(query);
            searchQueries = [rewritten];
        }

        if (this.config.queryTransformation?.expand) {
            const expanded = await this.queryTransformer.expand(
                searchQueries[0] || query,
                this.config.queryTransformation.maxExpansions
            );
            searchQueries = Array.from(new Set([...searchQueries, ...expanded]));
        }

        if (this.config.queryTransformation?.decompose) {
            const decomposed = await this.queryTransformer.decompose(searchQueries[0] || query);
            searchQueries = Array.from(new Set([...searchQueries, ...decomposed]));
        }

        // Step 2: Retrieve relevant documents (Hybrid/Multi-query)
        const allDocs: RetrievedDocument[] = [];
        const seenIds = new Set<string>();

        const retrievalPromises = searchQueries.map(async (q) => {
            let retrievalQuery = q;
            if (this.config.queryTransformation?.hyde) {
                retrievalQuery = await this.queryTransformer.generateHypotheticalDocument(q);
            }
            return this.retriever.retrieve(retrievalQuery, topK, scoreThreshold);
        });

        const results = await Promise.all(retrievalPromises);

        for (const docList of results) {
            for (const doc of docList) {
                if (!seenIds.has(doc.chunk.id)) {
                    seenIds.add(doc.chunk.id);
                    allDocs.push(doc);
                }
            }
        }

        let retrievedDocs = allDocs.sort((a, b) => b.score - a.score).slice(0, topK * 2);

        // Step 2.1: Contextual Compression
        if (this.compressor) {
            retrievedDocs = await this.compressor.compress(query, retrievedDocs);
        }

        // Step 2: Check if we have sufficient context
        if (retrievedDocs.length === 0) {
            yield "INSUFFICIENT_CONTEXT";
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: [],
                contextSufficient: false,
            };
        }

        // Step 3: Build context
        const maxContextTokens = 4000;
        const context = this.contextBuilder.build(query, retrievedDocs, maxContextTokens, history);
        let messages = this.contextBuilder.buildMessages(context);

        // Stage 4: Execution Loop (Tool Calling)
        let iteration = 0;
        const maxIterations = 5;
        let lastResponse: LLMResponse | undefined;

        while (iteration < maxIterations) {
            lastResponse = await this.llmProvider.generate(messages, {
                temperature,
                tools: this.toolRegistry.getAllTools(),
                ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
            });

            if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) {
                break;
            }

            // Yield a status if possible? For now we just process.
            // Add model's choice to messages
            messages.push({
                role: "assistant",
                content: lastResponse.content,
                timestamp: new Date(),
                toolCalls: lastResponse.toolCalls,
            });

            // Execute all requested tools
            const toolPromises = lastResponse.toolCalls.map(async (call: ToolCall) => {
                const result = await this.toolRegistry.executeTool(call.name, call.arguments);
                return {
                    role: "tool" as const,
                    content: typeof result === "string" ? result : JSON.stringify(result),
                    timestamp: new Date(),
                    toolCallId: call.id,
                };
            });

            const toolResults = await Promise.all(toolPromises);
            messages.push(...toolResults);

            iteration++;
        }

        if (!lastResponse) {
            throw new Error("Failed to generate response from LLM");
        }

        // Step 5: Final Streaming Generation
        let fullResponse = "";
        for await (const chunk of this.llmProvider.generateStream(messages, {
            temperature,
            ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
        })) {
            fullResponse += chunk;
            yield chunk;
        }

        // Step 6: Verify grounding
        const isGrounded = this.contextBuilder.verifyGrounding(fullResponse, context);

        // Step 7: Save to memory
        if (sessionId) {
            await this.memoryManager.addMessage(sessionId, {
                role: "user",
                content: query,
                timestamp: new Date(),
            });
            await this.memoryManager.addMessage(sessionId, {
                role: "assistant",
                content: fullResponse,
                timestamp: new Date(),
            });
        }

        return {
            answer: fullResponse,
            sources: retrievedDocs.map((doc) => ({
                content: doc.chunk.content,
                source: doc.source,
                score: doc.score,
            })),
            contextSufficient: isGrounded,
        };
    }

    /**
     * Ingest documents
     */
    async ingest(documents: Document[]): Promise<{ processed: number; chunks: number }> {
        let totalChunks = 0;

        for (const document of documents) {
            // Step 1: Process document into chunks
            const chunks = await this.documentProcessor.process(document, "fixed");

            // Step 2: Generate embeddings for chunks
            const texts = chunks.map((chunk) => chunk.content);
            const embeddings = await this.embeddingProvider.embed(texts);

            // Step 3: Add to document store if enabled
            if (this.docStore) {
                await this.docStore.add([document]);
            }

            // Step 4: Add to vector store
            await this.retriever.addDocuments(chunks, embeddings);

            totalChunks += chunks.length;
        }

        return {
            processed: documents.length,
            chunks: totalChunks,
        };
    }

    /**
     * Delete documents
     */
    async deleteDocuments(documentIds: string[]): Promise<void> {
        await this.retriever.deleteDocuments(documentIds);
    }
}
