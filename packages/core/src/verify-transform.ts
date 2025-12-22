
import { QueryTransformer } from "./query-transformer";
import type { ILLMProvider, LLMResponse } from "./interfaces";

// Mock LLM Provider
class MockLLMProvider implements ILLMProvider {
    async generate(prompt: string, options?: any): Promise<LLMResponse> {
        if (prompt.includes("rewrite the following user query")) {
            return {
                content: "rewritten query version",
                model: "mock-model",
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
            };
        } else if (prompt.includes("Generate 3 different versions")) {
            return {
                content: "expansion 1\nexpansion 2\nexpansion 3",
                model: "mock-model",
                usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
            };
        }
        return { content: "default response", model: "mock-model" };
    }

    async *generateStream(prompt: string, options?: any): AsyncGenerator<string, void, unknown> {
        yield "mock stream response";
    }
}

async function verifyQueryTransformer() {
    console.log("Starting QueryTransformer verification...");

    const llm = new MockLLMProvider();
    const transformer = new QueryTransformer(llm);

    // Test Rewrite
    console.log("\nTesting Rewrite...");
    const originalQuery = "rag framework nodejs";
    const rewritten = await transformer.rewrite(originalQuery);
    console.log(`Original: "${originalQuery}"`);
    console.log(`Rewritten: "${rewritten}"`);

    if (rewritten === "rewritten query version") {
        console.log("✅ Rewrite Success");
    } else {
        console.log("❌ Rewrite Failed");
    }

    // Test Expand
    console.log("\nTesting Expand...");
    const expanded = await transformer.expand(originalQuery, 3);
    console.log(`Input: "${originalQuery}"`);
    console.log("Expanded:", expanded);

    if (expanded.length === 4 && expanded[0] === originalQuery && expanded[1] === "expansion 1") {
        console.log("✅ Expand Success");
    } else {
        console.log("❌ Expand Failed");
    }
}

verifyQueryTransformer().catch(console.error);
