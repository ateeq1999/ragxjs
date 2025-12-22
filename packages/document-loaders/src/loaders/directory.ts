import type { Document, IDocumentLoader } from "@ragx/core";
import fs from "node:fs/promises";
import path from "node:path";
import { TextLoader } from "./text";
import { PdfLoader } from "./pdf";
import { DocxLoader } from "./docx";

/**
 * Loader for directories, automatically choosing the right loader for each file
 */
export class DirectoryLoader implements IDocumentLoader {
    constructor(private readonly directoryPath: string, private readonly recursive = true) { }

    async load(): Promise<Document[]> {
        const documents: Document[] = [];
        await this.processDirectory(this.directoryPath, documents);
        return documents;
    }

    private async processDirectory(dir: string, docs: Document[]): Promise<void> {
        const files = await fs.readdir(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stats = await fs.stat(fullPath);

            if (stats.isDirectory() && this.recursive) {
                await this.processDirectory(fullPath, docs);
            } else if (stats.isFile()) {
                const ext = path.extname(file).toLowerCase();
                let loader: IDocumentLoader | null = null;

                switch (ext) {
                    case ".txt":
                    case ".md":
                        loader = new TextLoader(fullPath);
                        break;
                    case ".pdf":
                        loader = new PdfLoader(fullPath);
                        break;
                    case ".docx":
                        loader = new DocxLoader(fullPath);
                        break;
                }

                if (loader) {
                    try {
                        const loadedDocs = await loader.load();
                        docs.push(...loadedDocs);
                    } catch (error) {
                        console.error(`Failed to load document ${fullPath}:`, error);
                    }
                }
            }
        }
    }
}
