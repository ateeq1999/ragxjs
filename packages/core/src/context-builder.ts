import { countTokens } from "./document-processor";
import type { IContextBuilder, RAGContext, RetrievedDocument } from "./interfaces";

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
        maxTokens: number,
        history?: Array<{ role: "user" | "assistant"; content: string }>,
    ): RAGContext {
        const systemPrompt = this.systemPrompt || this.defaultSystemPrompt;
        const usedDocs: RetrievedDocument[] = [];
        let currentTokens = 0;

        // Calculate tokens for fixed parts
        // System prompt
        currentTokens += countTokens(`System: ${systemPrompt}\n`);

        // Query + template overhead
        currentTokens += countTokens(`User: ${query}\nAssistant:`);

        // History
        if (history && history.length > 0) {
            const historyText = history.map(msg =>
                `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            ).join("\n");
            currentTokens += countTokens(`Conversation History:\n${historyText}\n`);
        }

        // Reserve space for "Context:" header and newlines
        currentTokens += countTokens("Context:\n\n");

        // Add documents until maxTokens is reached
        for (const doc of documents) {
            // Calculate formatting overhead per doc: "\n[N] Source: ... (Score: ...)\n"
            // content + overhead
            const docHeader = `\n[0] Source: ${doc.source} (Score: ${doc.score.toFixed(3)})\n`;
            const docTokens = (doc.chunk.tokenCount || countTokens(doc.chunk.content)) + countTokens(docHeader);

            if (currentTokens + docTokens <= maxTokens) {
                usedDocs.push(doc);
                currentTokens += docTokens;
            } else {
                // If we can't fit this document, we stop
                // Alternatively we could try to fit next smaller documents, but semantic relevance is usually prioritized order
                break;
            }
        }

        return {
            query,
            documents: usedDocs,
            ...(history ? { history } : {}),
            systemPrompt,
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
