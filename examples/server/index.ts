import { loadConfig } from "../../packages/config/src/index.ts";
import { startServer } from "../../packages/server/src/index.ts";

async function main() {
    console.log("🚀 Starting RAGX Server Example\n");

    // Load configuration
    const config = await loadConfig({ configPath: "./agent.config.ts" });

    // API keys from environment
    const apiKeys = {
        openai: process.env.OPENAI_API_KEY || "",
        mistral: process.env.MISTRAL_API_KEY || "",
    };

    // Validate API keys
    for (const agent of config.agents) {
        const llmKey = apiKeys[agent.model.provider as keyof typeof apiKeys];
        const embeddingKey = apiKeys[agent.embeddings.provider as keyof typeof apiKeys];

        if (!llmKey) {
            throw new Error(`Missing API key for ${agent.model.provider}. Set ${agent.model.provider.toUpperCase()}_API_KEY environment variable.`);
        }

        if (!embeddingKey) {
            throw new Error(`Missing API key for ${agent.embeddings.provider}. Set ${agent.embeddings.provider.toUpperCase()}_API_KEY environment variable.`);
        }
    }

    // Start server
    await startServer({ config, apiKeys });
}

main().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
});
