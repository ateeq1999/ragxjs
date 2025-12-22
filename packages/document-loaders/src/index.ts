import { DirectoryLoader } from "./loaders/directory";
export * from "./loaders/base";
export * from "./loaders/text";
export * from "./loaders/pdf";
export * from "./loaders/docx";
export * from "./loaders/directory";


/**
 * Helper to create a loader for a given path
 */
export function createLoader(targetPath: string) {
    // If it's a directory, return DirectoryLoader
    // If it's a file, return appropriate loader
    return new DirectoryLoader(targetPath); // DirectoryLoader handles single files too if they have the right extension
}
