# Basic RAG Example

This example demonstrates a simple RAG agent using the RAGX framework.

## Setup

1. **Install dependencies**:
```bash
cd ../..
bun install
bun run build
```

2. **Set environment variables**:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

3. **Run the example**:
```bash
bun run index.ts
```

## Configuration

The `agent.config.ts` file defines a simple RAG agent with:
- OpenAI GPT-4 Turbo for generation
- OpenAI text-embedding-3-small for embeddings
- In-memory vector store (no persistence)
- Top-5 retrieval with 0.7 score threshold

## Usage

The example demonstrates:
1. Creating a RAG engine from configuration
2. Ingesting sample documents
3. Querying the RAG system
4. Handling insufficient context scenarios

## Output

You should see:
- Document ingestion results (number of chunks created)
- Query responses with sources
- `INSUFFICIENT_CONTEXT` for queries outside the knowledge base
