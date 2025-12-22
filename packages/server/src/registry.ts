import type { RAGEngine } from "@ragx/core";

/**
 * Agent registry to store RAG engines by agent name
 */
export class AgentRegistry {
    private agents: Map<string, RAGEngine> = new Map();

    /**
     * Register a RAG engine for an agent
     */
    register(name: string, engine: RAGEngine): void {
        this.agents.set(name, engine);
    }

    /**
     * Get a RAG engine by agent name
     */
    get(name: string): RAGEngine | undefined {
        return this.agents.get(name);
    }

    /**
     * Check if an agent exists
     */
    has(name: string): boolean {
        return this.agents.has(name);
    }

    /**
     * Get all agent names
     */
    getAgentNames(): string[] {
        return Array.from(this.agents.keys());
    }

    /**
     * Remove an agent
     */
    remove(name: string): boolean {
        return this.agents.delete(name);
    }

    /**
     * Clear all agents
     */
    clear(): void {
        this.agents.clear();
    }
}
