# RAGx Framework Development Plan

## Overview
RAGx is a production-ready RAG (Retrieval-Augmented Generation) framework built on ElysiaJS, designed for developers to rapidly build and deploy RAG-powered APIs through simple configuration files.

---

## Core Architecture

### Technology Stack
- **Runtime**: Bun.js (primary), Node.js (fallback support)
- **Package Manager**: Bunjs (primary), pnpm (fallback)
- **Web Framework**: ElysiaJS
- **Language**: TypeScript
- **Monorepo**: Turborepo
- **Testing**: Vitest + Bun test
- **Linting**: ESLint + Biome

### Project Structure
```
ragx/
├── packages/
│   ├── core/                 # Core RAG engine
│   ├── server/               # ElysiaJS server wrapper
│   ├── embeddings/           # Vector embedding providers
│   ├── vectordb/             # Vector database adapters
│   ├── llm/                  # LLM provider integrations
│   ├── cli/                  # CLI tool for scaffolding
│   └── config/               # Configuration schema & validation
├── examples/
│   ├── basic-rag/
│   ├── multi-agent/
│   └── production-ready/
├── apps/
│   └── docs/                 # Documentation site
└── .github/
    └── workflows/            # CI/CD pipelines
```

---

## Phase 1: Core Framework (Weeks 1-3)

### 1.1 Configuration System (`packages/config`) ✅
**Features:**
- ✅ Type-safe configuration schema using Zod
- ✅ Hot-reload configuration changes
- ✅ Environment variable interpolation
- ✅ Multi-agent configuration support
- ✅ Validation with helpful error messages

**Configuration File Structure:**
```typescript
// agent.config.ts
export default {
  agents: [{
    name: "customer-support",
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
      provider: "pinecone",
      index: "customer-docs",
      namespace: "support"
    },
    retrieval: {
      topK: 5,
      scoreThreshold: 0.7,
      rerankModel: "cohere-rerank-v3"
    },
    endpoints: {
      chat: "/api/chat",
      ingest: "/api/ingest",
      search: "/api/search"
    }
  }],
  server: {
    port: 3000,
    cors: { origin: "*" },
    rateLimit: { max: 100, window: "15m" }
  }
}
```

### 1.2 Core RAG Engine (`packages/core`) ✅
**Features:**
- ✅ Document ingestion pipeline
- ✅ Chunking strategies (fixed, semantic, recursive)
- ✅ Metadata extraction and filtering
- ✅ Hybrid search (vector + keyword) [Partially - Interface exists, adapters pending]
- ✅ Context window management
- ✅ Query transformation & expansion
- ✅ Response streaming
- ✅ Conversation memory

**Key Classes:**
- `RAGEngine` - Main orchestrator
- `DocumentProcessor` - Chunking & preprocessing
- `Retriever` - Vector + keyword search
- `ContextBuilder` - Prompt construction
- `ResponseGenerator` - LLM interaction

### 1.3 ElysiaJS Server (`packages/server`) ✅
**Features:**
- ✅ Auto-generated REST endpoints from config
- ✅ WebSocket support for streaming
- ✅ Built-in authentication middleware
- ✅ Request validation with Elysia's type system
- ✅ OpenAPI/Swagger documentation
- ✅ Observability hooks (logging, tracing)

**Auto-generated Endpoints:**
```
POST   /api/agents/{agentName}/chat       # Chat with RAG agent
POST   /api/agents/{agentName}/ingest     # Ingest documents
GET    /api/agents/{agentName}/search     # Semantic search
DELETE /api/agents/{agentName}/documents  # Delete documents
GET    /api/health                         # Health check
GET    /api/metrics                        # Prometheus metrics
```

---

## Phase 2: Provider Integrations (Weeks 4-6)

### 2.1 LLM Providers (`packages/llm`) ✅
**Supported Providers:**
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude 3)
- ✅ Google (Gemini)
- ✅ Mistral
- ✅ Cohere
- ✅ Local models via Ollama
- [ ] Azure OpenAI (Next)
- [ ] DeepSeek (Next)

**Features:**
- ✅ Unified interface for all providers
- ✅ Automatic retry with exponential backoff
- ✅ Token counting and budget management
- ✅ Streaming support
- Function calling / tool use

### 2.2 Embedding Providers (`packages/embeddings`) ✅
**Supported Providers:**
- ✅ OpenAI (text-embedding-3-small/large)
- ✅ Cohere (embed-v3)
- ✅ Mistral
- HuggingFace (sentence-transformers)
- Voyage AI
- Local models (BGE, E5)

**Features:**
- ✅ Batch embedding with optimal chunk sizes
- Dimension reduction
- ✅ Caching layer for repeated texts
- Async processing queue

### 2.3 Vector Database Adapters (`packages/vectordb`) ✅
**Supported Databases:**
- ✅ Pinecone
- Weaviate
- Qdrant
- ✅ Chroma
- Milvus
- PostgreSQL (pgvector)
- ✅ LibSQL
- ✅ In-memory (for development)

**Features:**
- ✅ CRUD operations for vectors
- ✅ Metadata filtering
- [ ] Hybrid search support
- ✅ Batch operations
- Namespace management

