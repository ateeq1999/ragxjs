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
            },
            vectorStore: {
                provider: "memory",
            },
            retrieval: {
                topK: 5,
                scoreThreshold: 0.7,
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
