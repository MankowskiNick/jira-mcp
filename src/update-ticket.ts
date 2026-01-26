import fetch from "node-fetch";

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

  console.log("JIRA Update URL:", jiraUrl);
  console.log("JIRA Update Payload:", JSON.stringify(payload, null, 2));
  console.log("JIRA Auth:", `Basic ${auth.substring(0, 10)}...`);

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
