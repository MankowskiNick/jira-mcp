import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Helper function to generate a JWT token for Zephyr API
function generateZephyrJwt(method, apiPath, queryParams = {}, expirationSec = 3600) {
    // Zephyr base URL from environment variable
    const zephyrBase = (
        process.env.ZAPI_BASE_URL || "https://prod-api.zephyr4jiracloud.com/connect"
    ).replace(/\/$/, "");

    // Sort query parameters alphabetically
    const canonicalQuery = Object.keys(queryParams)
        .sort()
        .map(key => `${key}=${queryParams[key]}`)
        .join('&');

    // Build the canonical string: METHOD&<path>&<query>
    const canonical = `${method.toUpperCase()}&${apiPath}&${canonicalQuery}`;

    console.log("Canonical string:", canonical);

    // Create SHA-256 hex hash of canonical string
    const qsh = crypto
        .createHash("sha256")
        .update(canonical, "utf8")
        .digest("hex");

    console.log("QSH:", qsh);

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

// Helper function to get the internal Jira ID from a ticket key
async function getJiraIssueId(ticketKey, auth) {
    const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}`;

    try {
        const response = await fetch(jiraUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${auth}`,
            },
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("Error fetching ticket:", responseData);
            return { success: false, errorMessage: `Status: ${response.status} ${response.statusText}` };
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

// Function to test the API with project ID
async function testWithProjectId(issueId, projectId) {
    // Zephyr base URL from environment variable
    const baseUrl = process.env.ZAPI_BASE_URL || "https://prod-api.zephyr4jiracloud.com/connect";

    // Endpoint to test
    const apiPath = `/public/rest/api/1.0/teststep/${issueId}`;

    // Query parameters
    const queryParams = {
        projectId: projectId
    };

    // Build the query string
    const queryString = Object.keys(queryParams)
        .map(key => `${key}=${queryParams[key]}`)
        .join('&');

    // Full URL with query parameters
    const fullUrl = `${baseUrl}${apiPath}?${queryString}`;

    console.log(`Testing endpoint with project ID: ${apiPath}`);
    console.log(`Full URL: ${fullUrl}`);
    console.log(`Query parameters: ${JSON.stringify(queryParams)}`);

    try {
        // Generate JWT for this specific API call with query parameters
        const jwtToken = generateZephyrJwt("GET", apiPath, queryParams);

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

        console.log(`Response status: ${response.status} ${response.statusText}`);

        const responseText = await response.text();
        console.log(`Response body: ${responseText}`);

        if (response.ok) {
            console.log(`SUCCESS! Endpoint ${apiPath} with projectId=${projectId} works!`);

            try {
                const responseData = JSON.parse(responseText);
                if (Array.isArray(responseData)) {
                    console.log(`Found ${responseData.length} test steps:`);
                    responseData.forEach((step, index) => {
                        console.log(`\nStep ${index + 1}:`);
                        console.log(`  ID: ${step.id}`);
                        console.log(`  Order: ${step.orderId}`);
                        console.log(`  Step: ${step.step}`);
                        console.log(`  Data: ${step.data || ''}`);
                        console.log(`  Result: ${step.result || ''}`);
                    });
                }
            } catch (e) {
                console.error("Error parsing response as JSON:", e);
            }
        }
    } catch (error) {
        console.error(`Error with endpoint ${apiPath}:`, error.message);
    }
}

// Main function
async function main() {
    const ticketKey = 'DEMO-123';
    console.log(`Testing endpoint for ticket ${ticketKey} with project ID...`);

    // Create the auth token for Jira API
    const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
    ).toString('base64');

    // Get the internal Jira ID from the ticket key
    const idResult = await getJiraIssueId(ticketKey, auth);

    if (!idResult.success || !idResult.id) {
        console.error(`Error getting internal ID for ticket ${ticketKey}: ${idResult.errorMessage}`);
        return;
    }

    const issueId = idResult.id;
    const projectId = idResult.projectId;

    console.log(`Found internal ID for ticket ${ticketKey}: ${issueId}`);
    console.log(`Found project ID: ${projectId}`);

    if (!projectId) {
        console.error("Project ID is required but not found");
        return;
    }

    // Test with project ID
    await testWithProjectId(issueId, projectId);
}

// Run the test
main().catch(error => {
    console.error('Test failed:', error);
});
