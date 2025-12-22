
import { RAGEngine } from "./rag-engine";
import type {
    ILLMProvider,
    IEmbeddingProvider,
    IVectorStore,
    DocumentChunk,
    LLMResponse,
    RAGResponse
} from "./interfaces";
import type { AgentConfig } from "@ragx/config";

// Mocks
class MockLLM implements ILLMProvider {
    async generate(prompt: string): Promise<LLMResponse> {
        return { content: "Complete response", model: "mock" };
    }
    async *generateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        const words = ["This", " ", "is", " ", "a", " ", "streamed", " ", "response."];
        for (const word of words) {
            await new Promise(r => setTimeout(r, 10)); // simulate delay
            yield word;
        }
    }
}

class MockEmbeddings implements IEmbeddingProvider {
    async embed(texts: string[]): Promise<number[][]> {
        return texts.map(() => [0.1, 0.2, 0.3]);
    }
    getDimensions() { return 3; }
}

class MockVectorStore implements IVectorStore {
    async add() { }
    async search() { return []; } // Return empty to trigger INSUFFICIENT_CONTEXT check or mock some docs
    async delete() { }
    async getInfo() { return { count: 0, dimensions: 3 }; }
}

// Config
const config: AgentConfig = {
    name: "test-agent",
    model: { provider: "openai", model: "gpt-4" },
    embeddings: { provider: "openai" },
    vectorStore: { provider: "memory" },
    // Enable rewrite to test that flow too
    queryTransformation: {
        rewrite: false,
        expand: false
    }
};

async function verifyStreaming() {
    console.log("Starting Streaming Verification...");

    const llm = new MockLLM();
    const embeddings = new MockEmbeddings();
    const vectorStore = new MockVectorStore();

    // Mock search to return something so we don't bail early
    vectorStore.search = async () => [{
        chunk: {
            id: "1", content: "context content", documentId: "d1",
            position: 0, tokenCount: 5, checksum: "c", createdAt: new Date(), metadata: {}
        },
        score: 0.9
    }];

    const engine = new RAGEngine(config, llm, embeddings, vectorStore);

    console.log("\nTesting queryStream...");
    const stream = engine.queryStream("test query");

    let fullText = "";
    for await (const chunk of stream) {
        process.stdout.write(chunk);
        fullText += chunk;
    }
    console.log("\n\nStream complete.");

    if (fullText === "This is a streamed response.") {
        console.log("✅ Streaming Content Correct");
    } else {
        console.log("❌ Streaming Content Mismatch");
    }
}

verifyStreaming().catch(console.error);
