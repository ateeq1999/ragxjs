
import { LibSQLStore } from "./adapters/libsql";
import type { DocumentChunk } from "@ragx/core";

async function verifyLibSQL() {
    console.log("🚀 Verifying LibSQLStore...");

    const store = new LibSQLStore({
        url: "file:test-ragx.db",
    });

    try {
        // 1. Add some data
        const vector1 = [0.1, 0.2, 0.3];
        const vector2 = [0.4, 0.5, 0.6];
        const chunk1: DocumentChunk = {
            id: "c1",
            content: "Hello from LibSQL",
            documentId: "doc1",
            position: 1,
            tokenCount: 4,
            checksum: "abc",
            createdAt: new Date(),
            metadata: { source: "test" },
        };
        const chunk2: DocumentChunk = {
            id: "c2",
            content: "RAGX is awesome",
            documentId: "doc2",
            position: 1,
            tokenCount: 3,
            checksum: "def",
            createdAt: new Date(),
            metadata: { source: "test", urgency: "high" },
        };

        console.log("📝 Adding chunks...");
        await store.add([vector1, vector2], [chunk1, chunk2]);

        // 2. Search
        console.log("🔍 Searching for similar vector...");
        const searchResults = await store.search([0.15, 0.25, 0.35], 2);
        console.log("Search Results:", JSON.stringify(searchResults, null, 2));

        if (searchResults.length > 0 && searchResults[0].chunk.id === "c1") {
            console.log("✅ Basic search works");
        } else {
            console.log("❌ Search failed to rank correctly");
        }

        // 3. Search with filter
        console.log("🔍 Searching with filter { urgency: 'high' }...");
        const filteredResults = await store.search([0.1, 0.2, 0.3], 1, { urgency: "high" });
        console.log("Filtered Results:", JSON.stringify(filteredResults, null, 2));

        if (filteredResults.length > 0 && filteredResults[0].chunk.id === "c2") {
            console.log("✅ Filtering works");
        } else {
            console.log("❌ Filtering failed");
        }

        // 4. Get info
        const info = await store.getInfo();
        console.log("📊 Store Info:", info);
        if (info.count === 2 && info.dimensions === 3) {
            console.log("✅ getInfo works");
        } else {
            console.log("❌ getInfo failed");
        }

        // 5. Delete
        console.log("🗑️ Deleting doc1...");
        await store.delete(["doc1"]);
        const infoAfterDelete = await store.getInfo();
        if (infoAfterDelete.count === 1) {
            console.log("✅ Delete works");
        } else {
            console.log("❌ Delete failed");
        }

    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        // Cleanup: In a real test we'd delete the file, for now we just finish
        console.log("🎉 Verification finished");
    }
}

verifyLibSQL();
