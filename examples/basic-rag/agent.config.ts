export default {
    agents: [
        {
            name: "docs-assistant",
            enabled: true,
            model: {
                provider: "openai",
                model: "gpt-4-turbo",
                temperature: 0.7,
            },
            embeddings: {
                provider: "openai",
                model: "text-embedding-3-small",
                dimensions: 1536,
                batchSize: 100,
            },
            vectorStore: {
                provider: "memory", // Use in-memory for development
            },
            retrieval: {
                strategy: "vector",
                topK: 5,
                scoreThreshold: 0.7,
            },
            memory: {
                type: "none",
            },
        },
    ],
    server: {
        port: 3000,
        host: "0.0.0.0",
        cors: {
            origin: "*",
        },
    },
    observability: {
        logging: {
            level: "info",
            format: "json",
        },
    },
};
