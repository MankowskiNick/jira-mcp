import fetch from "node-fetch";
import { JiraCreateResponse, JiraSearchResponse } from "./types.js";

// Helper function to update a JIRA ticket
export async function updateJiraTicket(
  ticketKey: string,
  payload: any,
  auth: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}`;

  console.error("JIRA Update URL:", jiraUrl);
  console.error("JIRA Update Payload:", JSON.stringify(payload, null, 2));
  console.error("JIRA Auth:", `Basic ${auth.substring(0, 10)}...`);

  try {
    const response = await fetch(jiraUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    // For a successful update, JIRA returns 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    // If there's an error, try to parse the response
    let errorMessage = `Status: ${response.status} ${response.statusText}`;
    try {
      const responseData = (await response.json()) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      console.error("Error updating ticket:", responseData);

      if (responseData.errorMessages && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(", ");
      } else if (responseData.errors) {
        errorMessage = JSON.stringify(responseData.errors);
      }
    } catch (parseError) {
      console.error("Error parsing error response:", parseError);
    }

    return { success: false, errorMessage };
  } catch (error) {
    console.error("Exception updating ticket:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to create a JIRA ticket
export async function createJiraTicket(
  payload: any,
  auth: string
): Promise<{
  success: boolean;
  data: JiraCreateResponse;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue`;

  console.error("JIRA URL:", jiraUrl);
  console.error("JIRA Payload:", JSON.stringify(payload, null, 2));
  console.error("JIRA Auth:", `Basic ${auth.substring(0, 10)}...`);
  console.error("JIRA Project Key:", process.env.JIRA_PROJECT_KEY);

  try {
    const response = await fetch(jiraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = (await response.json()) as JiraCreateResponse;

    if (!response.ok) {
      console.error(
        "Error creating ticket:",
        JSON.stringify(responseData, null, 2),
        "Status:",
        response.status,
        response.statusText
      );

      // Try to extract more detailed error information
      let errorMessage = `Status: ${response.status} ${response.statusText}`;

      if (responseData.errorMessages && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(", ");
      } else if (responseData.errors) {
        errorMessage = JSON.stringify(responseData.errors);
      }

      return { success: false, data: responseData, errorMessage };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error("Exception creating ticket:", error);
    return {
      success: false,
      data: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to create a link between two tickets
export async function createTicketLink(
  outwardIssue: string,
  inwardIssue: string,
  linkType: string,
  auth: string
): Promise<{ success: boolean; errorMessage?: string }> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issueLink`;

  const payload = {
    outwardIssue: {
      key: outwardIssue,
    },
    inwardIssue: {
      key: inwardIssue,
    },
    type: {
      name: linkType,
    },
  };

  console.error("Creating link between", outwardIssue, "and", inwardIssue);
  console.error("Link payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(jiraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseData = await response.json();
      console.error(
        "Error creating link:",
        JSON.stringify(responseData, null, 2),
        "Status:",
        response.status,
        response.statusText
      );

      let errorMessage = `Status: ${response.status} ${response.statusText}`;
      return { success: false, errorMessage };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception creating link:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to search for JIRA tickets
export async function searchJiraTickets(
  jql: string,
  maxResults: number,
  auth: string
): Promise<{
  success: boolean;
  data: JiraSearchResponse;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${
    process.env.JIRA_HOST
  }/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;

  console.error("JIRA Search URL:", jiraUrl);
  console.error("JIRA Search JQL:", jql);
  console.error("JIRA Auth:", `Basic ${auth.substring(0, 10)}...`);

  try {
    const response = await fetch(jiraUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    });

    const responseData = (await response.json()) as JiraSearchResponse;

    if (!response.ok) {
      console.error(
        "Error searching tickets:",
        JSON.stringify(responseData, null, 2),
        "Status:",
        response.status,
        response.statusText
      );

      // Try to extract more detailed error information
      let errorMessage = `Status: ${response.status} ${response.statusText}`;

      if (responseData.errorMessages && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(", ");
      }

      return { success: false, data: responseData, errorMessage };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error("Exception searching tickets:", error);
    return {
      success: false,
      data: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
