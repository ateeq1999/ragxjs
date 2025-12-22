# RAGX Framework

Production-ready RAG (Retrieval-Augmented Generation) framework built on ElysiaJS and Bun, designed for developers to rapidly build and deploy RAG-powered APIs through simple configuration files.

## Features

✅ **Configuration-Driven**: Define your RAG agents with simple TypeScript config files  
✅ **Type-Safe**: Full TypeScript support with strict mode enabled  
✅ **RAGX Compliant**: Follows strict RAG best practices for grounded, deterministic responses  
✅ **Multiple Providers**: Support for OpenAI, Mistral, and more  
✅ **Vector Databases**: ChromaDB, in-memory, and extensible adapter system  
✅ **Streaming Support**: Real-time response streaming  
✅ **Bun-First**: Optimized for Bun runtime with fallback to Node.js  

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ragx.git
cd ragx

# Install dependencies
bun install

# Build all packages
bun run build
```

### Basic Usage

1. **Create a configuration file** (`agent.config.ts`):

```typescript
export default {
  agents: [{
    name: "docs-assistant",
    model: {
      provider: "openai",
      model: "gpt-4-turbo",
      temperature: 0.7
    },
    embeddings: {
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536
    },
    vectorStore: {
      provider: "memory", // Use in-memory for development
    },
    retrieval: {
      topK: 5,
      scoreThreshold: 0.7
    }
  }],
  server: {
    port: 3000
  }
};
```

2. **Use the RAG engine**:

```typescript
import { RAGEngine } from "@ragx/core";
import { createLLMProvider } from "@ragx/llm";
import { createEmbeddingProvider } from "@ragx/embeddings";
import { createVectorStore } from "@ragx/vectordb";
import { loadConfig } from "@ragx/config";

// Load configuration
const config = await loadConfig();
const agentConfig = config.agents[0];

// Create providers
const llm = createLLMProvider(agentConfig.model, process.env.OPENAI_API_KEY!);
const embeddings = createEmbeddingProvider(agentConfig.embeddings, process.env.OPENAI_API_KEY!);
const vectorStore = createVectorStore(agentConfig.vectorStore);

// Create RAG engine
const ragEngine = new RAGEngine(agentConfig, llm, embeddings, vectorStore);

// Ingest documents
await ragEngine.ingest([
  {
    id: "doc-1",
    content: "RAGX is a production-ready RAG framework built on ElysiaJS...",
    source: "readme.md"
  }
]);

// Query
const response = await ragEngine.query("What is RAGX?");
console.log(response.answer);
console.log(response.sources);
```

## Architecture

### Packages

- **@ragx/config**: Configuration schema and validation with Zod
- **@ragx/core**: Core RAG engine with document processing, retrieval, and context building
- **@ragx/llm**: LLM provider integrations (OpenAI, Mistral)
- **@ragx/embeddings**: Embedding provider integrations with caching
- **@ragx/vectordb**: Vector database adapters (ChromaDB, in-memory)
- **@ragx/server**: ElysiaJS server wrapper (coming soon)
- **@ragx/cli**: CLI tool for scaffolding and development (coming soon)

### RAGX Compliance

This framework follows strict RAGX rules for production-grade RAG systems:

- **Grounded Responses**: Only answers based on retrieved context
- **Deterministic Retrieval**: temperature=0 for query expansion
- **Insufficient Context Handling**: Returns `INSUFFICIENT_CONTEXT` when appropriate
- **Verification**: Automatic grounding verification before returning responses
- **Agent Isolation**: Each agent has isolated memory and vector namespace
- **Config-Driven**: All behavior controlled via validated configuration

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Type check
bun run type-check

# Lint and format
bun run lint
bun run format
```

## Monorepo Structure

```
ragx/
├── packages/
│   ├── config/          # Configuration system
│   ├── core/            # Core RAG engine
│   ├── llm/             # LLM providers
│   ├── embeddings/      # Embedding providers
│   ├── vectordb/        # Vector DB adapters
│   ├── server/          # ElysiaJS server (coming soon)
│   └── cli/             # CLI tool (coming soon)
├── examples/
│   └── basic-rag/       # Basic example (coming soon)
└── apps/
    └── docs/            # Documentation site (coming soon)
```

## Roadmap

- [x] Phase 1: Core framework (config, core, providers)
- [ ] Phase 2: ElysiaJS server integration
- [ ] Phase 3: CLI tool
- [ ] Phase 4: Examples and documentation
- [ ] Phase 5: Advanced features (reranking, multi-agent, tools)
- [ ] v0.1.0 Release

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
