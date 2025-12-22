import type { Document, IDocumentLoader } from "@ragx/core";
import { randomUUID } from "node:crypto";

/**
 * Loader for web pages via URL
 */
export class URLLoader implements IDocumentLoader {
    constructor(private readonly url: string) { }

    /**
     * Load documents from the URL
     */
    async load(): Promise<Document[]> {
        try {
            const response = await fetch(this.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${this.url} (${response.status})`);
            }

            const html = await response.text();
            const content = this.cleanHtml(html);
            const title = this.extractTitle(html);

            return [{
                id: randomUUID(),
                content,
                source: this.url,
                metadata: {
                    url: this.url,
                    title: title,
                    type: "web",
                    accessedAt: new Date().toISOString(),
                },
            }];
        } catch (error) {
            console.error(`Error loading URL ${this.url}:`, error);
            throw error;
        }
    }

    /**
     * Basic HTML to text conversion
     */
    private cleanHtml(html: string): string {
        // Remove scripts and styles
        let cleaned = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
        cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");

        // Remove HTML comments
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

        // Basic body extraction if exists
        const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/gim.exec(cleaned);
        if (bodyMatch?.[1]) {
            cleaned = bodyMatch[1];
        }

        // Replace common block tags with newlines
        cleaned = cleaned.replace(/<(p|div|h[1-6]|li|br|tr)\b[^>]*>/gim, "\n");

        // Strip remaining tags
        cleaned = cleaned.replace(/<[^>]*>/g, " ");

        // Decode basic HTML entities (standard ones only for now)
        cleaned = cleaned.replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"');

        // Cleanup whitespace
        return cleaned
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join("\n")
            .replace(/ +/g, " ");
    }

    /**
     * Extract page title
     */
    private extractTitle(html: string): string {
        const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/gim.exec(html);
        return (titleMatch?.[1] || this.url).trim();
    }
}
