import type { RagxConfig } from "./schema.ts";
import { RagxConfigSchema } from "./schema.ts";

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
    constructor(
        message: string,
        public readonly errors: Array<{ path: string; message: string }>,
    ) {
        super(message);
        this.name = "ConfigValidationError";
    }
}

/**
 * Validates a RAGX configuration object
 * @throws {ConfigValidationError} If validation fails
 */
export function validateConfig(config: unknown): RagxConfig {
    const result = RagxConfigSchema.safeParse(config);

    if (!result.success) {
        const errors = result.error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
        }));

        throw new ConfigValidationError(
            `Configuration validation failed:\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n")}`,
            errors,
        );
    }

    // Additional validation: check for duplicate agent names
    const agentNames = new Set<string>();
    for (const agent of result.data.agents) {
        if (agentNames.has(agent.name)) {
            throw new ConfigValidationError(`Duplicate agent name: ${agent.name}`, [
                { path: "agents", message: `Agent name "${agent.name}" is duplicated` },
            ]);
        }
        agentNames.add(agent.name);
    }

    // Validate temperature constraints for retrieval operations
    for (const agent of result.data.agents) {
        // For retrieval/query expansion, temperature should be 0 (RAGX rule)
        if (agent.retrieval?.multiQuery && agent.model.temperature !== 0) {
            console.warn(
                `Warning: Agent "${agent.name}" uses multi-query retrieval but temperature is not 0. ` +
                `RAGX recommends temperature=0 for deterministic retrieval.`,
            );
        }

        // Validate that temperature and topP are not both set (RAGX rule)
        if (agent.model.temperature !== undefined && agent.model.topP !== undefined) {
            throw new ConfigValidationError(
                `Agent "${agent.name}": Cannot set both temperature and topP`,
                [{ path: `agents.${agent.name}.model`, message: "Cannot set both temperature and topP" }],
            );
        }
    }

    return result.data;
}

/**
 * Validates agent name according to RAGX rules
 */
export function validateAgentName(name: string): boolean {
    const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]{2,49}$/;
    const FORBIDDEN_NAMES = ["health", "metrics", "admin", "docs", "system"];

    return AGENT_NAME_REGEX.test(name) && !FORBIDDEN_NAMES.includes(name);
}

/**
 * Checks if configuration has any disabled agents
 */
export function hasDisabledAgents(config: RagxConfig): boolean {
    return config.agents.some((agent) => agent.enabled === false);
}

/**
 * Gets all enabled agents from configuration
 */
export function getEnabledAgents(config: RagxConfig): RagxConfig["agents"] {
    return config.agents.filter((agent) => agent.enabled !== false);
}
