import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createJiraTicket,
  createTicketLink,
  searchJiraTickets,
  updateJiraTicket,
  addJiraComment,
  getJiraComments,
  getJiraTransitions,
  transitionJiraTicket,
  assignJiraTicket,
  addJiraWatcher,
  removeJiraWatcher,
} from "./api.js";
import {
  formatDescription,
  formatAcceptanceCriteria,
  extractTextFromAdf,
} from "./formatting.js";
import { getJiraIssueId } from "../utils.js";
import {
  getZephyrTestSteps,
  addZephyrTestStep,
} from "../zephyr/index.js";

// Check if auto-creation of test tickets is enabled (default to true)
const autoCreateTestTickets = process.env.AUTO_CREATE_TEST_TICKETS !== "false";

// Register JIRA tools on the provided server instance
export function registerJiraTools(server: McpServer) {
  // Create ticket tool
  server.tool(
    "create-ticket",
    "Create a jira ticket",
    {
      summary: z.string().min(1, "Summary is required"),
      issue_type: z.enum(["Bug", "Task", "Story", "Test"]).default("Task"),
      description: z.string().optional(),
      acceptance_criteria: z.string().optional(),
      story_points: z.number().optional(),
      create_test_ticket: z.boolean().optional(),
      parent_epic: z.string().optional(),
      sprint: z.string().optional(),
      story_readiness: z.enum(["Yes", "No"]).optional(),
    },
    async ({
      summary,
      issue_type,
      description,
      acceptance_criteria,
      story_points,
      create_test_ticket,
      parent_epic,
      sprint,
      story_readiness,
    }) => {
      const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue`;

      const formattedDescription = formatDescription(description);

      // Determine if we should create a test ticket
      const shouldCreateTestTicket =
        create_test_ticket !== undefined
          ? create_test_ticket
          : autoCreateTestTickets;

      // Build the payload for the main ticket
      const payload: any = {
        fields: {
          project: {
            key: process.env.JIRA_PROJECT_KEY || "SCRUM",
          },
          summary: summary,
          description: formattedDescription,
          issuetype: {
            name: issue_type,
          },
        },
      };

      // Add acceptance criteria if provided
      if (acceptance_criteria !== undefined) {
        // Using environment variable for acceptance criteria field
        const acceptanceCriteriaField =
          process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD || "customfield_10429";

        // Format and add acceptance criteria to the custom field only, not to description
        payload.fields[acceptanceCriteriaField] =
          formatAcceptanceCriteria(acceptance_criteria);

        // Log for debugging
        console.error(
          `Adding acceptance criteria to field ${acceptanceCriteriaField}`
        );
        console.error(
          "Formatted acceptance criteria:",
          JSON.stringify(formatAcceptanceCriteria(acceptance_criteria), null, 2)
        );
      }

      // Only add custom fields for Bug, Task, and Story issue types, not for Test
      if (issue_type !== "Test") {
        // Add product field if configured
        const productField = process.env.JIRA_PRODUCT_FIELD;
        const productValue = process.env.JIRA_PRODUCT_VALUE;
        const productId = process.env.JIRA_PRODUCT_ID;

        if (productField && productValue && productId) {
          payload.fields[productField] = [
            {
              self: `https://${process.env.JIRA_HOST}/rest/api/3/customFieldOption/${productId}`,
              value: productValue,
              id: productId,
            },
          ];
        }

        // Add category field if configured
        const categoryField = process.env.JIRA_CATEGORY_FIELD;

        if (categoryField) {
          const useAlternateCategory =
            process.env.USE_ALTERNATE_CATEGORY === "true";

          const categoryOptionId = useAlternateCategory
            ? process.env.JIRA_ALTERNATE_CATEGORY_ID
            : process.env.JIRA_DEFAULT_CATEGORY_ID;

          const categoryOptionValue = useAlternateCategory
            ? process.env.JIRA_ALTERNATE_CATEGORY_VALUE
            : process.env.JIRA_DEFAULT_CATEGORY_VALUE;

          if (categoryOptionId && categoryOptionValue) {
            payload.fields[categoryField] = {
              self: `https://${process.env.JIRA_HOST}/rest/api/3/customFieldOption/${categoryOptionId}`,
              value: categoryOptionValue,
              id: categoryOptionId,
            };
          }
        }
      }

      // Add story points if provided
      if (story_points !== undefined && issue_type === "Story") {
        // Using environment variable for story points field
        const storyPointsField =
          process.env.JIRA_STORY_POINTS_FIELD || "customfield_10040";
        payload.fields[storyPointsField] = story_points;

        // Add QA-Testable label for stories with points
        payload.fields.labels = ["QA-Testable"];
      }

      // Add parent epic if provided
      if (parent_epic !== undefined) {
        // Using environment variable for epic link field
        const epicLinkField =
          process.env.JIRA_EPIC_LINK_FIELD || "customfield_10014";
        payload.fields[epicLinkField] = parent_epic;
      }

      // Add sprint if provided
      if (sprint !== undefined) {
        // Sprint field is customfield_10020 based on our query
        payload.fields["customfield_10020"] = [
          {
            name: sprint,
          },
        ];
      }

      // Add story readiness if provided
      if (story_readiness !== undefined) {
        // Story Readiness field is customfield_10596 based on our query
        const storyReadinessId = story_readiness === "Yes" ? "18256" : "18257";
        payload.fields["customfield_10596"] = {
          self: `https://${process.env.JIRA_HOST}/rest/api/3/customFieldOption/${storyReadinessId}`,
          value: story_readiness,
          id: storyReadinessId,
        };
      }

      // Create the auth token
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Create the main ticket
      const result = await createJiraTicket(payload, auth);

      if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating ticket: ${result.errorMessage}`,
          },
        ],
      };
      }

      // Extract the ticket key/number from the response
      const ticketKey = result.data.key;
      let responseText = `Created ticket ${ticketKey} with summary: ${summary}, description: ${
        description || "No description"
      }, issue type: ${issue_type}`;

      if (acceptance_criteria !== undefined) {
        responseText += `, acceptance criteria: ${acceptance_criteria}`;
      }

      if (story_points !== undefined) {
        responseText += `, story points: ${story_points}`;
      }

      // Create a test ticket if this is a Story with points and auto-creation is enabled
      if (
        shouldCreateTestTicket &&
        issue_type === "Story" &&
        story_points !== undefined &&
        ticketKey
      ) {
        // Create a test ticket linked to the story
        const testTicketPayload: any = {
          fields: {
            project: {
              key: process.env.JIRA_PROJECT_KEY || "SCRUM",
            },
            summary: `${ticketKey} ${summary}`,
            description: formatDescription(summary), // Use story title as description
            issuetype: {
              name: "Test",
            },
            // Don't include custom fields for Test issue type as they may not be available
          },
        };

        // Create the test ticket
        const testResult = await createJiraTicket(testTicketPayload, auth);

        if (testResult.success && testResult.data.key) {
          // Link the test ticket to the story
          const linkResult = await createTicketLink(
            ticketKey,
            testResult.data.key,
            "Test Case Linking", // "is tested by" relationship
            auth
          );

          if (linkResult.success) {
            responseText += `\nCreated linked test ticket ${testResult.data.key}`;
          } else {
            responseText += `\nCreated test ticket ${testResult.data.key} but failed to link it: ${linkResult.errorMessage}`;
          }
        } else {
          responseText += `\nFailed to create test ticket: ${testResult.errorMessage}`;
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: responseText,
          },
        ],
      };
    }
  );

  // Link tickets tool
  server.tool(
    "link-tickets",
    "Link two jira tickets",
    {
      outward_issue: z.string().min(1, "Outward issue key is required"),
      inward_issue: z.string().min(1, "Inward issue key is required"),
      link_type: z
        .string()
        .min(1, "Link type is required")
        .default("Test Case Linking"),
    },
    async ({ outward_issue, inward_issue, link_type }) => {
      // Create the auth token
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Create the link
      const result = await createTicketLink(
        outward_issue,
        inward_issue,
        link_type,
        auth
      );

      if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error linking tickets: ${result.errorMessage}`,
          },
        ],
      };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully linked ${outward_issue} to ${inward_issue} with link type "${link_type}"`,
          },
        ],
      };
    }
  );

  // Get ticket tool
  server.tool(
    "get-ticket",
    "Get a jira ticket",
    {
      ticket_id: z.string().min(1, "Ticket ID is required"),
    },
    async ({ ticket_id }) => {
      const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticket_id}`;
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      try {
        const response = await fetch(jiraUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
        });

        const responseData = (await response.json()) as {
          id?: string;
          errorMessages?: string[];
          fields?: {
            project?: {
              id?: string;
            };
          };
        };

        if (!response.ok) {
          console.error("Error fetching ticket:", responseData);
          return {
            content: [
              {
                type: "text" as const,
                text: `Error fetching ticket: ${
                  responseData.errorMessages?.join(", ") || "Unknown error"
                }`,
              },
            ],
          };
        }

        if (!responseData.fields) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No ticket fields found in response",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `JIRA Ticket: ${ticket_id}, Fields: ${JSON.stringify(
                responseData.fields,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        console.error("Exception fetching ticket:", error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching ticket: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  // Search tickets tool
  server.tool(
    "search-tickets",
    "Search for jira tickets by issue type",
    {
      issue_type: z.enum(["Bug", "Task", "Story", "Test"]),
      max_results: z.number().min(1).max(50).default(10).optional(),
      additional_criteria: z.string().optional(), // For additional JQL criteria
    },
    async ({ issue_type, max_results = 10, additional_criteria }) => {
      // Create the auth token
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Construct the JQL query
      let jql = `project = "${process.env.JIRA_PROJECT_KEY}" AND issuetype = "${issue_type}"`;

      // Add additional criteria if provided
      if (additional_criteria) {
        jql += ` AND (${additional_criteria})`;
      }

      // Search for tickets
      const result = await searchJiraTickets(jql, max_results, auth);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching tickets: ${result.errorMessage}`,
            },
          ],
        };
      }

      // Check if we have results
      if (!result.data.issues || result.data.issues.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No ${issue_type} tickets found matching the criteria.`,
            },
          ],
        };
      }

      // Format the results
      const tickets = result.data.issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name || "Unknown",
        priority: issue.fields.priority?.name || "Unknown",
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${result.data.total} ${issue_type} tickets (showing ${
              tickets.length
            }):\n\n${JSON.stringify(tickets, null, 2)}`,
          },
        ],
      };
    }
  );

  // Update ticket tool (enhanced with additional fields)
  server.tool(
    "update-ticket",
    "Update an existing jira ticket with various fields",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      summary: z.string().optional(),
      description: z.string().optional(),
      acceptance_criteria: z.string().optional(),
      story_points: z.number().optional(),
      sprint: z.string().optional(),
      story_readiness: z.enum(["Yes", "No"]).optional(),
      assignee: z.string().optional().describe("Account ID or 'unassigned' to remove assignee"),
      priority: z.enum(["Highest", "High", "Medium", "Low", "Lowest"]).optional(),
      labels: z.array(z.string()).optional().describe("Replaces existing labels"),
      components: z.array(z.string()).optional().describe("Component names"),
      fix_versions: z.array(z.string()).optional().describe("Fix version names"),
      due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    },
    async ({
      ticket_key,
      summary,
      description,
      acceptance_criteria,
      story_points,
      sprint,
      story_readiness,
      assignee,
      priority,
      labels,
      components,
      fix_versions,
      due_date,
    }) => {
      // Create the auth token
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Build the payload for the update
      const payload: any = {
        fields: {},
      };

      // Add summary if provided
      if (summary !== undefined) {
        payload.fields.summary = summary;
      }

      // Add description if provided
      if (description !== undefined) {
        payload.fields.description = formatDescription(description);
      }

      // Add acceptance criteria if provided
      if (acceptance_criteria !== undefined) {
        const acceptanceCriteriaField =
          process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD || "customfield_10429";
        payload.fields[acceptanceCriteriaField] =
          formatAcceptanceCriteria(acceptance_criteria);
      }

      // Add story points if provided
      if (story_points !== undefined) {
        const storyPointsField =
          process.env.JIRA_STORY_POINTS_FIELD || "customfield_10040";
        payload.fields[storyPointsField] = story_points;
      }

      // Add sprint if provided
      if (sprint !== undefined) {
        payload.fields["customfield_10020"] = [{ name: sprint }];
      }

      // Add story readiness if provided
      if (story_readiness !== undefined) {
        const storyReadinessId = story_readiness === "Yes" ? "18256" : "18257";
        payload.fields["customfield_10596"] = {
          self: `https://${process.env.JIRA_HOST}/rest/api/3/customFieldOption/${storyReadinessId}`,
          value: story_readiness,
          id: storyReadinessId,
        };
      }

      // Add assignee if provided
      if (assignee !== undefined) {
        payload.fields.assignee =
          assignee === "unassigned" ? null : { accountId: assignee };
      }

      // Add priority if provided
      if (priority !== undefined) {
        payload.fields.priority = { name: priority };
      }

      // Add labels if provided
      if (labels !== undefined) {
        payload.fields.labels = labels;
      }

      // Add components if provided
      if (components !== undefined) {
        payload.fields.components = components.map((name) => ({ name }));
      }

      // Add fix versions if provided
      if (fix_versions !== undefined) {
        payload.fields.fixVersions = fix_versions.map((name) => ({ name }));
      }

      // Add due date if provided
      if (due_date !== undefined) {
        payload.fields.duedate = due_date;
      }

      // If no fields were provided, return an error
      if (Object.keys(payload.fields).length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: At least one field to update must be provided.",
            },
          ],
        };
      }

      // Update the ticket
      const result = await updateJiraTicket(ticket_key, payload, auth);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating ticket: ${result.errorMessage}`,
            },
          ],
        };
      }

      // Build response text
      const updatedFields: string[] = [];
      if (summary !== undefined) updatedFields.push("summary");
      if (description !== undefined) updatedFields.push("description");
      if (acceptance_criteria !== undefined) updatedFields.push("acceptance_criteria");
      if (story_points !== undefined) updatedFields.push(`story_points: ${story_points}`);
      if (sprint !== undefined) updatedFields.push(`sprint: ${sprint}`);
      if (story_readiness !== undefined) updatedFields.push(`story_readiness: ${story_readiness}`);
      if (assignee !== undefined) updatedFields.push(`assignee: ${assignee}`);
      if (priority !== undefined) updatedFields.push(`priority: ${priority}`);
      if (labels !== undefined) updatedFields.push(`labels: [${labels.join(", ")}]`);
      if (components !== undefined) updatedFields.push(`components: [${components.join(", ")}]`);
      if (fix_versions !== undefined) updatedFields.push(`fix_versions: [${fix_versions.join(", ")}]`);
      if (due_date !== undefined) updatedFields.push(`due_date: ${due_date}`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully updated ticket ${ticket_key}: ${updatedFields.join(", ")}`,
          },
        ],
      };
    }
  );

  // Add comment tool
  server.tool(
    "add-comment",
    "Add a comment to a JIRA ticket",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      comment: z.string().min(1, "Comment text is required"),
    },
    async ({ ticket_key, comment }) => {
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      const commentBody = formatDescription(comment);
      const result = await addJiraComment(ticket_key, commentBody, auth);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error adding comment: ${result.errorMessage}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully added comment to ${ticket_key}`,
          },
        ],
      };
    }
  );

  // List comments tool
  server.tool(
    "list-comments",
    "List comments on a JIRA ticket",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      max_results: z.number().min(1).max(100).default(20).optional(),
    },
    async ({ ticket_key, max_results = 20 }) => {
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      const result = await getJiraComments(ticket_key, max_results, auth);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting comments: ${result.errorMessage}`,
            },
          ],
        };
      }

      const comments = result.data?.comments || [];
      if (comments.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No comments found on ${ticket_key}`,
            },
          ],
        };
      }

      const formattedComments = comments.map((c) => ({
        id: c.id,
        author: c.author.displayName,
        created: c.created,
        body: extractTextFromAdf(c.body).trim(),
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${result.data?.total || comments.length} comments on ${ticket_key}:\n\n${JSON.stringify(formattedComments, null, 2)}`,
          },
        ],
      };
    }
  );

  // Transition ticket tool
  server.tool(
    "transition-ticket",
    "Transition a JIRA ticket to a different status",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      transition_name: z.string().optional().describe("Transition name (e.g., 'Done', 'In Progress')"),
      transition_id: z.string().optional().describe("Transition ID (use if name is ambiguous)"),
      list_transitions: z.boolean().optional().describe("List available transitions instead of transitioning"),
      comment: z.string().optional().describe("Comment to add during the transition"),
    },
    async ({ ticket_key, transition_name, transition_id, list_transitions, comment }) => {
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      // Get available transitions
      const transitionsResult = await getJiraTransitions(ticket_key, auth);

      if (!transitionsResult.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting transitions: ${transitionsResult.errorMessage}`,
            },
          ],
        };
      }

      const transitions = transitionsResult.data?.transitions || [];

      // If list_transitions is true, just return the available transitions
      if (list_transitions) {
        const transitionList = transitions.map((t) => ({
          id: t.id,
          name: t.name,
          to: t.to.name,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: `Available transitions for ${ticket_key}:\n\n${JSON.stringify(transitionList, null, 2)}`,
            },
          ],
        };
      }

      // Find the transition by ID or name
      let targetTransition;
      if (transition_id) {
        targetTransition = transitions.find((t) => t.id === transition_id);
      } else if (transition_name) {
        targetTransition = transitions.find(
          (t) => t.name.toLowerCase() === transition_name.toLowerCase()
        );
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Either transition_name or transition_id is required (or use list_transitions to see available options)",
            },
          ],
        };
      }

      if (!targetTransition) {
        const availableNames = transitions.map((t) => `"${t.name}" (id: ${t.id})`).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Transition not found. Available transitions: ${availableNames}`,
            },
          ],
        };
      }

      // Execute the transition
      const commentBody = comment ? formatDescription(comment) : undefined;
      const result = await transitionJiraTicket(
        ticket_key,
        targetTransition.id,
        commentBody,
        auth
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error transitioning ticket: ${result.errorMessage}`,
            },
          ],
        };
      }

      let responseText = `Successfully transitioned ${ticket_key} to "${targetTransition.to.name}"`;
      if (comment) {
        responseText += " with comment";
      }

      return {
        content: [
          {
            type: "text" as const,
            text: responseText,
          },
        ],
      };
    }
  );

  // Assign ticket tool
  server.tool(
    "assign-ticket",
    "Assign or unassign a JIRA ticket",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      account_id: z.string().optional().describe("Account ID to assign to. Omit to unassign."),
    },
    async ({ ticket_key, account_id }) => {
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      const result = await assignJiraTicket(
        ticket_key,
        account_id || null,
        auth
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error assigning ticket: ${result.errorMessage}`,
            },
          ],
        };
      }

      const action = account_id ? `assigned to ${account_id}` : "unassigned";
      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully ${action} ticket ${ticket_key}`,
          },
        ],
      };
    }
  );

  // Add watcher tool
  server.tool(
    "add-watcher",
    "Add a watcher to a JIRA ticket",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      account_id: z.string().min(1, "Account ID is required"),
    },
    async ({ ticket_key, account_id }) => {
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      const result = await addJiraWatcher(ticket_key, account_id, auth);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error adding watcher: ${result.errorMessage}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully added ${account_id} as watcher to ${ticket_key}`,
          },
        ],
      };
    }
  );

  // Remove watcher tool
  server.tool(
    "remove-watcher",
    "Remove a watcher from a JIRA ticket",
    {
      ticket_key: z.string().min(1, "Ticket key is required"),
      account_id: z.string().min(1, "Account ID is required"),
    },
    async ({ ticket_key, account_id }) => {
      const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
      ).toString("base64");

      const result = await removeJiraWatcher(ticket_key, account_id, auth);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error removing watcher: ${result.errorMessage}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully removed ${account_id} as watcher from ${ticket_key}`,
          },
        ],
      };
    }
  );
}
