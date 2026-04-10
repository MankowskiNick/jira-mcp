import fetch from "node-fetch";
import {
  JiraCreateResponse,
  JiraSearchResponse,
  JiraCommentResponse,
  JiraCommentsListResponse,
  JiraTransitionsResponse,
} from "./types.js";

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

      // Check if it's a custom field validation error
      if (response.status === 400 && responseData.errors) {
        const productField = process.env.JIRA_PRODUCT_FIELD;
        const categoryField = process.env.JIRA_CATEGORY_FIELD;

        const hasProductFieldError = productField && responseData.errors[productField];
        const hasCategoryFieldError = categoryField && responseData.errors[categoryField];

        // Handle required product field error with format retries
        if (hasProductFieldError) {
          const errorMessage = responseData.errors[productField];
          console.error(`Product field error: ${errorMessage}`);

          const productValue = process.env.JIRA_PRODUCT_VALUE;
          const productId = process.env.JIRA_PRODUCT_ID;

          if (productValue && productId) {
            console.error("Retrying with alternative product field formats...");

            // Try format 1: Just the ID as string
            let retryPayload = JSON.parse(JSON.stringify(payload));
            retryPayload.fields[productField] = productId;
            let retryResponse = await fetch(jiraUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
              body: JSON.stringify(retryPayload),
            });
            if (retryResponse.ok) {
              const retryData = (await retryResponse.json()) as JiraCreateResponse;
              console.error("Ticket created with product field as ID string");
              return { success: true, data: retryData };
            }

            // Try format 2: Array with just ID
            retryPayload = JSON.parse(JSON.stringify(payload));
            retryPayload.fields[productField] = [{ id: productId }];
            retryResponse = await fetch(jiraUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
              body: JSON.stringify(retryPayload),
            });
            if (retryResponse.ok) {
              const retryData = (await retryResponse.json()) as JiraCreateResponse;
              console.error("Ticket created with product field as array with ID");
              return { success: true, data: retryData };
            }

            // Try format 3: Array with just value
            retryPayload = JSON.parse(JSON.stringify(payload));
            retryPayload.fields[productField] = [{ value: productValue }];
            retryResponse = await fetch(jiraUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
              body: JSON.stringify(retryPayload),
            });
            if (retryResponse.ok) {
              const retryData = (await retryResponse.json()) as JiraCreateResponse;
              console.error("Ticket created with product field as array with value");
              return { success: true, data: retryData };
            }

            console.error("All product field format retries failed");
          }

          // If required field and all retries failed, return detailed error
          if (errorMessage.toLowerCase().includes("required")) {
            return {
              success: false,
              data: responseData,
              errorMessage: `Required field validation failed: ${errorMessage}. The product ID "${productId}" or value "${productValue}" may be invalid.`,
            };
          }
        }

        // For non-required field errors, try removing problematic fields
        if (
          (hasProductFieldError && !responseData.errors[productField!].toLowerCase().includes("required")) ||
          hasCategoryFieldError
        ) {
          console.error("Retrying without problematic custom fields...");
          const retryPayload = JSON.parse(JSON.stringify(payload));

          if (hasProductFieldError && !responseData.errors[productField!].toLowerCase().includes("required")) {
            delete retryPayload.fields[productField!];
            console.error(`Removed problematic product field: ${productField}`);
          }
          if (hasCategoryFieldError) {
            delete retryPayload.fields[categoryField!];
            console.error(`Removed problematic category field: ${categoryField}`);
          }

          const retryResponse = await fetch(jiraUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
            body: JSON.stringify(retryPayload),
          });
          const retryData = (await retryResponse.json()) as JiraCreateResponse;

          if (retryResponse.ok) {
            console.error("Ticket created after removing problematic custom fields");
            return { success: true, data: retryData };
          }
          console.error("Retry also failed:", JSON.stringify(retryData, null, 2));
        }
      }

      // Default error extraction
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
  }/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;

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

