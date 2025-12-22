import type { ITool, IToolRegistry } from "./interfaces";

/**
 * Standard implementation of tool registry
 */
export class ToolRegistry implements IToolRegistry {
    private readonly tools = new Map<string, ITool>();

    register(tool: ITool): void {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): ITool | undefined {
        return this.tools.get(name);
    }

    getAllTools(): ITool[] {
        return Array.from(this.tools.values());
    }

    async executeTool(name: string, args: any): Promise<any> {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        try {
            return await tool.execute(args);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return `Error executing tool ${name}: ${message}`;
        }
    }
}
