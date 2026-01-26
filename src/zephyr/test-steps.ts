import fetch from "node-fetch";
import { generateZephyrJwt } from "./auth.js";
import { ZephyrTestStep, ZephyrAddTestStepResponse } from "./types.js";

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

  console.error("Zephyr URL for getting test steps:", fullUrl);
  console.error("Zephyr API Path:", apiPath);
  console.error("Issue ID:", issueId);
  console.error("Project ID:", projectId);
  console.error("Query Parameters:", queryParams);

  try {
    // Generate JWT for this specific API call with query parameters
    const jwtToken = generateZephyrJwt("GET", apiPath, queryParams);
    console.error("Generated JWT token for Zephyr API");

    // Log headers for debugging
    const headers = {
      "Content-Type": "application/json",
      zapiAccessKey: process.env.ZAPI_ACCESS_KEY || "",
      Authorization: `JWT ${jwtToken}`,
    };
    console.error("Request headers:", JSON.stringify(headers, null, 2));

    const response = await fetch(fullUrl, {
      method: "GET",
      headers,
    });

    console.error("Response status:", response.status, response.statusText);

    // Clone the response to read it twice
    const responseClone = response.clone();
    const responseText = await responseClone.text();
    console.error("Full response body:", responseText);

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

// Helper function to add a test step to a Zephyr test
export async function addZephyrTestStep(
  issueId: string,
  projectId: string,
  step: string,
  data: string = "",
  result: string = ""
): Promise<{
  success: boolean;
  data?: ZephyrAddTestStepResponse;
  errorMessage?: string;
}> {
  // Zephyr base URL from environment variable
  const baseUrl =
    process.env.ZAPI_BASE_URL ||
    "https://prod-api.zephyr4jiracloud.com/connect";
  // Use the correct API endpoint format for Zephyr Squad Cloud
  const apiPath = `/public/rest/api/1.0/teststep/${issueId}`;

  // Query parameters
  const queryParams = { projectId };

  // Build the query string
  const queryString = Object.keys(queryParams)
    .map((key) => `${key}=${queryParams[key as keyof typeof queryParams]}`)
    .join("&");

  // Full URL with query parameters
  const fullUrl = `${baseUrl}${apiPath}?${queryString}`;

  console.error("Zephyr URL:", fullUrl);
  console.error(
    "Zephyr Payload:",
    JSON.stringify({ projectId, step, data, result }, null, 2)
  );

  try {
    // Generate JWT for this specific API call with query parameters
    const jwtToken = generateZephyrJwt("POST", apiPath, queryParams);

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        zapiAccessKey: process.env.ZAPI_ACCESS_KEY || "",
        Authorization: `JWT ${jwtToken}`,
      },
      body: JSON.stringify({ projectId, step, data, result }),
    });

    const responseData = (await response.json()) as ZephyrAddTestStepResponse;

    if (!response.ok) {
      console.error(
        "Error adding test step:",
        JSON.stringify(responseData, null, 2),
        "Status:",
        response.status,
        response.statusText
      );

      return {
        success: false,
        data: responseData,
        errorMessage: `Status: ${response.status} ${response.statusText}`,
      };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error("Exception adding test step:", error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
