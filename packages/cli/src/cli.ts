#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "node:fs/promises";
import { loadConfig } from "@ragx/config";
import { startServer } from "@ragx/server";
import { RAGEngine } from "@ragx/core";
import { createEmbeddingProvider } from "@ragx/embeddings";
import { createLLMProvider, createReranker } from "@ragx/llm";
import { createVectorStore } from "@ragx/vectordb";
import { DirectoryLoader } from "@ragx/document-loaders";

const program = new Command();

program
    .name("ragx")
    .description("RAGx Framework CLI")
    .version("0.1.0");

/**
 * Command: init
 * Scaffolds a new RAGx project
 */
program
    .command("init")
    .description("Initialize a new RAGx project")
    .argument("[path]", "Path to initialize the project", ".")
    .action(async (dir) => {
        const spinner = ora("Initializing RAGx project...").start();
        try {
            const targetDir = path.resolve(process.cwd(), dir);
            await fs.mkdir(targetDir, { recursive: true });

            // Create initial config
            const configTemplate = `
import type { RagxConfig } from "@ragx/config";

const config: RagxConfig = {
  agents: [
    {
      name: "example-agent",
      enabled: true,
      model: {
        provider: "openai",
        model: "gpt-4-turbo",
        temperature: 0.7
      },
      embeddings: {
        provider: "openai",
        model: "text-embedding-3-small"
      },
      vectorStore: {
        provider: "memory"
      },
      retrieval: {
        topK: 5,
        scoreThreshold: 0.7
      }
    }
  ],
  server: {
    port: 3000,
    cors: { origin: "*" }
  }
};

export default config;
`;
            await fs.writeFile(path.join(targetDir, "agent.config.ts"), configTemplate.trim());

            // Create documents folder
            await fs.mkdir(path.join(targetDir, "documents"), { recursive: true });

            spinner.succeed(chalk.green(`RAGx project initialized in ${chalk.bold(targetDir)}`));
            console.log("\nNext steps:");
            console.log(`  cd ${dir === "." ? "" : dir}`);
            console.log("  ragx dev\n");
        } catch (error) {
            spinner.fail(chalk.red("Failed to initialize project"));
            console.error(error);
        }
    });

/**
 * Command: dev
 * Starts the development server with hot-reload
 */
program
    .command("dev")
    .description("Start development server")
    .option("-c, --config <path>", "Path to config file", "./agent.config.ts")
    .action(async (options) => {
        console.log(chalk.cyan("\n🚀 Starting RAGx Development Server..."));

        try {
            const configPath = path.resolve(process.cwd(), options.config);

            // Start server with watch mode enabled through the config loader
            const config = await loadConfig({
                configPath,
                watch: true,
                onChange: async (_newConfig: any) => {
                    console.log(chalk.yellow("\n🔄 Configuration changed, reloading server..."));
                    // In a real implementation, we'd need to restart the Elysia app
                    // For now, this requires the server to be hot-swappable
                    // Elysia with Bun --watch handles most of this, but we'll print a message
                    process.exit(0); // Simple way to let Bun --watch restart
                }
            }) as any;

            // For now, startServer is fine as Bun --watch is expected to be used
            await startServer({
                config,
                apiKeys: {
                    openai: process.env.OPENAI_API_KEY || "",
                    anthropic: process.env.ANTHROPIC_API_KEY || "",
                    google: process.env.GOOGLE_API_KEY || "",
                    mistral: process.env.MISTRAL_API_KEY || "",
                    cohere: process.env.COHERE_API_KEY || ""
                }
            });
        } catch (error) {
            console.error(chalk.red("Fatal error starting server:"), error);
            process.exit(1);
        }
    });

/**
 * Command: ingest
 * Ingests documents into an agent
 */
program
    .command("ingest")
    .description("Ingest documents into an agent")
    .argument("<path>", "Path to files or directory")
    .option("-a, --agent <name>", "Name of the agent to ingest into")
    .option("-c, --config <path>", "Path to config file", "./agent.config.ts")
    .action(async (targetPath, options) => {
        const spinner = ora("Initializing RAGx engine...").start();
        try {
            const configPath = path.resolve(process.cwd(), options.config);
            const config = await loadConfig({ configPath }) as any;

            // Find the target agent
            const agentName = options.agent || config.agents[0]?.name;
            const agentConfig = config.agents.find((a: any) => a.name === agentName);

            if (!agentConfig) {
                spinner.fail(chalk.red(`Agent "${agentName}" not found in configuration.`));
                process.exit(1);
            }

            spinner.text = `Initializing RAG engine for "${agentName}"...`;

            // Prepare API keys
            const apiKeys: Record<string, string> = {
                openai: process.env.OPENAI_API_KEY || "",
                anthropic: process.env.ANTHROPIC_API_KEY || "",
                google: process.env.GOOGLE_API_KEY || "",
                mistral: process.env.MISTRAL_API_KEY || "",
                cohere: process.env.COHERE_API_KEY || "",
            };

            const llmApiKey = apiKeys[agentConfig.model.provider];
            const embeddingApiKey = apiKeys[agentConfig.embeddings.provider];

            if (!llmApiKey || !embeddingApiKey) {
                spinner.fail(chalk.red(`Missing API keys for agent "${agentName}". Ensure environment variables are set.`));
                process.exit(1);
            }

            // Create providers
            const llm = createLLMProvider(agentConfig.model, llmApiKey);
            const embeddings = createEmbeddingProvider(agentConfig.embeddings, embeddingApiKey);
            const vectorStore = createVectorStore(agentConfig.vectorStore);

            // Optional Reranker
            let reranker: any;
            if (agentConfig.retrieval?.rerankModel) {
                const cohereApiKey = apiKeys["cohere"] || llmApiKey;
                if (cohereApiKey) {
                    reranker = createReranker(agentConfig.retrieval.rerankModel, cohereApiKey);
                }
            }

            // Create RAG engine
            const engine = new RAGEngine(agentConfig, llm, embeddings, vectorStore, reranker);

            spinner.text = `Loading documents from ${targetPath}...`;

            const fullPath = path.resolve(process.cwd(), targetPath);
            const loader = new DirectoryLoader(fullPath);
            const documents = await loader.load();

            if (documents.length === 0) {
                spinner.warn(chalk.yellow(`No supported documents found in ${targetPath}`));
                return;
            }

            spinner.text = `Ingesting ${documents.length} documents into "${agentName}"...`;
            spinner.start();

            const result = await engine.ingest(documents);

            spinner.succeed(chalk.green(`Successfully ingested ${result.processed} documents (${result.chunks} chunks) into agent "${agentName}"`));
        } catch (error) {
            spinner.fail(chalk.red("Ingestion failed"));
            console.error(error);
            process.exit(1);
        }
    });

program.parse();