---

## Phase 3: Advanced Features (Weeks 7-10)

### 3.1 Advanced Retrieval
- **Reranking**: Cohere, Cross-encoder models
- **Query Decomposition**: Break complex queries into sub-queries
- **Hypothetical Document Embeddings (HyDE)**
- **Parent Document Retrieval**: Retrieve full context
- **Multi-query Retrieval**: ✅ Generate multiple query variations
- **Contextual Compression**: Remove irrelevant parts

### 3.2 Agent Capabilities
- **Tool/Function Calling**: Allow agents to use external tools
- **Multi-step Reasoning**: Chain-of-thought prompting
- **Memory Systems**: ✅ Short-term and long-term memory
- **Agent Collaboration**: Multi-agent workflows
- **Guardrails**: Content filtering and safety checks

### 3.3 Observability & Monitoring
- **Structured Logging**: JSON logs with trace IDs
- **Metrics**: Prometheus-compatible metrics
- **Tracing**: OpenTelemetry integration
- **Dashboard**: Real-time metrics UI
- **Cost Tracking**: Token usage and cost per request

### 3.4 Document Processing
- **File Format Support**: PDF, DOCX, TXT, MD, HTML, CSV
- **OCR Integration**: Extract text from images
- **Table Extraction**: Preserve table structure
- **Code Processing**: Language-specific chunking
- **URL Scraping**: Web page ingestion

---

## Phase 4: Developer Experience (Weeks 11-12)

### 4.1 CLI Tool (`packages/cli`) [/]
- ✅ Project initialization (`ragx init`)
- ✅ Dev server management (`ragx dev`)
- [/] Bulk ingestion tool (`ragx ingest`)
- [ ] Agent testing suite (`ragx test`)

```bash
# Initialize new RAGx project
ragx init my-rag-app

# Generate agent config
ragx agent create customer-support

# Ingest documents
ragx ingest ./docs --agent customer-support

# Start dev server
ragx dev

# Build for production
ragx build

# Deploy
ragx deploy
```

### 4.2 Development Tools
- **Hot Reload**: Watch config and code changes
- **Interactive REPL**: Test queries in terminal
- **Config Validator**: Validate config files
- **Migration Tool**: Upgrade configs between versions
- **Playground UI**: Web-based testing interface

### 4.3 Testing Utilities
- **Mock Providers**: Test without API keys
- **Fixtures**: Sample documents and queries
- **Evaluation Suite**: RAG performance metrics
- **Integration Tests**: End-to-end testing helpers

---

## Phase 5: Production Features (Weeks 13-15)

### 5.1 Performance Optimization
- **Caching Layer**: Redis/in-memory caching
- **Connection Pooling**: Reuse database connections
- **Batch Processing**: Queue-based document ingestion
- **Compression**: Gzip response compression
- **CDN Support**: Static asset optimization

### 5.2 Security
- **API Key Authentication**: Built-in auth middleware
- **JWT Support**: Token-based authentication
- **Rate Limiting**: Per-user/IP rate limits
- **CORS Configuration**: Fine-grained CORS control
- **Input Sanitization**: XSS and injection prevention

### 5.3 Deployment
- **Docker Images**: Optimized Dockerfile
- **Kubernetes Manifests**: Helm charts
- **Serverless Adapters**: AWS Lambda, Vercel, Cloudflare Workers
- **Health Checks**: Readiness and liveness probes
- **Graceful Shutdown**: Clean resource cleanup

---

## Feature List (MVP)

### Must-Have (Phase 1-2)
- ✅ Configuration-driven agent setup
- ✅ ElysiaJS REST API generation
- ✅ OpenAI integration (LLM + embeddings)
- ✅ Pinecone vector database
- ✅ Document chunking and ingestion
- ✅ Basic RAG query flow
- ✅ Streaming responses
- ✅ CLI for project scaffolding (`ragx init`)
- ✅ Hot-reload development mode (via Bun)

### Should-Have (Phase 3)
- ✅ Multiple LLM providers
- ✅ Multiple vector databases
- ✅ Reranking support
- ✅ Query transformations
- ✅ Memory/conversation history
- ✅ Observability (logs, metrics)
- ✅ Authentication middleware
- ✅ Rate limiting

### Nice-to-Have (Phase 4-5)
- ✅ Multi-agent workflows
- ✅ Tool/function calling
- ✅ Advanced document processing
- ✅ Evaluation framework
- ✅ Admin dashboard UI
- ✅ Plugin system
- ✅ Deployment templates

---

## Testing Strategy

### Unit Tests
```bash
# Run all tests
pnpm turbo run test

# Test specific package
pnpm turbo run test --filter @ragx/core

# Watch mode
pnpm --filter @ragx/core test:watch

# Coverage
pnpm turbo run test:coverage
```

### Integration Tests
- End-to-end API tests with real ElysiaJS server
- Mock external providers (LLM, vector DB)
- Test configuration loading and validation
- Test document ingestion pipeline

