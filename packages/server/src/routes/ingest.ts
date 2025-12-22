import { Elysia, type Context } from "elysia";
import type { Document } from "@ragx/core";
import type { AgentRegistry } from "../registry";

/**
 * Ingest request body
 */
interface IngestRequest {
    documents: Array<{
        id: string;
        content: string;
        source: string;
        metadata?: Record<string, unknown>;
    }>;
}

/**
 * Ingest response
 */
interface IngestResponse {
    processed: number;
    chunks: number;
}

/**
 * Create ingest routes for agents
 */
export function createIngestRoutes(registry: AgentRegistry) {
    return new Elysia({ prefix: "/api/agents" })
        .post("/:agentName/ingest", async ({ params, body, set }: Context) => {
            const { agentName } = params as { agentName: string };
            const request = body as IngestRequest;

            // Get agent from registry
            const agent = registry.get(agentName);
            if (!agent) {
                set.status = 404;
                return {
                    error: "Agent not found",
                    message: `Agent "${agentName}" does not exist`,
                };
            }

            // Validate request
            if (!request.documents || !Array.isArray(request.documents)) {
                set.status = 400;
                return {
                    error: "Invalid request",
                    message: "Documents array is required",
                };
            }

            if (request.documents.length === 0) {
                set.status = 400;
                return {
                    error: "Invalid request",
                    message: "At least one document is required",
                };
            }

            // Validate each document
            for (const doc of request.documents) {
                if (!doc.id || !doc.content || !doc.source) {
                    set.status = 400;
                    return {
                        error: "Invalid request",
                        message: "Each document must have id, content, and source",
                    };
                }
            }

            try {
                // Ingest documents
                const result = await agent.ingest(request.documents as Document[]);

                return result as IngestResponse;
            } catch (error) {
                set.status = 500;
                return {
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
}
