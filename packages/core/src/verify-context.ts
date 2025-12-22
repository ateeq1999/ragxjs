
import { ContextBuilder } from "./context-builder";
import type { RetrievedDocument, DocumentChunk } from "./interfaces";

console.log("Starting ContextBuilder verification...");

const builder = new ContextBuilder("You are a bot.");
const maxTokens = 150; // Increased to fit first doc but exclude second

// Mock documents
const mockChunk1: DocumentChunk = {
    id: "1",
    content: "This is a short document content.",
    documentId: "doc1",
    position: 0,
    tokenCount: 10,
    checksum: "abc",
    createdAt: new Date(),
    metadata: {}
};

const mockChunk2: DocumentChunk = {
    id: "2",
    content: "This is a much longer document content that should probably be excluded if the limit is tight. ".repeat(5),
    documentId: "doc2",
    position: 0,
    tokenCount: 50,
    checksum: "def",
    createdAt: new Date(),
    metadata: {}
};

const retrievedDocs: RetrievedDocument[] = [
    { chunk: mockChunk1, score: 0.9, source: "test" },
    { chunk: mockChunk2, score: 0.8, source: "test" }
];

console.log(`\nTesting with maxTokens=${maxTokens}`);
const context = builder.build("test query", retrievedDocs, maxTokens);

console.log(`Included documents: ${context.documents.length}`);
context.documents.forEach((doc, i) => {
    console.log(`Doc ${i + 1}: ${doc.chunk.id} (Tokens: ${doc.chunk.tokenCount})`);
});

const prompt = builder.formatPrompt(context);
console.log("\nGenerated Prompt:");
console.log("---------------------------------------------------");
console.log(prompt);
console.log("---------------------------------------------------");
console.log(`Prompt length: ${prompt.length} chars`);

// Verify
if (context.documents.length === 1 && context.documents[0].chunk.id === "1") {
    console.log("\n✅ SUCCESS: Only the first document fit within the limit.");
} else if (context.documents.length === 0) {
    console.log("\n❌ ALL EXCLUDED: Even the first document didn't fit?");
} else {
    console.log("\n❌ FAILURE: Context exceeded limit or logic failed.");
}
