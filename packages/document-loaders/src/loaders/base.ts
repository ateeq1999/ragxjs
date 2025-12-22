import type { Document, IDocumentLoader } from "@ragx/core";
import path from "node:path";

/**
 * Base document loader
 */
export abstract class BaseLoader implements IDocumentLoader {
    constructor(protected readonly filePath: string) { }

    /**
     * Load documents from the source
     */
    abstract load(): Promise<Document[]>;

    /**
     * Helper to create a document object
     */
    protected createDocument(content: string, metadata: Record<string, any> = {}): Document {
        return {
            id: crypto.randomUUID(),
            content,
            source: path.basename(this.filePath),
            metadata: {
                ...metadata,
                path: this.filePath,
                extension: path.extname(this.filePath),
            },
        };
    }
}
