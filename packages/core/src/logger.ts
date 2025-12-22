import { RequestContext } from "./request-context";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    traceId?: string | undefined;
    agentName?: string | undefined;
    duration?: number | undefined;
    data?: Record<string, unknown> | undefined;
}

/**
 * Structured logger utility
 */
export class Logger {
    private static isProduction = process.env.NODE_ENV === "production";

    /**
     * Log a message
     */
    private static log(level: LogLevel, message: string, data?: Record<string, unknown>) {
        const context = RequestContext.get();
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            traceId: context?.traceId,
            agentName: context?.agentName,
            duration: context ? RequestContext.getDuration() : undefined,
            data,
        };

        if (this.isProduction) {
            console.log(JSON.stringify(entry));
        } else {
            this.prettyPrint(entry);
        }
    }

    private static prettyPrint(entry: LogEntry) {
        const colors = {
            DEBUG: "\x1b[36m", // Cyan
            INFO: "\x1b[32m",  // Green
            WARN: "\x1b[33m",  // Yellow
            ERROR: "\x1b[31m", // Red
            RESET: "\x1b[0m",
        };

        const trace = entry.traceId ? ` [${entry.traceId.slice(0, 8)}]` : "";
        const agent = entry.agentName ? ` (@${entry.agentName})` : "";
        const duration = entry.duration !== undefined ? ` (+${entry.duration}ms)` : "";
        const color = colors[entry.level] || colors.RESET;

        console.log(
            `${color}${entry.level}${colors.RESET} ${entry.timestamp}${trace}${agent}: ${entry.message}${duration}`
        );
        if (entry.data && Object.keys(entry.data).length > 0) {
            console.dir(entry.data, { depth: null, colors: true });
        }
    }

    static debug(message: string, data?: Record<string, unknown>) {
        this.log("DEBUG", message, data);
    }

    static info(message: string, data?: Record<string, unknown>) {
        this.log("INFO", message, data);
    }

    static warn(message: string, data?: Record<string, unknown>) {
        this.log("WARN", message, data);
    }

    static error(message: string, data?: Record<string, unknown>) {
        this.log("ERROR", message, data);
    }
}