### E2E Tests
- Full workflow tests with Docker Compose
- Real provider integrations (in CI only)
- Performance benchmarks
- Load testing

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
- Lint (ESLint + Biome)
- Type check (TypeScript)
- Unit tests (Vitest)
- Integration tests
- Build artifacts
- Publish to npm (on release)
```

---

## Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `release/*` - Release preparation

### PR Requirements
- ✅ Title: `[package-name] Description`
- ✅ All tests passing
- ✅ Lint checks passing
- ✅ Code coverage maintained
- ✅ Documentation updated
- ✅ Changeset added

### Commit Convention
```
type(scope): subject

feat(core): add semantic chunking strategy
fix(server): resolve CORS preflight issue
docs(cli): update init command examples
test(embeddings): add OpenAI batch tests
```

---

## Documentation Plan

### Developer Docs
1. **Getting Started**: Quick start guide
2. **Configuration Reference**: All config options
3. **API Reference**: Generated from TypeScript types
4. **Recipes**: Common use cases
5. **Architecture**: System design and flow diagrams
6. **Contributing**: Development guide

### User Docs
1. **Installation**: Setup instructions
2. **Tutorials**: Step-by-step guides
3. **Examples**: Real-world implementations
4. **Deployment**: Production deployment guides
5. **Troubleshooting**: Common issues and solutions
6. **FAQ**: Frequently asked questions

---

## Success Metrics

### Performance Targets
- Query latency: < 500ms (p95)
- Throughput: > 100 req/s per instance
- Memory usage: < 512MB base
- Cold start: < 2s

### Developer Experience
- Time to first query: < 5 minutes
- Config to API: Zero additional code
- Documentation coverage: > 90%
- Example coverage: All major use cases

### Quality Metrics
- Test coverage: > 80%
- Type safety: 100% (strict mode)
- Zero runtime errors in core
- Semantic versioning compliance

---

## Release Plan

### v0.1.0 (MVP) - Week 6
- Core RAG engine
- OpenAI + Pinecone
- Basic CLI
- ElysiaJS server

### v0.2.0 - Week 9
- Multi-provider support
- Advanced retrieval
- Observability

### v0.3.0 - Week 12
- Multi-agent support
- Tool calling
- Admin UI

### v1.0.0 - Week 15
- Production hardening
- Full documentation
- Deployment templates
- Plugin system

---

## Example Usage

### Minimal Setup
```typescript
// agent.config.ts
export default {
  agents: [{
    name: "docs",
    model: { provider: "openai", model: "gpt-4" },
    embeddings: { provider: "openai" },
    vectorStore: { provider: "pinecone", index: "docs" }
  }]
}
```

```bash
# Start server
ragx dev

# Ingest documents
curl -X POST http://localhost:3000/api/agents/docs/ingest \
  -F "file=@./readme.md"

# Query
curl -X POST http://localhost:3000/api/agents/docs/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What does this project do?"}'
```

### Advanced Setup
```typescript
export default {
  agents: [
    {
      name: "technical-support",
      model: {
        provider: "anthropic",
        model: "claude-3-opus",
        temperature: 0.3,
        maxTokens: 4096
      },
      embeddings: {
        provider: "cohere",
        model: "embed-english-v3.0"
      },
      vectorStore: {
        provider: "qdrant",
        url: process.env.QDRANT_URL,
        collection: "technical-docs"
      },
      retrieval: {
        strategy: "hybrid",
        topK: 10,
        rerankModel: "cohere-rerank-v3",
        scoreThreshold: 0.75
      },
      memory: {
        type: "buffer",
        maxMessages: 20
      },
      tools: [
        { name: "search_tickets", endpoint: "/api/tickets/search" },
        { name: "create_ticket", endpoint: "/api/tickets/create" }
      ]
    },
    {
      name: "sales-assistant",
      model: { provider: "openai", model: "gpt-4-turbo" },
      embeddings: { provider: "openai" },
      vectorStore: { provider: "pinecone", index: "sales-docs" }
    }
  ],
  server: {
    port: 3000,
    cors: { origin: ["https://app.example.com"] },
    rateLimit: { max: 100, window: "15m" },
    auth: {
      type: "jwt",
      secret: process.env.JWT_SECRET
    }
  },
  observability: {
    logging: { level: "info", format: "json" },
    metrics: { enabled: true, port: 9090 },
    tracing: { enabled: true, endpoint: process.env.OTEL_ENDPOINT }
  }
}
```

---

## Community & Support

### Open Source Strategy
- MIT License
- GitHub Discussions for community
- Discord server for real-time help
- Monthly community calls
- Contributor recognition

### Support Channels
1. Documentation site
2. GitHub Issues (bugs)
3. GitHub Discussions (questions)
4. Discord (community chat)
5. Stack Overflow tag: `ragx`

---

## Next Steps

1. **Week 1**: Setup monorepo, core architecture
2. **Week 2**: Configuration system, basic RAG engine
3. **Week 3**: ElysiaJS server integration
4. **Week 4**: OpenAI + Pinecone integration
5. **Week 5**: CLI tool, hot-reload dev mode
6. **Week 6**: Testing, documentation, v0.1.0 release

**Ready to start coding? Let's build RAGx! 🚀**