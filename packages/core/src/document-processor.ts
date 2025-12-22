import type { ChunkingStrategy, Document, DocumentChunk, IDocumentProcessor } from "./interfaces";

/**
 * Chunking options
 */
export interface ChunkingOptions {
    /** Maximum chunk size in tokens */
    maxTokens?: number;
    /** Overlap between chunks in tokens */
    overlap?: number;
    /** Minimum chunk size in tokens */
    minTokens?: number;
}

/**
 * Calculate token count (rough approximation)
 * In production, use a proper tokenizer like tiktoken
 */
export function countTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

/**
 * Document processor implementation
 */
export class DocumentProcessor implements IDocumentProcessor {
    private readonly defaultOptions: Required<ChunkingOptions> = {
        maxTokens: 500,
        overlap: 50,
        minTokens: 100,
    };

    constructor(private readonly options: ChunkingOptions = {}) {
        this.options = { ...this.defaultOptions, ...options };
    }

    /**
     * Process a document into chunks
     */
    async process(document: Document, strategy: ChunkingStrategy = "fixed"): Promise<DocumentChunk[]> {
        switch (strategy) {
            case "fixed":
                return this.fixedSizeChunking(document);
            case "semantic":
                return this.semanticChunking(document);
            case "recursive":
                return this.recursiveChunking(document);
            default:
                throw new Error(`Unknown chunking strategy: ${strategy}`);
        }
    }

    /**
     * Calculate token count (rough approximation)
     */
    countTokens(text: string): number {
        return countTokens(text);
    }

    /**
     * Fixed-size chunking with overlap
     */
    private fixedSizeChunking(document: Document): DocumentChunk[] {
        const { maxTokens, overlap } = this.options as Required<ChunkingOptions>;
        const chunks: DocumentChunk[] = [];
        const words = document.content.split(/\s+/);

        let position = 0;
        let startIdx = 0;

        while (startIdx < words.length) {
            // Calculate end index based on max tokens (rough approximation: 1 token ≈ 0.75 words)
            const tokensToWords = Math.floor(maxTokens * 0.75);
            let endIdx = Math.min(startIdx + tokensToWords, words.length);

            const chunkWords = words.slice(startIdx, endIdx);
            const content = chunkWords.join(" ");
            const tokenCount = this.countTokens(content);

            // Only create chunk if it meets minimum size
            if (tokenCount >= (this.options.minTokens || 100)) {
                chunks.push({
                    id: `${document.id}-chunk-${position}`,
                    content,
                    documentId: document.id,
                    position,
                    tokenCount,
                    checksum: this.generateChecksum(content),
                    createdAt: new Date(),
                    metadata: {
                        ...document.metadata,
                        source: document.source,
                        chunkStrategy: "fixed",
                    },
                });
                position++;
            }

            // Move start index forward with overlap
            const overlapWords = Math.floor(overlap * 0.75);
            startIdx = endIdx - overlapWords;

            // Prevent infinite loop
            if (startIdx >= words.length || endIdx === words.length) {
                break;
            }
        }

        return chunks;
    }

    /**
     * Semantic chunking (sentence-based)
     */
    private semanticChunking(document: Document): DocumentChunk[] {
        const { maxTokens } = this.options as Required<ChunkingOptions>;
        const chunks: DocumentChunk[] = [];

        // Split by sentences (simple regex)
        const sentences = document.content.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0);

        let currentChunk: string[] = [];
        let currentTokens = 0;
        let position = 0;

        for (const sentence of sentences) {
            const sentenceTokens = this.countTokens(sentence);

            if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
                // Create chunk
                const content = currentChunk.join(". ") + ".";
                chunks.push({
                    id: `${document.id}-chunk-${position}`,
                    content,
                    documentId: document.id,
                    position,
                    tokenCount: this.countTokens(content),
                    checksum: this.generateChecksum(content),
                    createdAt: new Date(),
                    metadata: {
                        ...document.metadata,
                        source: document.source,
                        chunkStrategy: "semantic",
                    },
                });

                position++;
                currentChunk = [];
                currentTokens = 0;
            }

            currentChunk.push(sentence);
            currentTokens += sentenceTokens;
        }

        // Add remaining chunk
        if (currentChunk.length > 0) {
            const content = currentChunk.join(". ") + ".";
            chunks.push({
                id: `${document.id}-chunk-${position}`,
                content,
                documentId: document.id,
                position,
                tokenCount: this.countTokens(content),
                checksum: this.generateChecksum(content),
                createdAt: new Date(),
                metadata: {
                    ...document.metadata,
                    source: document.source,
                    chunkStrategy: "semantic",
                },
            });
        }

        return chunks;
    }

    /**
     * Recursive chunking (for code and structured text)
     */
    private recursiveChunking(document: Document): DocumentChunk[] {
        const { maxTokens } = this.options as Required<ChunkingOptions>;
        const chunks: DocumentChunk[] = [];

        // Split by paragraphs first
        const paragraphs = document.content.split(/\n\n+/).filter((p) => p.trim().length > 0);

        let position = 0;

        for (const paragraph of paragraphs) {
            const tokens = this.countTokens(paragraph);

            if (tokens <= maxTokens) {
                // Paragraph fits in one chunk
                chunks.push({
                    id: `${document.id}-chunk-${position}`,
                    content: paragraph,
                    documentId: document.id,
                    position,
                    tokenCount: tokens,
                    checksum: this.generateChecksum(paragraph),
                    createdAt: new Date(),
                    metadata: {
                        ...document.metadata,
                        source: document.source,
                        chunkStrategy: "recursive",
                    },
                });
                position++;
            } else {
                // Split paragraph by lines
                const lines = paragraph.split(/\n/).filter((l) => l.trim().length > 0);
                let currentChunk: string[] = [];
                let currentTokens = 0;

                for (const line of lines) {
                    const lineTokens = this.countTokens(line);

                    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
                        const content = currentChunk.join("\n");
                        chunks.push({
                            id: `${document.id}-chunk-${position}`,
                            content,
                            documentId: document.id,
                            position,
                            tokenCount: this.countTokens(content),
                            checksum: this.generateChecksum(content),
                            createdAt: new Date(),
                            metadata: {
                                ...document.metadata,
                                source: document.source,
                                chunkStrategy: "recursive",
                            },
                        });
                        position++;
                        currentChunk = [];
                        currentTokens = 0;
                    }

                    currentChunk.push(line);
                    currentTokens += lineTokens;
                }

                // Add remaining chunk
                if (currentChunk.length > 0) {
                    const content = currentChunk.join("\n");
                    chunks.push({
                        id: `${document.id}-chunk-${position}`,
                        content,
                        documentId: document.id,
                        position,
                        tokenCount: this.countTokens(content),
                        checksum: this.generateChecksum(content),
                        createdAt: new Date(),
                        metadata: {
                            ...document.metadata,
                            source: document.source,
                            chunkStrategy: "recursive",
                        },
                    });
                    position++;
                }
            }
        }

        return chunks;
    }

    /**
     * Generate checksum for content using Bun's built-in hash
     */
    generateChecksum(content: string): string {
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(content);
        return hasher.digest("hex");
    }
}
