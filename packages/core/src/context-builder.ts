import type { IContextBuilder, RAGContext, RetrievedDocument } from "./interfaces.ts";

/**
 * Context builder implementation
 */
export class ContextBuilder implements IContextBuilder {
    private readonly defaultSystemPrompt = `You are a helpful AI assistant that answers questions based on the provided context.
You must ONLY use information from the context to answer questions.
If the context does not contain enough information to answer the question, respond with exactly: "INSUFFICIENT_CONTEXT"
Do not use any prior knowledge or make assumptions beyond what is explicitly stated in the context.`;

    constructor(private readonly systemPrompt?: string) { }

    /**
     * Build context from query and retrieved documents
     */
    build(
        query: string,
        documents: RetrievedDocument[],
        history?: Array<{ role: "user" | "assistant"; content: string }>,
    ): RAGContext {
        return {
            query,
            documents,
            history,
            systemPrompt: this.systemPrompt || this.defaultSystemPrompt,
        };
    }

    /**
     * Format context into a prompt string
     */
    formatPrompt(context: RAGContext): string {
        const parts: string[] = [];

        // Add system prompt
        if (context.systemPrompt) {
            parts.push(`System: ${context.systemPrompt}\n`);
        }

        // Add retrieved context
        if (context.documents.length > 0) {
            parts.push("Context:");
            for (const [index, doc] of context.documents.entries()) {
                parts.push(`\n[${index + 1}] Source: ${doc.source} (Score: ${doc.score.toFixed(3)})`);
                parts.push(`${doc.chunk.content}\n`);
            }
            parts.push("");
        }

        // Add conversation history
        if (context.history && context.history.length > 0) {
            parts.push("Conversation History:");
            for (const msg of context.history) {
                parts.push(`${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`);
            }
            parts.push("");
        }

        // Add current query
        parts.push(`User: ${context.query}`);
        parts.push("Assistant:");

        return parts.join("\n");
    }

    /**
     * Verify that the response is grounded in the context
     * Returns true if grounded, false otherwise
     */
    verifyGrounding(response: string, context: RAGContext): boolean {
        // If response is INSUFFICIENT_CONTEXT, it's valid
        if (response.trim() === "INSUFFICIENT_CONTEXT") {
            return true;
        }

        // Check if we have any context
        if (context.documents.length === 0) {
            return false;
        }

        // Simple grounding check: response should reference context
        // In production, use more sophisticated verification
        const contextText = context.documents.map((d) => d.chunk.content.toLowerCase()).join(" ");
        const responseWords = response.toLowerCase().split(/\s+/);

        // Check if at least 30% of response words appear in context
        const matchingWords = responseWords.filter((word) =>
            word.length > 3 && contextText.includes(word)
        );

        const groundingRatio = matchingWords.length / responseWords.length;
        return groundingRatio >= 0.3;
    }
}
