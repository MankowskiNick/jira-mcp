import crypto from "crypto";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

// Type for Zephyr test step response
export type ZephyrTestStep = {
  id: number;
  orderId: number;
  step: string;
  data?: string;
  result?: string;
  [key: string]: any;
};

// Helper function to generate a JWT token for Zephyr API
export function generateZephyrJwt(
  method: string,
  apiPath: string,
  queryParams: Record<string, string> = {},
  expirationSec: number = 3600
): string {
  // Zephyr base URL from environment variable
  const zephyrBase = (
    process.env.ZAPI_BASE_URL || "https://prod-api.zephyr4jiracloud.com/connect"
  ).replace(/\/$/, "");

  // Sort query parameters alphabetically
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key as keyof typeof queryParams]}`)
    .join("&");

  // Build the canonical string: METHOD&<path>&<query>
  const canonical = `${method.toUpperCase()}&${apiPath}&${canonicalQuery}`;

  // Create SHA-256 hex hash of canonical string
  const qsh = crypto
    .createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");

  // Timestamps
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expirationSec;

  // JWT claims
  const payload = {
    sub: process.env.ZAPI_ACCOUNT_ID, // Atlassian account ID
    iss: process.env.ZAPI_ACCESS_KEY, // Zephyr Access Key
    qsh, // query-string hash
    iat: now,
    exp,
  };

  // Sign with HMAC-SHA256 using Zephyr Secret Key
  return jwt.sign(payload, process.env.ZAPI_SECRET_KEY || "", {
    algorithm: "HS256",
  });
}

// Function to get Zephyr test steps for a ticket
export async function getZephyrTestSteps(
  issueId: string,
  projectId: string
): Promise<{
  success: boolean;
  steps?: ZephyrTestStep[];
  errorMessage?: string;
}> {
  // Zephyr base URL from environment variable
  const baseUrl =
    process.env.ZAPI_BASE_URL ||
    "https://prod-api.zephyr4jiracloud.com/connect";

  // Use the correct API endpoint format for Zephyr Squad Cloud
  // The correct format is /public/rest/api/1.0/teststep/{issueId} (without trailing slash)
  const apiPath = `/public/rest/api/1.0/teststep/${issueId}`;

  // Query parameters
  const queryParams = { projectId };

  // Build the query string
  const queryString = Object.keys(queryParams)
    .map((key) => `${key}=${queryParams[key as keyof typeof queryParams]}`)
    .join("&");

  // Full URL with query parameters
  const fullUrl = `${baseUrl}${apiPath}?${queryString}`;

  console.log("Zephyr URL for getting test steps:", fullUrl);
  console.log("Zephyr API Path:", apiPath);
  console.log("Issue ID:", issueId);
  console.log("Project ID:", projectId);
  console.log("Query Parameters:", queryParams);

  try {
    // Generate JWT for this specific API call with query parameters
    const jwtToken = generateZephyrJwt("GET", apiPath, queryParams);
    console.log("Generated JWT token for Zephyr API");

    // Log headers for debugging
    const headers = {
      "Content-Type": "application/json",
      zapiAccessKey: process.env.ZAPI_ACCESS_KEY || "",
      Authorization: `JWT ${jwtToken}`,
    };
    console.log("Request headers:", JSON.stringify(headers, null, 2));

    const response = await fetch(fullUrl, {
      method: "GET",
      headers,
    });

    console.log("Response status:", response.status, response.statusText);

    // Clone the response to read it twice
    const responseClone = response.clone();
    const responseText = await responseClone.text();
    console.log("Full response body:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error("Error parsing response as JSON:", e);
      responseData = {
        error: "Could not parse response as JSON",
        text: responseText,
      };
    }

    if (!response.ok) {
      console.error(
        "Error getting test steps:",
        JSON.stringify(responseData, null, 2),
        "Status:",
        response.status,
        response.statusText
      );

      return {
        success: false,
        errorMessage: `Status: ${response.status} ${response.statusText}. Response: ${responseText}`,
      };
    }

    // Check if the response is an array of test steps
    if (Array.isArray(responseData)) {
      return { success: true, steps: responseData as ZephyrTestStep[] };
    } else {
      // If the response is not an array, it might be a single test step or an error
      console.error(
        "Unexpected response format:",
        JSON.stringify(responseData as Record<string, unknown>, null, 2)
      );
      return {
        success: false,
        errorMessage: "Unexpected response format from Zephyr API",
      };
    }
  } catch (error) {
    console.error("Exception getting test steps:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to get the internal Jira ID and project ID from a ticket key
export async function getJiraIssueId(
  ticketKey: string,
  auth: string
): Promise<{
  success: boolean;
  id?: string;
  projectId?: string;
  errorMessage?: string;
}> {
  const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}`;

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

      let errorMessage = `Status: ${response.status} ${response.statusText}`;
      if (responseData.errorMessages && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(", ");
      }

      return { success: false, errorMessage };
    }

    if (!responseData.id) {
      return {
        success: false,
        errorMessage: "No issue ID found in response",
      };
    }

    // Extract project ID from the response
    const projectId = responseData.fields?.project?.id;
    if (!projectId) {
      console.log("Warning: Project ID not found in response");
    } else {
      console.log(`Found project ID: ${projectId}`);
    }

    return {
      success: true,
      id: responseData.id,
      projectId,
    };
  } catch (error) {
    console.error("Exception fetching ticket ID:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
