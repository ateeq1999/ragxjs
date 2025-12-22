import type { Document } from "@ragx/core";
import fs from "node:fs/promises";
import { BaseLoader } from "./base";

/**
 * Loader for plain text and markdown files
 */
export class TextLoader extends BaseLoader {
    async load(): Promise<Document[]> {
        const content = await fs.readFile(this.filePath, "utf-8");
        return [this.createDocument(content)];
    }
}
