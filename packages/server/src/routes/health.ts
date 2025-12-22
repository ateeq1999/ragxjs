import { Elysia } from "elysia";
import type { AgentRegistry } from "../registry.ts";

/**
 * Health check response
 */
interface HealthResponse {
    status: "healthy" | "unhealthy";
    timestamp: string;
    agents: {
        total: number;
        names: string[];
    };
}

/**
 * Metrics response
 */
interface MetricsResponse {
    uptime: number;
    timestamp: string;
    agents: {
        total: number;
        names: string[];
    };
}

/**
 * Create health and metrics routes
 */
export function createHealthRoutes(registry: AgentRegistry, startTime: number) {
    return new Elysia({ prefix: "/api" })
        .get("/health", () => {
            const response: HealthResponse = {
                status: "healthy",
                timestamp: new Date().toISOString(),
                agents: {
                    total: registry.getAgentNames().length,
                    names: registry.getAgentNames(),
                },
            };
            return response;
        })
        .get("/metrics", () => {
            const uptime = Date.now() - startTime;
            const response: MetricsResponse = {
                uptime,
                timestamp: new Date().toISOString(),
                agents: {
                    total: registry.getAgentNames().length,
                    names: registry.getAgentNames(),
                },
            };
            return response;
        });
}
