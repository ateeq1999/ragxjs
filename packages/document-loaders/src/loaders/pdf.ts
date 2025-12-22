import type { Document } from "@ragx/core";
import fs from "node:fs/promises";
import pdf from "pdf-parse";
import { BaseLoader } from "./base";

/**
 * Loader for PDF files
 */
export class PdfLoader extends BaseLoader {
    async load(): Promise<Document[]> {
        const dataBuffer = await fs.readFile(this.filePath);
        const data = await pdf(dataBuffer);

        return [
            this.createDocument(data.text, {
                totalPages: data.numpages,
                info: data.info,
                metadata: data.metadata,
                version: data.version,
            }),
        ];
    }
}
