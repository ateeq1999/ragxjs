import type { Document } from "@ragx/core";
import mammoth from "mammoth";
import { BaseLoader } from "./base";

/**
 * Loader for DOCX files
 */
export class DocxLoader extends BaseLoader {
    async load(): Promise<Document[]> {
        const result = await mammoth.extractRawText({ path: this.filePath });
        return [this.createDocument(result.value)];
    }
}
