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
} from "./interfaces";
import { Retriever } from "./retriever";

/**
 * RAG Engine implementation
 * Main orchestrator for the RAG pipeline
 */
export class RAGEngine implements IRAGEngine {
    private readonly documentProcessor: DocumentProcessor;
    private readonly retriever: Retriever;
    private readonly contextBuilder: ContextBuilder;

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

        // Step 1: Retrieve relevant documents
        const retrievedDocs = await this.retriever.retrieve(query, topK, scoreThreshold);

        // Step 2: Check if we have sufficient context
        if (retrievedDocs.length === 0) {
            return {
                answer: "INSUFFICIENT_CONTEXT",
                sources: [],
                contextSufficient: false,
            };
        }

        // Step 3: Build context and format prompt
        const context = this.contextBuilder.build(query, retrievedDocs);
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

        // Step 1: Retrieve relevant documents
        const retrievedDocs = await this.retriever.retrieve(query, topK, scoreThreshold);

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
        const context = this.contextBuilder.build(query, retrievedDocs);
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
