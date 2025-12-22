
import { createClient, type Client } from "@libsql/client";
import type { IVectorStore, DocumentChunk } from "@ragx/core";

export type LibSQLDistanceMetric = "cosine" | "innerProduct" | "chebyshev" | "manhattan" | "squaredEuclidean" | "euclidean";

export interface LibSQLConfig {
    url: string;
    authToken?: string;
    table?: string;
    distanceMetric?: LibSQLDistanceMetric;
}

export class LibSQLStore implements IVectorStore {
    private client: Client;
    private table: string;
    private distanceMetric: LibSQLDistanceMetric;

    constructor(config: LibSQLConfig) {
        this.client = createClient({
            url: config.url,
            authToken: config.authToken || "",
        });
        this.table = config.table || "ragx_embeddings";
        this.distanceMetric = config.distanceMetric || "cosine";
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
        vector: number[] | undefined,
        topK: number,
        filter?: Record<string, unknown>,
        query?: string,
    ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
        await this.initialize();

        let sql = `SELECT * FROM ${this.table}`;
        const args: any[] = [];

        if (filter && Object.keys(filter).length > 0) {
            const conditions = Object.entries(filter).map(([key, value]) => {
                args.push(value);
                return `json_extract(metadata, '$.${key}') = ?`;
            });
            sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        const result = await this.client.execute({ sql, args });

        const vectorResults: Array<{ chunk: DocumentChunk; score: number }> = [];
        const keywordResults: Array<{ chunk: DocumentChunk; score: number }> = [];

        const targetVector = vector ? new Float32Array(vector) : null;
        const queryWords = query ? query.toLowerCase().split(/\s+/) : [];

        for (const row of result.rows) {
            const chunk: DocumentChunk = {
                id: String(row.id),
                content: String(row.content),
                documentId: String(row.document_id),
                position: Number(row.position),
                tokenCount: Number(row.token_count),
                checksum: String(row.checksum),
                createdAt: new Date(String(row.created_at)),
                metadata: JSON.parse(String(row.metadata)),
            };

            // Vector Score
            if (targetVector) {
                const vectorBlob = row.vector as ArrayBuffer;
                if (vectorBlob) {
                    const rowVector = new Float32Array(vectorBlob);
                    const score = this.calculateSimilarity(targetVector, rowVector);
                    vectorResults.push({ chunk, score });
                }
            }

            // Keyword Score
            if (query) {
                const content = chunk.content.toLowerCase();
                let matches = 0;
                for (const word of queryWords) {
                    if (content.includes(word)) matches++;
                }
                const score = matches / queryWords.length;
                if (score > 0) {
                    keywordResults.push({ chunk, score });
                }
            }
        }

        // Sort by scores
        vectorResults.sort((a, b) => b.score - a.score);
        keywordResults.sort((a, b) => b.score - a.score);

        // Combine
        if (vector && query) {
            return this.reciprocalRankFusion(vectorResults, keywordResults).slice(0, topK);
        } else if (vector) {
            return vectorResults.slice(0, topK);
        } else if (query) {
            return keywordResults.slice(0, topK);
        }

        return [];
    }

    /**
     * Reciprocal Rank Fusion (RRF)
     */
    private reciprocalRankFusion(
        vectorResults: Array<{ chunk: DocumentChunk; score: number }>,
        keywordResults: Array<{ chunk: DocumentChunk; score: number }>,
        k = 60,
    ): Array<{ chunk: DocumentChunk; score: number }> {
        const scores = new Map<string, { chunk: DocumentChunk; score: number }>();

        // Rank by vector score
        vectorResults.forEach((res, index) => {
            const rank = index + 1;
            const rrfScore = 1 / (k + rank);
            scores.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
        });

        // Rank by keyword score and combine
        keywordResults.forEach((res, index) => {
            const rank = index + 1;
            const rrfScore = 1 / (k + rank);
            const existing = scores.get(res.chunk.id);
            if (existing) {
                existing.score += rrfScore;
            } else {
                scores.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
            }
        });

        return Array.from(scores.values())
            .sort((a, b) => b.score - a.score);
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
        const count = Number(countRes.rows[0]?.["count"] || 0);

        // Get dimensions from first row if exists
        let dimensions = 0;
        if (count > 0) {
            const firstRow = await this.client.execute(`SELECT vector FROM ${this.table} LIMIT 1`);
            const vectorBlob = firstRow.rows[0]?.["vector"] as ArrayBuffer;
            if (vectorBlob) {
                dimensions = vectorBlob.byteLength / 4; // Float32 is 4 bytes
            }
        }

        return { count, dimensions };
    }

    private calculateSimilarity(a: Float32Array, b: Float32Array): number {
        switch (this.distanceMetric) {
            case "innerProduct":
                return this.innerProduct(a, b);
            case "chebyshev":
                return 1 / (1 + this.chebyshev(a, b)); // Convert distance to similarity
            case "manhattan":
                return 1 / (1 + this.manhattan(a, b));
            case "squaredEuclidean":
                return 1 / (1 + this.squaredEuclidean(a, b));
            case "euclidean":
                return 1 / (1 + this.euclidean(a, b));
            case "cosine":
            default:
                return this.cosineSimilarity(a, b);
        }
    }

    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let p = 0;
        let p2 = 0;
        let q2 = 0;
        for (let i = 0; i < a.length; i++) {
            const ai = a[i] ?? 0;
            const bi = b[i] ?? 0;
            p += ai * bi;
            p2 += ai * ai;
            q2 += bi * bi;
        }
        if (p2 === 0 || q2 === 0) return 0;
        return p / (Math.sqrt(p2) * Math.sqrt(q2));
    }

    private innerProduct(a: Float32Array, b: Float32Array): number {
        let ans = 0;
        for (let i = 0; i < a.length; i++) {
            ans += (a[i] ?? 0) * (b[i] ?? 0);
        }
        return ans;
    }

    private chebyshev(a: Float32Array, b: Float32Array): number {
        let max = 0;
        for (let i = 0; i < a.length; i++) {
            const aux = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
            if (max < aux) {
                max = aux;
            }
        }
        return max;
    }

    private manhattan(a: Float32Array, b: Float32Array): number {
        let d = 0;
        for (let i = 0; i < a.length; i++) {
            d += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
        }
        return d;
    }

    private squaredEuclidean(p: Float32Array, q: Float32Array): number {
        let d = 0;
        for (let i = 0; i < p.length; i++) {
            const diff = (p[i] ?? 0) - (q[i] ?? 0);
            d += diff * diff;
        }
        return d;
    }

    private euclidean(p: Float32Array, q: Float32Array): number {
        return Math.sqrt(this.squaredEuclidean(p, q));
    }
}
