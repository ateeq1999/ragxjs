import { Elysia, type Context } from "elysia";
import type { AgentRegistry } from "../registry";

/**
 * Chat request body
 */
interface ChatRequest {
    message: string;
    topK?: number;
    temperature?: number;
    stream?: boolean;
}

/**
 * Chat response
 */
interface ChatResponse {
    answer: string;
    sources: Array<{
        content: string;
        source: string;
        score: number;
    }>;
    contextSufficient: boolean;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Create chat routes for agents
 */
export function createChatRoutes(registry: AgentRegistry) {
    return new Elysia({ prefix: "/api/agents" })
        .post("/:agentName/chat", async ({ params, body, set }: Context) => {
            const { agentName } = params as { agentName: string };
            const request = body as ChatRequest;

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
            if (!request.message || typeof request.message !== "string") {
                set.status = 400;
                return {
                    error: "Invalid request",
                    message: "Message is required and must be a string",
                };
            }

            try {
                // Handle streaming
                if (request.stream) {
                    set.headers["Content-Type"] = "text/event-stream";
                    set.headers["Cache-Control"] = "no-cache";
                    set.headers["Connection"] = "keep-alive";

                    // Create async generator for streaming
                    const stream = async function* () {
                        const generator = agent.queryStream(request.message, {
                            ...(request.topK ? { topK: request.topK } : {}),
                            ...(request.temperature ? { temperature: request.temperature } : {}),
                        });

                        for await (const chunk of generator) {
                            yield `data: ${JSON.stringify({ chunk })}\n\n`;
                        }

                        // Send final response
                        const result = await generator.return({ content: "", model: "" } as any);
                        if (result.value) {
                            yield `data: ${JSON.stringify({ done: true, response: result.value })}\n\n`;
                        }
                    };

                    return stream();
                }

                // Non-streaming response
                const response = await agent.query(request.message, {
                    ...(request.topK ? { topK: request.topK } : {}),
                    ...(request.temperature ? { temperature: request.temperature } : {}),
                });

                return response as ChatResponse;
            } catch (error) {
                set.status = 500;
                return {
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
}
