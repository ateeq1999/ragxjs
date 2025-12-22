import { z } from "zod";

/**
 * Agent name validation regex: lowercase alphanumeric + hyphens, 3-50 chars
 * Must start with letter
 */
const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]{2,49}$/;

/**
 * Forbidden agent names that conflict with system routes
 */
const FORBIDDEN_AGENT_NAMES = ["health", "metrics", "admin", "docs", "system"];

/**
 * Model configuration schema
 */
export const ModelConfigSchema = z.object({
    provider: z.enum(["openai", "anthropic", "google", "cohere", "mistral", "ollama"]),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).optional().default(0.7),
    maxTokens: z.number().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
});

/**
 * Embeddings configuration schema
 */
export const EmbeddingsConfigSchema = z.object({
    provider: z.enum(["openai", "cohere", "huggingface", "voyage", "mistral"]),
    model: z.string().min(1).optional(),
    dimensions: z.number().positive().optional(),
    batchSize: z.number().positive().optional().default(100),
});

/**
 * Vector store configuration schema
 */
export const VectorStoreConfigSchema = z.object({
    provider: z.enum(["pinecone", "weaviate", "qdrant", "chroma", "milvus", "pgvector", "memory", "libsql"]),
    url: z.string().url().optional(),
    apiKey: z.string().optional(),
    index: z.string().optional(),
    collection: z.string().optional(),
    namespace: z.string().optional(),
    distanceMetric: z.enum(["cosine", "innerProduct", "chebyshev", "manhattan", "euclidean"]).optional().default("cosine"),
});

/**
 * Retrieval configuration schema
 */
export const RetrievalConfigSchema = z.object({
    strategy: z.enum(["vector", "keyword", "hybrid"]).optional().default("vector"),
    topK: z.number().int().min(1).max(100).optional().default(5),
    scoreThreshold: z.number().min(0).max(1).optional().default(0.7),
    rerankModel: z.string().optional(),
    multiQuery: z.boolean().optional().default(false),
});

/**
 * Memory configuration schema
 */
export const MemoryConfigSchema = z.object({
    type: z.enum(["buffer", "summary", "none"]).optional().default("none"),
    maxMessages: z.number().int().positive().optional().default(10),
});

/**
 * Tool configuration schema
 */
export const ToolConfigSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    endpoint: z.string().url().optional(),
    schema: z.record(z.unknown()).optional(),
});

/**
 * Endpoint configuration schema
 */
export const EndpointsConfigSchema = z.object({
    chat: z.string().optional().default("/api/chat"),
    ingest: z.string().optional().default("/api/ingest"),
    search: z.string().optional().default("/api/search"),
});

/**
 * Query transformation configuration schema
 */
export const QueryTransformationConfigSchema = z.object({
    rewrite: z.boolean().optional().default(false),
    expand: z.boolean().optional().default(false),
    maxExpansions: z.number().int().min(1).max(10).optional().default(3),
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z
    .object({
        name: z
            .string()
            .regex(AGENT_NAME_REGEX, "Agent name must be lowercase alphanumeric with hyphens, 3-50 chars")
            .refine((name) => !FORBIDDEN_AGENT_NAMES.includes(name), {
                message: `Agent name cannot be one of: ${FORBIDDEN_AGENT_NAMES.join(", ")}`,
            }),
        enabled: z.boolean().optional().default(true),
        model: ModelConfigSchema,
        embeddings: EmbeddingsConfigSchema,
        vectorStore: VectorStoreConfigSchema,
        retrieval: RetrievalConfigSchema.optional(),
        memory: MemoryConfigSchema.optional(),
        tools: z.array(ToolConfigSchema).optional(),
        queryTransformation: QueryTransformationConfigSchema.optional(),
        endpoints: EndpointsConfigSchema.optional(),
    })
    .strict();

/**
 * CORS configuration schema
 */
export const CorsConfigSchema = z.object({
    origin: z.union([z.string(), z.array(z.string())]).optional().default("*"),
    credentials: z.boolean().optional().default(false),
});

/**
 * Rate limiting configuration schema
 */
export const RateLimitConfigSchema = z.object({
    max: z.number().int().positive().optional().default(100),
    window: z.string().optional().default("15m"),
});

/**
 * Authentication configuration schema
 */
export const AuthConfigSchema = z.object({
    type: z.enum(["none", "apikey", "jwt"]).optional().default("none"),
    secret: z.string().optional(),
    header: z.string().optional().default("Authorization"),
});

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
    port: z.number().int().min(1).max(65535).optional().default(3000),
    host: z.string().optional().default("0.0.0.0"),
    cors: CorsConfigSchema.optional(),
    rateLimit: RateLimitConfigSchema.optional(),
    auth: AuthConfigSchema.optional(),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
    level: z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
    format: z.enum(["json", "pretty"]).optional().default("json"),
});

/**
 * Metrics configuration schema
 */
export const MetricsConfigSchema = z.object({
    enabled: z.boolean().optional().default(false),
    port: z.number().int().min(1).max(65535).optional().default(9090),
});

/**
 * Tracing configuration schema
 */
export const TracingConfigSchema = z.object({
    enabled: z.boolean().optional().default(false),
    endpoint: z.string().url().optional(),
});

/**
 * Observability configuration schema
 */
export const ObservabilityConfigSchema = z.object({
    logging: LoggingConfigSchema.optional(),
    metrics: MetricsConfigSchema.optional(),
    tracing: TracingConfigSchema.optional(),
});

/**
 * Root configuration schema
 */
export const RagxConfigSchema = z
    .object({
        agents: z.array(AgentConfigSchema).min(1, "At least one agent must be configured"),
        server: ServerConfigSchema.optional(),
        observability: ObservabilityConfigSchema.optional(),
    })
    .strict();

/**
 * Type exports
 */
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfigSchema>;
export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;
export type RetrievalConfig = z.infer<typeof RetrievalConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type EndpointsConfig = z.infer<typeof EndpointsConfigSchema>;
export type QueryTransformationConfig = z.infer<typeof QueryTransformationConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type CorsConfig = z.infer<typeof CorsConfigSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;
export type TracingConfig = z.infer<typeof TracingConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
export type RagxConfig = z.infer<typeof RagxConfigSchema>;
