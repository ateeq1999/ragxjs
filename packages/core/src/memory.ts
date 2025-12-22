
import type { ChatMessage, IMemoryManager } from "./interfaces";

export interface MemoryManagerConfig {
    maxMessages?: number;
}

/**
 * In-memory implementation of conversation history management
 */
export class MemoryManager implements IMemoryManager {
    private memories: Map<string, ChatMessage[]> = new Map();
    private readonly maxMessages: number;

    constructor(config?: MemoryManagerConfig) {
        this.maxMessages = config?.maxMessages || 10;
    }

    /**
     * Add a message to the conversation history
     */
    async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
        let history = this.memories.get(sessionId) || [];
        history.push(message);

        // Enforce limit (keep last N messages)
        if (history.length > this.maxMessages) {
            history = history.slice(history.length - this.maxMessages);
        }

        this.memories.set(sessionId, history);
    }

    /**
     * Get conversation history
     */
    async getHistory(sessionId: string): Promise<ChatMessage[]> {
        return this.memories.get(sessionId) || [];
    }

    /**
     * Clear conversation history
     */
    async clearHistory(sessionId: string): Promise<void> {
        this.memories.delete(sessionId);
    }
}
