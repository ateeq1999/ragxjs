import type { IEmbeddingProvider } from "@ragx/core";
export declare class CohereEmbeddings implements IEmbeddingProvider {
    private client;
    private model;
    private dimensions;
    constructor(config: {
        apiKey: string;
        model?: string;
    });
    embed(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
}
//# sourceMappingURL=cohere.d.ts.map