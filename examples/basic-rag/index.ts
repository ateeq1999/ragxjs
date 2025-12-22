import { RAGEngine } from "../../packages/core/src/index.ts";
import { createLLMProvider } from "../../packages/llm/src/index.ts";
import { createEmbeddingProvider } from "../../packages/embeddings/src/index.ts";
import { createVectorStore } from "../../packages/vectordb/src/index.ts";
import { loadConfig } from "../../packages/config/src/index.ts";

async function main() {
    console.log("🚀 RAGX Basic Example\n");

    // Load configuration
    const config = await loadConfig({ configPath: "./agent.config.ts" });
    const agentConfig = config.agents[0];

    if (!agentConfig) {
        throw new Error("No agent configuration found");
    }

    console.log(`📋 Agent: ${agentConfig.name}`);
    console.log(`🤖 Model: ${agentConfig.model.provider}/${agentConfig.model.model}`);
    console.log(`📊 Embeddings: ${agentConfig.embeddings.provider}\n`);

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is required");
    }

    // Create providers
    const llm = createLLMProvider(agentConfig.model, apiKey);
    const embeddings = createEmbeddingProvider(agentConfig.embeddings, apiKey);
    const vectorStore = createVectorStore(agentConfig.vectorStore);

    // Create RAG engine
    const ragEngine = new RAGEngine(agentConfig, llm, embeddings, vectorStore);

    // Sample documents
    const documents = [
        {
            id: "doc-1",
            content: `RAGX is a production-ready RAG framework built on ElysiaJS and Bun.
        It provides a configuration-driven approach to building RAG-powered APIs.
        The framework follows strict RAGX compliance rules for grounded, deterministic responses.`,
            source: "readme.md",
            metadata: { category: "framework" },
        },
        {
            id: "doc-2",
            content: `The framework supports multiple LLM providers including OpenAI and Mistral.
        It also supports various vector databases like ChromaDB and includes an in-memory option for development.
        All providers are hot-swappable via configuration.`,
            source: "architecture.md",
            metadata: { category: "providers" },
        },
        {
            id: "doc-3",
            content: `RAGX implements automatic grounding verification to ensure responses are based on retrieved context.
        When context is insufficient, it returns INSUFFICIENT_CONTEXT instead of hallucinating.
        This makes it suitable for production use cases requiring high accuracy.`,
            source: "features.md",
            metadata: { category: "features" },
        },
    ];

    // Ingest documents
    console.log("📥 Ingesting documents...");
    const ingestResult = await ragEngine.ingest(documents);
    console.log(`✅ Processed ${ingestResult.processed} documents into ${ingestResult.chunks} chunks\n`);

    // Query 1: Should have sufficient context
    console.log("❓ Query 1: What is RAGX?");
    const response1 = await ragEngine.query("What is RAGX?");
    console.log(`💬 Answer: ${response1.answer}`);
    console.log(`📚 Sources: ${response1.sources.length} documents`);
    console.log(`✓ Context sufficient: ${response1.contextSufficient}\n`);

    // Query 2: Should have sufficient context
    console.log("❓ Query 2: What providers does RAGX support?");
    const response2 = await ragEngine.query("What providers does RAGX support?");
    console.log(`💬 Answer: ${response2.answer}`);
    console.log(`📚 Sources: ${response2.sources.length} documents`);
    console.log(`✓ Context sufficient: ${response2.contextSufficient}\n`);

    // Query 3: Should return INSUFFICIENT_CONTEXT
    console.log("❓ Query 3: What is quantum computing?");
    const response3 = await ragEngine.query("What is quantum computing?");
    console.log(`💬 Answer: ${response3.answer}`);
    console.log(`📚 Sources: ${response3.sources.length} documents`);
    console.log(`✓ Context sufficient: ${response3.contextSufficient}\n`);

    console.log("✨ Example completed!");
}

main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
});
