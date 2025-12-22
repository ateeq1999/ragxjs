import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import type { RagxConfig } from "@ragx/config";
import { RAGEngine } from "@ragx/core";
import { createEmbeddingProvider } from "@ragx/embeddings";
import { createLLMProvider } from "@ragx/llm";
import { createVectorStore } from "@ragx/vectordb";
import { AgentRegistry } from "./registry";
import { createChatRoutes } from "./routes/chat";
import { createHealthRoutes } from "./routes/health";
import { createIngestRoutes } from "./routes/ingest";
import { createSearchRoutes } from "./routes/search";

/**
 * Server options
 */
export interface ServerOptions {
    config: RagxConfig;
    apiKeys: Record<string, string>;
}

/**
 * Create RAGX server from configuration
 */
export function createServer(options: ServerOptions) {
    const { config, apiKeys } = options;
    const registry = new AgentRegistry();
    const startTime = Date.now();

    // Initialize agents
    for (const agentConfig of config.agents) {
        // Skip disabled agents
        if (agentConfig.enabled === false) {
            console.log(`⏭️  Skipping disabled agent: ${agentConfig.name}`);
            continue;
        }

        try {
            // Get API key for this agent's provider
            const llmApiKey = apiKeys[agentConfig.model.provider];
            const embeddingApiKey = apiKeys[agentConfig.embeddings.provider];

            if (!llmApiKey) {
                throw new Error(`Missing API key for LLM provider: ${agentConfig.model.provider}`);
            }

            if (!embeddingApiKey) {
                throw new Error(
                    `Missing API key for embedding provider: ${agentConfig.embeddings.provider}`,
                );
            }

            // Create providers
            const llm = createLLMProvider(agentConfig.model, llmApiKey);
            const embeddings = createEmbeddingProvider(agentConfig.embeddings, embeddingApiKey);
            const vectorStore = createVectorStore(agentConfig.vectorStore);

            // Create RAG engine
            const ragEngine = new RAGEngine(agentConfig, llm, embeddings, vectorStore);

            // Register agent
            registry.register(agentConfig.name, ragEngine);

            console.log(`✅ Initialized agent: ${agentConfig.name}`);
        } catch (error) {
            console.error(`❌ Failed to initialize agent ${agentConfig.name}:`, error);
            throw error;
        }
    }

    // Create Elysia app
    const app = new Elysia()
        // Add CORS
        .use(
            cors({
                origin: config.server?.cors?.origin || "*",
                credentials: config.server?.cors?.credentials || false,
            }),
        )
        // Add Swagger documentation
        .use(
            swagger({
                documentation: {
                    info: {
                        title: "RAGX API",
                        version: "0.1.0",
                        description: "Production-ready RAG framework API",
                    },
                    tags: [
                        { name: "Chat", description: "Chat with RAG agents" },
                        { name: "Ingest", description: "Ingest documents" },
                        { name: "Search", description: "Semantic search" },
                        { name: "Health", description: "Health and metrics" },
                    ],
                },
            }),
        )
        // Add routes
        .use(createChatRoutes(registry))
        .use(createIngestRoutes(registry))
        .use(createSearchRoutes(registry))
        .use(createHealthRoutes(registry, startTime))
        // Error handling
        .onError(({ code, error, set }) => {
            console.error(`Error [${code}]:`, error);

            if (code === "VALIDATION") {
                set.status = 400;
                return {
                    error: "Validation error",
                    message: error.message,
                };
            }

            if (code === "NOT_FOUND") {
                set.status = 404;
                return {
                    error: "Not found",
                    message: "The requested resource was not found",
                };
            }

            set.status = 500;
            return {
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            };
        });

    return app;
}

/**
 * Start RAGX server
 */
export async function startServer(options: ServerOptions) {
    const app = createServer(options);
    const port = options.config.server?.port || 3000;
    const host = options.config.server?.host || "0.0.0.0";

    app.listen({ port, hostname: host });

    console.log(`\n🚀 RAGX Server running at http://${host}:${port}`);
    console.log(`📚 API Documentation: http://${host}:${port}/swagger`);
    console.log(`💚 Health Check: http://${host}:${port}/api/health\n`);

    return app;
}
