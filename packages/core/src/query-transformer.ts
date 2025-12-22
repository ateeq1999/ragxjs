
import type { ILLMProvider } from "./interfaces";

/**
 * Query transformation configuration
 */
export interface QueryTransformerConfig {
    rewrite?: boolean;
    expand?: boolean;
    decompose?: boolean;
    hyde?: boolean;
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

    /**
     * Decompose a complex query into simpler sub-queries
     */
    async decompose(query: string): Promise<string[]> {
        const prompt = `You are a helpful assistant that breaks down complex user queries into simpler, independent sub-questions.
If a query covers multiple topics or requires several steps to answer, split it into atomic questions.
Provide only the sub-questions, one per line. Do not number them.
If the query is already simple, return only the original query.

Original Query: "${query}"

Sub-questions:`;

        const response = await this.llmProvider.generate(prompt, {
            temperature: 0.2,
            maxTokens: 300
        });

        const subQuestions = response.content
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // If LLM failed to provide anything, return original
        return subQuestions.length > 0 ? subQuestions : [query];
    }

    /**
     * Generate a hypothetical document that answers the query (HyDE)
     */
    async generateHypotheticalDocument(query: string): Promise<string> {
        const prompt = `You are a knowledgeable assistant. Please write a short, concise, and professional answer to the following question. 
This answer will be used to improve document retrieval in a search system.
Do not include any introductory remarks like "Here is an answer". Just provide the direct answer.

Question: "${query}"

Hypothetical Answer:`;

        const response = await this.llmProvider.generate(prompt, {
            temperature: 0.3,
            maxTokens: 500
        });

        return response.content.trim();
    }
}
