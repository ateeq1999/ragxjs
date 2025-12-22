import { Elysia, type Context } from "elysia";
import type { AgentRegistry } from "../registry";

/**
 * Search request query parameters
 */
interface SearchQuery {
    query: string;
    topK?: string;
    scoreThreshold?: string;
}

/**
 * Create search routes for agents
 */
export function createSearchRoutes(registry: AgentRegistry) {
    return new Elysia({ prefix: "/api/agents" })
        .get("/:agentName/search", async ({ params, query, set }: Context) => {
            const { agentName } = params as { agentName: string };
            const searchQuery = query as unknown as SearchQuery;

            // Get agent from registry
            const agent = registry.get(agentName);
            if (!agent) {
                set.status = 404;
                return {
                    error: "Agent not found",
                    message: `Agent "${agentName}" does not exist`,
                };
            }

            // Validate query
            if (!searchQuery.query || typeof searchQuery.query !== "string") {
                set.status = 400;
                return {
                    error: "Invalid request",
                    message: "Query parameter is required",
                };
            }

            try {
                const topK = searchQuery.topK ? Number.parseInt(searchQuery.topK, 10) : 5;
                const scoreThreshold = searchQuery.scoreThreshold
                    ? Number.parseFloat(searchQuery.scoreThreshold)
                    : 0.7;
                console.log(`Searching with threshold: ${scoreThreshold}`);

                // Use the query method but only return sources
                const response = await agent.query(searchQuery.query, { topK });

                return {
                    query: searchQuery.query,
                    sources: response.sources,
                    count: response.sources.length,
                };
            } catch (error) {
                set.status = 500;
                return {
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
}
