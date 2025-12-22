import type { Document, IDocumentStore } from "./interfaces";

/**
 * In-memory document store
 */
export class MemoryDocumentStore implements IDocumentStore {
    private readonly documents = new Map<string, Document>();

    async add(documents: Document[]): Promise<void> {
        for (const doc of documents) {
            this.documents.set(doc.id, doc);
        }
    }

    async get(id: string): Promise<Document | undefined> {
        return this.documents.get(id);
    }

    async delete(ids: string[]): Promise<void> {
        for (const id of ids) {
            this.documents.delete(id);
        }
    }

    async getAll(): Promise<Document[]> {
        return Array.from(this.documents.values());
    }
}
