import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getZephyrTestSteps, addZephyrTestStep } from "./test-steps.js";
import { getJiraIssueId } from "../utils.js";

// Register Zephyr tools on the provided server instance
export function registerZephyrTools(server: McpServer) {
  // Get test steps tool
  server.tool(
    "get-test-steps",
    "Get test steps from a test ticket via Zephyr integration",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
    },
    async ({ ticket_key }) => {
      // Create the auth token for Jira API
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Get the internal Jira ID from the ticket key
      const idResult = await getJiraIssueId(ticket_key, auth);

      if (!idResult.success || !idResult.id) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting internal ID for ticket ${ticket_key}: ${idResult.errorMessage}`,
            },
          ],
        };
      }

      const issueId = idResult.id;
      console.error(`Found internal ID for ticket ${ticket_key}: ${issueId}`);

      // Get the test steps
      // Make sure we have the project ID
      const projectId = idResult.projectId;
      if (!projectId) {
        console.error("Project ID not found, cannot get test steps");
        return {
          content: [
            {
              type: "text",
              text: `Error: Project ID not found for ticket ${ticket_key}`,
            },
          ],
        };
      }

      const result = await getZephyrTestSteps(issueId, projectId);

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting test steps for ticket ${ticket_key}: ${result.errorMessage}`,
            },
          ],
        };
      }

      // Check if we have test steps
      if (!result.steps || result.steps.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No test steps found for ticket ${ticket_key}.`,
            },
          ],
        };
      }

      // Format the test steps
      const formattedSteps = result.steps.map((step) => ({
        id: step.id,
        orderId: step.orderId,
        step: step.step,
        data: step.data || "",
        result: step.result || "",
      }));

      return {
        content: [
          {
            type: "text",
            text: `Found ${
              formattedSteps.length
            } test step(s) for ticket ${ticket_key}:\n\n${JSON.stringify(
              formattedSteps,
              null,
              2
            )}`,
          },
        ],
      };
    }
  );

  // Add test steps tool
  server.tool(
    "add-test-steps",
    "Add test steps to a test ticket via Zephyr integration",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      steps: z
        .array(
          z.object({
            step: z.string().min(1, "Step description is required"),
            data: z.string().optional(),
            result: z.string().optional(),
          })
        )
        .min(1, "At least one test step is required"),
    },
    async ({ ticket_key, steps }) => {
      // Create the auth token for Jira API
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Get the internal Jira ID from the ticket key
      const idResult = await getJiraIssueId(ticket_key, auth);

      if (!idResult.success || !idResult.id) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting internal ID for ticket ${ticket_key}: ${idResult.errorMessage}`,
            },
          ],
        };
      }

      const issueId = idResult.id;
      console.error(`Found internal ID for ticket ${ticket_key}: ${issueId}`);

      // Add each test step
      const results: string[] = [];
      let allSuccessful = true;

      for (const [index, stepObj] of steps.entries()) {
        const step: string = stepObj.step;
        const data: string = stepObj.data || "";
        const result: string = stepObj.result || "";
        console.error(`Adding test step ${index + 1}/${steps.length}: ${step}`);

        // Pass the project ID to the addZephyrTestStep function
        const projectId = idResult.projectId;
        if (!projectId) {
          console.error("Project ID not found, cannot add test steps");
          return {
            content: [
              {
                type: "text",
                text: `Error: Project ID not found for ticket ${ticket_key}`,
              },
            ],
          };
        }

        const stepResult = await addZephyrTestStep(
          issueId,
          projectId,
          step,
          data,
          result
        );

        if (stepResult.success) {
          results.push(`Step ${index + 1}: Added successfully`);
        } else {
          results.push(`Step ${index + 1}: Failed - ${stepResult.errorMessage}`);
          allSuccessful = false;
        }
      }

      // Return the results
      if (allSuccessful) {
        return {
          content: [
            {
              type: "text",
              text: `Successfully added ${
                steps.length
              } test step(s) to ticket ${ticket_key}:\n\n${results.join("\n")}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Some test steps could not be added to ticket ${ticket_key}:\n\n${results.join(
                "\n"
              )}`,
            },
          ],
        };
      }
    }
  );
}
