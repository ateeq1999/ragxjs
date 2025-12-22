# RAGX Server Example

This example demonstrates a complete RAGX server with REST API endpoints.

## Setup

1. **Install dependencies**:
```bash
cd ../..
bun install
```

2. **Set environment variables**:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

3. **Start the server**:
```bash
bun run index.ts
```

## API Endpoints

The server automatically generates the following endpoints:

### Chat
```bash
POST http://localhost:3000/api/agents/docs-assistant/chat
Content-Type: application/json

{
  "message": "What is RAGX?",
  "topK": 5,
  "temperature": 0.7,
  "stream": false
}
```

### Ingest Documents
```bash
POST http://localhost:3000/api/agents/docs-assistant/ingest
Content-Type: application/json

{
  "documents": [
    {
      "id": "doc-1",
      "content": "RAGX is a production-ready RAG framework...",
      "source": "readme.md",
      "metadata": { "category": "framework" }
    }
  ]
}
```

### Search
```bash
GET http://localhost:3000/api/agents/docs-assistant/search?query=RAGX&topK=5
```

### Health Check
```bash
GET http://localhost:3000/api/health
```

### Metrics
```bash
GET http://localhost:3000/api/metrics
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/swagger

## Features

✅ Auto-generated REST endpoints from configuration  
✅ Streaming response support  
✅ CORS enabled  
✅ Swagger/OpenAPI documentation  
✅ Health and metrics endpoints  
✅ Error handling  
✅ Multiple agent support  

## Example Usage

```bash
# 1. Start the server
bun run index.ts

# 2. Ingest a document
curl -X POST http://localhost:3000/api/agents/docs-assistant/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [{
      "id": "1",
      "content": "RAGX is awesome!",
      "source": "test.md"
    }]
  }'

# 3. Chat with the agent
curl -X POST http://localhost:3000/api/agents/docs-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is RAGX?"}'

# 4. Search for documents
curl "http://localhost:3000/api/agents/docs-assistant/search?query=RAGX"
```
