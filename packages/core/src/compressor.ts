import type {
    ICompressor,
    ILLMProvider,
    IEmbeddingProvider,
    RetrievedDocument,
} from "./interfaces";
import { countTokens } from "./document-processor";

/**
 * LLM-based contextual compressor
 * Uses an LLM to extract relevant snippets from chunks
 */
export class LLMCompressor implements ICompressor {
    constructor(
        private readonly llmProvider: ILLMProvider,
        private readonly options: { maxTokensPerDoc?: number | undefined } = {}
    ) { }

    async compress(query: string, documents: RetrievedDocument[]): Promise<RetrievedDocument[]> {
        const compressedDocs: RetrievedDocument[] = [];

        // Distill each document in parallel
        const distillationPromises = documents.map(async (doc) => {
            const prompt = `Extract the most relevant parts from the following context that answer the user's question.
If the context is irrelevant, respond with "IRRELEVANT".
Only extract relevant snippets, do not summarize or add commentary.

User Question: ${query}

Context:
${doc.chunk.content}

Relevant Snippets:`;

            const response = await this.llmProvider.generate(prompt, {
                temperature: 0,
                maxTokens: this.options.maxTokensPerDoc || 300
            });

            const distilledContent = response.content.trim();

            if (distilledContent !== "IRRELEVANT" && distilledContent.length > 0) {
                return {
                    ...doc,
                    chunk: {
                        ...doc.chunk,
                        content: distilledContent,
                        tokenCount: countTokens(distilledContent)
                    }
                };
            }
            return null;
        });

        const results = await Promise.all(distillationPromises);

        for (const res of results) {
            if (res) compressedDocs.push(res);
        }

        return compressedDocs;
    }
}

/**
 * Embeddings-based contextual compressor
 * Splits chunks into sentences and keeps top K based on similarity
 */
export class EmbeddingsCompressor implements ICompressor {
    constructor(
        private readonly embeddingProvider: IEmbeddingProvider,
        private readonly options: { maxTokensPerDoc?: number | undefined } = {}
    ) { }

    async compress(query: string, documents: RetrievedDocument[]): Promise<RetrievedDocument[]> {
        // Enforce a sensible default for max tokens per doc if not provided
        const maxTokens = this.options.maxTokensPerDoc || 250;

        // 1. Get query embedding
        const [queryEmbedding] = await this.embeddingProvider.embed([query]);
        if (!queryEmbedding) return documents;

        const compressedDocs: RetrievedDocument[] = [];

        for (const doc of documents) {
            // 2. Split chunk into sentences
            const sentences = doc.chunk.content
                .split(/[.!?]+\s+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);

            if (sentences.length <= 1) {
                compressedDocs.push(doc);
                continue;
            }

            // 3. Embed all sentences
            const sentenceEmbeddings = await this.embeddingProvider.embed(sentences);

            // 4. Calculate similarities and sort
            const scoredSentences = sentences.map((sentence, i) => {
                const emb = sentenceEmbeddings[i];
                if (!emb) return { sentence, similarity: 0, tokens: countTokens(sentence) };
                const similarity = this.cosineSimilarity(queryEmbedding, emb);
                return { sentence, similarity, tokens: countTokens(sentence) };
            });

            // Re-order by original appearance but filter by similarity?
            // BETTER: Sort by similarity, then take top N within token limit, then re-sort by original index
            const sortedSentences = scoredSentences
                .sort((a, b) => b.similarity - a.similarity);

            const selectedSentences: typeof scoredSentences = [];
            let currentTokens = 0;

            for (const item of sortedSentences) {
                if (currentTokens + item.tokens <= maxTokens) {
                    selectedSentences.push(item);
                    currentTokens += item.tokens;
                }
            }

            // Re-sort selected sentences by original index to maintain local context/flow
            const finalSentences = selectedSentences
                .sort((a, b) => {
                    return sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence);
                })
                .map(s => s.sentence);

            const distilledContent = finalSentences.join(". ") + ".";

            compressedDocs.push({
                ...doc,
                chunk: {
                    ...doc.chunk,
                    content: distilledContent,
                    tokenCount: countTokens(distilledContent)
                }
            });
        }

        return compressedDocs;
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            const a = vecA[i] ?? 0;
            const b = vecB[i] ?? 0;
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
    }
}