// Helper function to add a comment to a JIRA ticket
export async function addJiraComment(
  ticketKey: string,
  body: any,
  auth: string
): Promise<{
  success: boolean;
  data?: JiraCommentResponse;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/comment`;

  console.error("JIRA Add Comment URL:", jiraUrl);

  try {
    const response = await fetch(jiraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ body }),
    });

    if (response.status === 201) {
      const responseData = (await response.json()) as JiraCommentResponse;
      return { success: true, data: responseData };
    }

    let errorMessage = `Status: ${response.status} ${response.statusText}`;
    try {
      const responseData = (await response.json()) as JiraCommentResponse;
      console.error("Error adding comment:", responseData);
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
    console.error("Exception adding comment:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to get comments from a JIRA ticket
export async function getJiraComments(
  ticketKey: string,
  maxResults: number,
  auth: string
): Promise<{
  success: boolean;
  data?: JiraCommentsListResponse;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/comment?maxResults=${maxResults}`;

  console.error("JIRA Get Comments URL:", jiraUrl);

  try {
    const response = await fetch(jiraUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    });

    const responseData = (await response.json()) as JiraCommentsListResponse;

    if (!response.ok) {
      console.error("Error getting comments:", responseData);
      let errorMessage = `Status: ${response.status} ${response.statusText}`;
      if (responseData.errorMessages && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(", ");
      }
      return { success: false, data: responseData, errorMessage };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error("Exception getting comments:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to get available transitions for a JIRA ticket
export async function getJiraTransitions(
  ticketKey: string,
  auth: string
): Promise<{
  success: boolean;
  data?: JiraTransitionsResponse;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/transitions`;

  console.error("JIRA Get Transitions URL:", jiraUrl);

  try {
    const response = await fetch(jiraUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    });

    const responseData = (await response.json()) as JiraTransitionsResponse;

    if (!response.ok) {
      console.error("Error getting transitions:", responseData);
      let errorMessage = `Status: ${response.status} ${response.statusText}`;
      if (responseData.errorMessages && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(", ");
      }
      return { success: false, data: responseData, errorMessage };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error("Exception getting transitions:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to transition a JIRA ticket
export async function transitionJiraTicket(
  ticketKey: string,
  transitionId: string,
  comment: any | undefined,
  auth: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/transitions`;

  const payload: any = {
    transition: { id: transitionId },
  };

  if (comment) {
    payload.update = {
      comment: [{ add: { body: comment } }],
    };
  }

  console.error("JIRA Transition URL:", jiraUrl);
  console.error("JIRA Transition Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(jiraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 204) {
      return { success: true };
    }

    let errorMessage = `Status: ${response.status} ${response.statusText}`;
    try {
      const responseData = (await response.json()) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      console.error("Error transitioning ticket:", responseData);
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
    console.error("Exception transitioning ticket:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to assign a JIRA ticket
export async function assignJiraTicket(
  ticketKey: string,
  accountId: string | null,
  auth: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/assignee`;

  const payload = { accountId };

  console.error("JIRA Assign URL:", jiraUrl);
  console.error("JIRA Assign Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(jiraUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 204) {
      return { success: true };
    }

    let errorMessage = `Status: ${response.status} ${response.statusText}`;
    try {
      const responseData = (await response.json()) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      console.error("Error assigning ticket:", responseData);
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
    console.error("Exception assigning ticket:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to add a watcher to a JIRA ticket
export async function addJiraWatcher(
  ticketKey: string,
  accountId: string,
  auth: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/watchers`;

  console.error("JIRA Add Watcher URL:", jiraUrl);

  try {
    const response = await fetch(jiraUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(accountId),
    });

    if (response.status === 204) {
      return { success: true };
    }

    let errorMessage = `Status: ${response.status} ${response.statusText}`;
    try {
      const responseData = (await response.json()) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      console.error("Error adding watcher:", responseData);
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
    console.error("Exception adding watcher:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to remove a watcher from a JIRA ticket
export async function removeJiraWatcher(
  ticketKey: string,
  accountId: string,
  auth: string
): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}/watchers?accountId=${encodeURIComponent(accountId)}`;

  console.error("JIRA Remove Watcher URL:", jiraUrl);

  try {
    const response = await fetch(jiraUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    });

    if (response.status === 204) {
      return { success: true };
    }

    let errorMessage = `Status: ${response.status} ${response.statusText}`;
    try {
      const responseData = (await response.json()) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      console.error("Error removing watcher:", responseData);
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
    console.error("Exception removing watcher:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
