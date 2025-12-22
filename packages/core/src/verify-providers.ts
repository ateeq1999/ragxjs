
import { AnthropicProvider } from "../../llm/src/providers/anthropic";
import { GoogleProvider } from "../../llm/src/providers/google";
import { PineconeStore } from "../../vectordb/src/adapters/pinecone";
import { CohereEmbeddings } from "../../embeddings/src/providers/cohere";

// Basic checks to ensure classes are instantiable and types align (static check mostly)
async function verify() {
    console.log("Verifying provider instantiation...");

    try {
        const anthropic = new AnthropicProvider({ apiKey: "mock" });
        console.log("✅ AnthropicProvider instantiable");
    } catch (e) { console.error("❌ AnthropicProvider failed", e); }

    try {
        const google = new GoogleProvider({ apiKey: "mock" });
        console.log("✅ GoogleProvider instantiable");
    } catch (e) { console.error("❌ GoogleProvider failed", e); }

    try {
        const pinecone = new PineconeStore({ apiKey: "mock", index: "test" });
        console.log("✅ PineconeStore instantiable");
    } catch (e) { console.error("❌ PineconeStore failed", e); }

    try {
        const cohere = new CohereEmbeddings({ apiKey: "mock" });
        console.log("✅ CohereEmbeddings instantiable");
    } catch (e) { console.error("❌ CohereEmbeddings failed", e); }
}

verify();
