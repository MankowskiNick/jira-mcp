import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (parent of src or build directory)
const envPath = path.resolve(__dirname, "..", ".env");
console.error(`[JIRA-MCP] Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error(`[JIRA-MCP] Error loading .env:`, result.error);
} else {
  console.error(`[JIRA-MCP] .env loaded successfully`);
}
console.error(`[JIRA-MCP] JIRA_HOST: ${process.env.JIRA_HOST || "NOT SET"}`);
console.error(
  `[JIRA-MCP] JIRA_USERNAME: ${process.env.JIRA_USERNAME ? "SET" : "NOT SET"}`
);
console.error(
  `[JIRA-MCP] JIRA_API_TOKEN: ${process.env.JIRA_API_TOKEN ? "SET" : "NOT SET"}`
);

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerJiraTools } from "./jira/tools.js";
import { registerZephyrTools } from "./zephyr/tools.js";

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

// Create server instance
const server = new McpServer({
  name: "jira-mcp",
  version: "1.0.0",
});

// Register all tools from modular modules
registerJiraTools(server);
registerZephyrTools(server);

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Error in main():", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error running main:", error);
  process.exit(1);
});
