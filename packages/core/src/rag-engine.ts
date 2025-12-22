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
    IReranker,
    IToolRegistry,
} from "./interfaces";
import { ToolRegistry } from "./tool-registry";
import { QueryTransformer } from "./query-transformer";
import { MemoryManager } from "./memory";
import { Retriever } from "./retriever";
import { MemoryDocumentStore } from "./document-store";
import { LLMCompressor, EmbeddingsCompressor } from "./compressor";
import { Logger } from "./logger";
import { RequestContext } from "./request-context";
import { CostTracker } from "./cost-tracker";
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
        reranker?: IReranker,
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
        return RequestContext.run({ agentName: this.config.name }, async () => {
            Logger.info(`Processing query: "${query}"`, { sessionId: options?.sessionId });

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
                Logger.debug(`Rewritten query: "${rewritten}"`);
                searchQueries = [rewritten];
            }

            if (this.config.queryTransformation?.expand) {
                const expanded = await this.queryTransformer.expand(
                    searchQueries[0] || query,
                    this.config.queryTransformation.maxExpansions
                );
                Logger.debug(`Expanded into ${expanded.length} sub-queries`);
                searchQueries = Array.from(new Set([...searchQueries, ...expanded]));
            }

            if (this.config.queryTransformation?.decompose) {
                const decomposed = await this.queryTransformer.decompose(searchQueries[0] || query);
                Logger.debug(`Decomposed into ${decomposed.length} steps`);
                searchQueries = Array.from(new Set([...searchQueries, ...decomposed]));
            }

            // Step 2: Retrieve relevant documents
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

            Logger.debug(`Retrieved ${allDocs.length} unique initial documents`);
            let retrievedDocs = allDocs.sort((a, b) => b.score - a.score).slice(0, topK * 2);

            // Step 2.1: Contextual Compression
            if (this.compressor) {
                Logger.info("Applying contextual compression");
                retrievedDocs = await this.compressor.compress(query, retrievedDocs);
            }

            // Step 3: Filter & Check context
            if (retrievedDocs.length === 0) {
                Logger.warn("Insufficient context found for query");
                return {
                    answer: "INSUFFICIENT_CONTEXT",
                    sources: [],
                    contextSufficient: false,
                };
            }

            // Step 4: Build context
            const maxContextTokens = 4000;
            const context = this.contextBuilder.build(query, retrievedDocs, maxContextTokens, history);
            const messages = this.contextBuilder.buildMessages(context);

            // Step 5: Execution Loop (Tool Calling)
            let iteration = 0;
            const maxIterations = 5;
            let lastResponse: LLMResponse | undefined;

            while (iteration < maxIterations) {
                Logger.debug(`LLM Generation iteration ${iteration + 1}`);
                lastResponse = await this.llmProvider.generate(messages, {
                    temperature,
                    tools: this.toolRegistry.getAllTools(),
                    ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
                });

                if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) {
                    break;
                }

                Logger.info(`Executing ${lastResponse.toolCalls.length} tools`);
                messages.push({
                    role: "assistant",
                    content: lastResponse.content,
                    timestamp: new Date(),
                    toolCalls: lastResponse.toolCalls,
                });

                const toolPromises = lastResponse.toolCalls.map(async (call) => {
                    Logger.debug(`Tool call: ${call.name}`, { args: call.arguments });
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

            if (!lastResponse) throw new Error("Failed to generate response");

            // Step 6: Verify grounding
            const isGrounded = this.contextBuilder.verifyGrounding(lastResponse.content, context);
            if (!isGrounded) Logger.warn("Response may not be fully grounded in context");

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

            const usage = lastResponse.usage;
            const cost = usage ? CostTracker.estimate(this.config.model.model, usage) : undefined;

            if (cost) {
                Logger.info(`Query completed. Estimated cost: ${CostTracker.format(cost)}`);
            }

            return {
                answer: lastResponse.content,
                sources: retrievedDocs.map((doc) => ({
                    content: doc.chunk.content,
                    source: doc.source,
                    score: doc.score,
                })),
                contextSufficient: true,
                usage,
                cost,
            };
        });
    }

    /**
     * Query with streaming response
     */
    async * queryStream(
        query: string,
        options?: { topK?: number; temperature?: number; sessionId?: string },
    ): AsyncGenerator<string, RAGResponse, unknown> {
        const traceId = crypto.randomUUID();
        const startTime = Date.now();
        const context = { agentName: this.config.name, traceId, startTime };

        const gen = this._queryStreamInternal(query, options);

        while (true) {
            const { value, done } = await RequestContext.run(context, () => gen.next());
            if (done) return value as RAGResponse;
            yield value as string;
        }
    }

    private async * _queryStreamInternal(
        query: string,
        options?: { topK?: number; temperature?: number; sessionId?: string },
    ): AsyncGenerator<string, RAGResponse, unknown> {
        Logger.info(`Processing streaming query: "${query}"`, { sessionId: options?.sessionId });

        const topK = options?.topK || this.config.retrieval?.topK || 5;
        const temperature = options?.temperature || this.config.model.temperature || 0.7;
        const scoreThreshold = this.config.retrieval?.scoreThreshold || 0.7;
        const sessionId = options?.sessionId;

        let history: ChatMessage[] = [];
        if (sessionId) {
            history = await this.memoryManager.getHistory(sessionId);
        }

        let searchQueries = [query];
        if (this.config.queryTransformation?.rewrite) {
            const rewritten = await this.queryTransformer.rewrite(query);
            searchQueries = [rewritten];
        }

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
        if (this.compressor) {
            retrievedDocs = await this.compressor.compress(query, retrievedDocs);
        }

        if (retrievedDocs.length === 0) {
            yield "INSUFFICIENT_CONTEXT";
            return { answer: "INSUFFICIENT_CONTEXT", sources: [], contextSufficient: false };
        }

        const maxContextTokens = 4000;
        const context = this.contextBuilder.build(query, retrievedDocs, maxContextTokens, history);
        const messages = this.contextBuilder.buildMessages(context);

        let iteration = 0;
        let lastResponse: LLMResponse | undefined;

        while (iteration < 5) {
            lastResponse = await this.llmProvider.generate(messages, {
                temperature,
                tools: this.toolRegistry.getAllTools(),
                ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
            });

            if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) break;

            Logger.info(`Executing ${lastResponse.toolCalls.length} tools`);
            messages.push({
                role: "assistant",
                content: lastResponse.content,
                timestamp: new Date(),
                toolCalls: lastResponse.toolCalls,
            });

            const toolResults = await Promise.all(lastResponse.toolCalls.map(async (call) => {
                const result = await this.toolRegistry.executeTool(call.name, call.arguments);
                return {
                    role: "tool" as const,
                    content: typeof result === "string" ? result : JSON.stringify(result),
                    timestamp: new Date(),
                    toolCallId: call.id,
                };
            }));
            messages.push(...toolResults);
            iteration++;
        }

        if (!lastResponse) throw new Error("Failed to generate response");

        let fullResponse = "";
        for await (const chunk of this.llmProvider.generateStream(messages, {
            temperature,
            ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
        })) {
            fullResponse += chunk;
            yield chunk;
        }

        const isGrounded = this.contextBuilder.verifyGrounding(fullResponse, context);
        if (sessionId) {
            await this.memoryManager.addMessage(sessionId, { role: "user", content: query, timestamp: new Date() });
            await this.memoryManager.addMessage(sessionId, { role: "assistant", content: fullResponse, timestamp: new Date() });
        }

        const usage = lastResponse.usage;
        const cost = usage ? CostTracker.estimate(this.config.model.model, usage) : undefined;

        return {
            answer: fullResponse,
            sources: retrievedDocs.map((doc) => ({
                content: doc.chunk.content,
                source: doc.source,
                score: doc.score,
            })),
            contextSufficient: isGrounded,
            usage,
            cost,
        };
    }

    /**
     * Ingest documents
     */
    async ingest(documents: Document[]): Promise<{ processed: number; chunks: number }> {
        let totalChunks = 0;
        for (const document of documents) {
            const chunks = await this.documentProcessor.process(document, "fixed");
            const texts = chunks.map((chunk) => chunk.content);
            const embeddings = await this.embeddingProvider.embed(texts);
            if (this.docStore) await this.docStore.add([document]);
            await this.retriever.addDocuments(chunks, embeddings);
            totalChunks += chunks.length;
        }
        return { processed: documents.length, chunks: totalChunks };
    }

    /**
     * Delete documents
     */
    async deleteDocuments(documentIds: string[]): Promise<void> {
        await this.retriever.deleteDocuments(documentIds);
    }
}
