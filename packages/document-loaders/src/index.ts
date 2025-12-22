import { DirectoryLoader } from "./loaders/directory";
import { URLLoader } from "./loaders/url";
export * from "./loaders/base";
export * from "./loaders/text";
export * from "./loaders/pdf";
export * from "./loaders/docx";
export * from "./loaders/directory";
export * from "./loaders/url";


/**
 * Helper to create a loader for a given path or URL
 */
export function createLoader(targetPath: string) {
    // If it's a URL, return URLLoader
    if (targetPath.startsWith("http://") || targetPath.startsWith("https://")) {
        return new URLLoader(targetPath);
    }

    // If it's a directory or local file, return DirectoryLoader
    return new DirectoryLoader(targetPath);
}
