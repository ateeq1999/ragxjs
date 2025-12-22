import { watch } from "node:fs/promises";
import type { RagxConfig } from "./schema";
import { validateConfig } from "./validator";

/**
 * Configuration loader options
 */
export interface LoaderOptions {
    /** Path to configuration file */
    configPath?: string;
    /** Whether to watch for config changes */
    watch?: boolean;
    /** Callback for config changes */
    onChange?: (config: RagxConfig) => void;
}

/**
 * Interpolates environment variables in a string
 * Supports ${VAR_NAME} and $VAR_NAME syntax
 */
function interpolateEnvVars(value: unknown): unknown {
    if (typeof value === "string") {
        return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (_, bracedVar, unbracedVar) => {
            const varName = bracedVar || unbracedVar;
            const envValue = process.env[varName];
            if (envValue === undefined) {
                throw new Error(`Environment variable ${varName} is not defined`);
            }
            return envValue;
        });
    }

    if (Array.isArray(value)) {
        return value.map(interpolateEnvVars);
    }

    if (value !== null && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = interpolateEnvVars(val);
        }
        return result;
    }

    return value;
}

/**
 * Loads and validates RAGX configuration from a file
 */
export async function loadConfig(options: LoaderOptions = {}): Promise<RagxConfig> {
    const configPath = options.configPath || "./agent.config.ts";

    try {
        // Import the configuration file
        const configModule = await import(configPath);
        const rawConfig = configModule.default || configModule;

        // Interpolate environment variables
        const interpolatedConfig = interpolateEnvVars(rawConfig);

        // Validate configuration
        const validatedConfig = validateConfig(interpolatedConfig);

        // Setup file watcher if requested
        if (options.watch && options.onChange) {
            const watcher = watch(configPath);
            (async () => {
                for await (const event of watcher) {
                    if (event.eventType === "change") {
                        try {
                            const reloadedConfig = await loadConfig({ ...options, watch: false });
                            options.onChange?.(reloadedConfig);
                        } catch (error) {
                            console.error("Failed to reload configuration:", error);
                        }
                    }
                }
            })();
        }

        return validatedConfig;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Loads configuration from an object (useful for testing)
 */
export function loadConfigFromObject(config: unknown): RagxConfig {
    const interpolatedConfig = interpolateEnvVars(config);
    return validateConfig(interpolatedConfig);
}
