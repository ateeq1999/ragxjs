
import { createClient, type Client } from "@libsql/client";
import type { IVectorStore, DocumentChunk } from "@ragx/core";

export interface LibSQLConfig {
    url: string;
    authToken?: string;
    table?: string;
}

export class LibSQLStore implements IVectorStore {
    private client: Client;
    private table: string;

    constructor(config: LibSQLConfig) {
        this.client = createClient({
            url: config.url,
            authToken: config.authToken || "",
        });
        this.table = config.table || "ragx_embeddings";
    }

    /**
     * Initialize the table if it doesn't exist
     */
    async initialize(): Promise<void> {
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS ${this.table} (
                id TEXT PRIMARY KEY,
                content TEXT,
                document_id TEXT,
                position INTEGER,
                token_count INTEGER,
                checksum TEXT,
                created_at TEXT,
                metadata TEXT,
                vector BLOB
            )
        `);
    }

    async add(vectors: number[][], chunks: DocumentChunk[]): Promise<void> {
        await this.initialize();

        const queries = chunks.map((chunk, i) => {
            return {
                sql: `INSERT OR REPLACE INTO ${this.table} 
                    (id, content, document_id, position, token_count, checksum, created_at, metadata, vector)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    chunk.id,
                    chunk.content,
                    chunk.documentId,
                    chunk.position,
                    chunk.tokenCount,
                    chunk.checksum,
                    chunk.createdAt.toISOString(),
                    JSON.stringify(chunk.metadata),
                    Buffer.from(new Float32Array(vectors[i] || []).buffer),
                ],
            };
        });

        // Batch execution
        await this.client.batch(queries, "write");
    }

    async search(
        vector: number[],
        topK: number,
        filter?: Record<string, unknown>,
        _query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
        await this.initialize();

        // Note: LibSQL/SQLite doesn't have native vector search unless using extensions like 'vector'
        // For standard LibSQL client, we might need to do manual calculation if not using Turso's vector 
        // But for "testing" and general use, we can implement a basic cosine similarity in SQL if possible
        // Or fetch all and filter (not recommended for production but okay for testing/small datasets)

        // However, Turso/LibSQL is adding native vector support. 
        // For now, let's implement a robust "fetch and rank" for testing purposes
        // User explicitly said "use it for testing".

        let sql = `SELECT * FROM ${this.table}`;
        const args: any[] = [];

        if (filter && Object.keys(filter).length > 0) {
            // Very basic filtering implementation
            const conditions = Object.entries(filter).map(([key, value]) => {
                args.push(value);
                return `json_extract(metadata, '$.${key}') = ?`;
            });
            sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        const result = await this.client.execute({ sql, args });

        const targetVector = new Float32Array(vector);
        const matches = result.rows.map((row) => {
            const vectorBlob = row.vector as ArrayBuffer;
            if (!vectorBlob) return null;

            const rowVector = new Float32Array(vectorBlob);
            const score = this.cosineSimilarity(targetVector, rowVector);

            return {
                score,
                chunk: {
                    id: String(row.id),
                    content: String(row.content),
                    documentId: String(row.document_id),
                    position: Number(row.position),
                    tokenCount: Number(row.token_count),
                    checksum: String(row.checksum),
                    createdAt: new Date(String(row.created_at)),
                    metadata: JSON.parse(String(row.metadata)),
                },
            };
        }).filter((m): m is { score: number; chunk: DocumentChunk } => m !== null);

        return matches
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    async delete(documentIds: string[]): Promise<void> {
        if (documentIds.length === 0) return;

        const placeholders = documentIds.map(() => "?").join(",");
        await this.client.execute({
            sql: `DELETE FROM ${this.table} WHERE document_id IN (${placeholders})`,
            args: documentIds,
        });
    }

    async getInfo(): Promise<{ count: number; dimensions: number }> {
        const countRes = await this.client.execute(`SELECT COUNT(*) as count FROM ${this.table}`);
        const count = Number(countRes.rows[0].count);

        // Get dimensions from first row if exists
        let dimensions = 0;
        if (count > 0) {
            const firstRow = await this.client.execute(`SELECT vector FROM ${this.table} LIMIT 1`);
            const vectorBlob = firstRow.rows[0]?.vector as ArrayBuffer;
            if (vectorBlob) {
                dimensions = vectorBlob.byteLength / 4; // Float32 is 4 bytes
            }
        }

        return { count, dimensions };
    }

    private cosineSimilarity(v1: Float32Array, v2: Float32Array): number {
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;
        for (let i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            mag1 += v1[i] * v1[i];
            mag2 += v2[i] * v2[i];
        }
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }
}
