import type { AgentConfig } from "@ragx/config";
import { ContextBuilder } from "./context-builder";
import { DocumentProcessor } from "./document-processor";
import type {
    Document,
    IEmbeddingProvider,
    ILLMProvider,
    IRAGEngine,
    IVectorStore,
    RAGResponse,
    RetrievedDocument,
} from "./interfaces";
import { QueryTransformer } from "./query-transformer";
import { Retriever } from "./retriever";

/**
 * RAG Engine implementation
 * Main orchestrator for the RAG pipeline
 */
export class RAGEngine implements IRAGEngine {
    private readonly documentProcessor: DocumentProcessor;
    private readonly retriever: Retriever;
    private readonly contextBuilder: ContextBuilder;
    private readonly queryTransformer: QueryTransformer;

    constructor(
        private readonly config: AgentConfig,
        private readonly llmProvider: ILLMProvider,
        private readonly embeddingProvider: IEmbeddingProvider,
        // private readonly vectorStore: IVectorStore, // Unused in this implementation but kept if needed for future
        vectorStore: IVectorStore,
    ) {
        this.documentProcessor = new DocumentProcessor({
            maxTokens: 500,
            overlap: 50,
            minTokens: 100,
        });
        this.retriever = new Retriever(vectorStore, embeddingProvider);
        this.contextBuilder = new ContextBuilder();
        this.queryTransformer = new QueryTransformer(llmProvider);
    }

    /**
     * Query the RAG system
     */
    async query(
        query: string,
        options?: { topK?: number; temperature?: number },
    ): Promise<RAGResponse> {
        const topK = options?.topK || this.config.retrieval?.topK || 5;
        const temperature = options?.temperature || this.config.model.temperature || 0.7;
        const scoreThreshold = this.config.retrieval?.scoreThreshold || 0.7;

        // Step 1: Query Transformation
        let searchQueries = [query];

        if (this.config.queryTransformation?.rewrite) {
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
            searchQueries = expanded;
        }

        // Step 2: Retrieve relevant documents (Hybrid/Multi-query)
        // We'll search for all queries and deduplicate
        const allDocs: RetrievedDocument[] = [];
        const seenIds = new Set<string>();

        // We run retrievals in parallel for better performance
        const retrievalPromises = searchQueries.map(q =>
            this.retriever.retrieve(q, topK, scoreThreshold)
        );

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
        const retrievedDocs = allDocs.sort((a, b) => b.score - a.score).slice(0, topK * 2);

        // Step 2: Check if we have sufficient context
        if (retrievedDocs.length === 0) {
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: [],
                contextSufficient: false,
            };
        }

        // Step 3: Build context and format prompt
        // Step 3: Build context and format prompt
        // Default context window to 4000 if not specified
        const maxContextTokens = 4000;
        const context = this.contextBuilder.build(query, retrievedDocs, maxContextTokens);
        const prompt = this.contextBuilder.formatPrompt(context);

        // Step 4: Generate response
        const response = await this.llmProvider.generate(prompt, {
            temperature,
            ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
        });

        // Step 5: Verify grounding
        const isGrounded = this.contextBuilder.verifyGrounding(response.content, context);

        // Step 6: Return INSUFFICIENT_CONTEXT if not grounded
        if (!isGrounded) {
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: retrievedDocs.map((doc) => ({
                    content: doc.chunk.content,
                    source: doc.source,
                    score: doc.score,
                })),
                contextSufficient: false,
                ...(response.usage ? { usage: response.usage } : {}),
            };
        }

        return {
            answer: response.content,
            sources: retrievedDocs.map((doc) => ({
                content: doc.chunk.content,
                source: doc.source,
                score: doc.score,
            })),
            contextSufficient: true,
            ...(response.usage ? { usage: response.usage } : {}),
        };
    }

    /**
     * Query with streaming response
     */
    async *queryStream(
        query: string,
        options?: { topK?: number; temperature?: number },
    ): AsyncGenerator<string, RAGResponse, unknown> {
        const topK = options?.topK || this.config.retrieval?.topK || 5;
        const temperature = options?.temperature || this.config.model.temperature || 0.7;
        const scoreThreshold = this.config.retrieval?.scoreThreshold || 0.7;

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
            searchQueries = expanded;
        }

        // Step 2: Retrieve relevant documents (Hybrid/Multi-query)
        const allDocs: RetrievedDocument[] = [];
        const seenIds = new Set<string>();

        const retrievalPromises = searchQueries.map(q =>
            this.retriever.retrieve(q, topK, scoreThreshold)
        );

        const results = await Promise.all(retrievalPromises);

        for (const docList of results) {
            for (const doc of docList) {
                if (!seenIds.has(doc.chunk.id)) {
                    seenIds.add(doc.chunk.id);
                    allDocs.push(doc);
                }
            }
        }

        const retrievedDocs = allDocs.sort((a, b) => b.score - a.score).slice(0, topK * 2);

        // Step 2: Check if we have sufficient context
        if (retrievedDocs.length === 0) {
            yield "INSUFFICIENT_CONTEXT";
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: [],
                contextSufficient: false,
            };
        }

        // Step 3: Build context and format prompt
        // Step 3: Build context and format prompt
        // Default context window to 4000 if not specified
        const maxContextTokens = 4000;
        const context = this.contextBuilder.build(query, retrievedDocs, maxContextTokens);
        const prompt = this.contextBuilder.formatPrompt(context);

        // Step 4: Generate streaming response
        let fullResponse = "";
        for await (const chunk of this.llmProvider.generateStream(prompt, {
            temperature,
            ...(this.config.model.maxTokens ? { maxTokens: this.config.model.maxTokens } : {}),
        })) {
            fullResponse += chunk;
            yield chunk;
        }

        // Step 5: Verify grounding
        const isGrounded = this.contextBuilder.verifyGrounding(fullResponse, context);

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

            // Step 3: Add to vector store
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
