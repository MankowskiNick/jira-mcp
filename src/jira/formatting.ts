// Helper functions for formatting data for JIRA API

// Helper function to format text content for JIRA API v3
export function formatJiraContent(
  content: string | undefined,
  defaultText: string = "No content provided"
) {
  return content
    ? {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          },
        ],
      }
    : {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: defaultText,
              },
            ],
          },
        ],
      };
}

// Helper function to format description for JIRA API v3
export function formatDescription(description: string | undefined) {
  return formatJiraContent(description, "No description provided");
}

// Helper function to format acceptance criteria for JIRA API v3
export function formatAcceptanceCriteria(criteria: string | undefined) {
  // Check if criteria is undefined or empty
  if (!criteria) {
    return {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "No acceptance criteria provided",
            },
          ],
        },
      ],
    };
  }

  // Split criteria by newlines to handle bullet points properly
  const lines = criteria.split("\n");
  const content = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Check if line is a bullet point
    if (trimmedLine.startsWith("-") || trimmedLine.startsWith("*")) {
      content.push({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: trimmedLine.substring(1).trim(),
                  },
                ],
              },
            ],
          },
        ],
      });
    } else {
      // Regular paragraph
      content.push({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: trimmedLine,
          },
        ],
      });
    }
  }

  return {
    type: "doc",
    version: 1,
    content: content,
  };
}

/**
 * Extracts plain text from Atlassian Document Format (ADF).
 * Recursively traverses the ADF structure to extract all text content.
 *
 * @param adf - The ADF document or node to extract text from
 * @returns Plain text representation of the ADF content
 */
export function extractTextFromAdf(adf: any): string {
  if (!adf) {
    return "";
  }

  // If it's a string, return it directly
  if (typeof adf === "string") {
    return adf;
  }

  // If it's a text node, return the text
  if (adf.type === "text" && adf.text) {
    return adf.text;
  }

  // If it has content array, recursively extract text from each node
  if (Array.isArray(adf.content)) {
    const parts: string[] = [];

    for (const node of adf.content) {
      const text = extractTextFromAdf(node);
      if (text) {
        parts.push(text);
      }
    }

    // Add appropriate separators based on node types
    if (adf.type === "paragraph" || adf.type === "heading") {
      return parts.join("") + "\n";
    }

    if (adf.type === "bulletList" || adf.type === "orderedList") {
      return parts.join("");
    }

    if (adf.type === "listItem") {
      return "• " + parts.join("") + "\n";
    }

    if (adf.type === "codeBlock") {
      return "```\n" + parts.join("") + "\n```\n";
    }

    return parts.join("");
  }

  return "";
}
