
import type { ILLMProvider } from "./interfaces";

/**
 * Query transformation configuration
 */
export interface QueryTransformerConfig {
    rewrite?: boolean;
    expand?: boolean;
    maxExpansions?: number;
}

/**
 * Query transformer for rewriting and expanding queries
 */
export class QueryTransformer {
    constructor(private readonly llmProvider: ILLMProvider) { }

    /**
     * Rewrite a query to be more specific and clear
     */
    async rewrite(query: string, history?: string): Promise<string> {
        const prompt = `You are a helpful AI assistant. Your task is to rewrite the following user query to be more specific, clear, and standalone, making it suitable for retrieving relevant documents from a vector database.
${history ? `\nConversation History:\n${history}\n` : ""}
Original Query: "${query}"

Rewritten Query:`;

        const response = await this.llmProvider.generate(prompt, {
            temperature: 0.3,
            maxTokens: 200
        });

        return response.content.trim();
    }

    /**
     * Expand a query into multiple related queries
     */
    async expand(query: string, maxExpansions = 3): Promise<string[]> {
        const prompt = `You are a helper for a search system. Generate ${maxExpansions} different versions or related questions for the following user query to improve document retrieval coverage.
Provide only the questions, one per line. Do not number them.

Query: "${query}"

Related Questions:`;

        const response = await this.llmProvider.generate(prompt, {
            temperature: 0.5,
            maxTokens: 300
        });

        // Split by lines and filter empty
        const expansions = response.content
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);

        return [query, ...expansions].slice(0, maxExpansions + 1); // Helper + original
    }
}
