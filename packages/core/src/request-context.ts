import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Request context data structure
 */
export interface RequestContextData {
    traceId: string;
    agentName?: string | undefined;
    startTime: number;
}

/**
 * Helper for managing request-scoped context (like trace IDs)
 */
const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
    /**
     * Run a function within a new request context
     */
    run<T>(data: Partial<RequestContextData>, fn: () => T | Promise<T>): Promise<T> {
        const context: RequestContextData = {
            traceId: data.traceId || randomUUID(),
            agentName: data.agentName,
            startTime: data.startTime || Date.now(),
        };
        return storage.run(context, async () => await fn());
    },

    /**
     * Get the current request context
     */
    get(): RequestContextData | undefined {
        return storage.getStore();
    },

    /**
     * Get the current trace ID
     */
    getTraceId(): string | undefined {
        return storage.getStore()?.traceId;
    },

    /**
     * Get duration since request started
     */
    getDuration(): number {
        const store = storage.getStore();
        if (!store) return 0;
        return Date.now() - store.startTime;
    },
};
