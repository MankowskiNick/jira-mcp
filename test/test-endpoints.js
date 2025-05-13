import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Helper function to generate a JWT token for Zephyr API
function generateZephyrJwt(method, apiPath, expirationSec = 3600) {
    // Zephyr base URL from environment variable
    const zephyrBase = (
        process.env.ZAPI_BASE_URL || "https://prod-api.zephyr4jiracloud.com/connect"
    ).replace(/\/$/, "");

    // Build the canonical string: METHOD&<path>&
    const canonical = `${method.toUpperCase()}&${apiPath}&`;

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

// Function to test different API endpoints
async function testEndpoints(issueId) {
    // Zephyr base URL from environment variable
    const baseUrl = process.env.ZAPI_BASE_URL || "https://prod-api.zephyr4jiracloud.com/connect";

    // Different endpoint formats to try
    const endpoints = [
        `/public/rest/api/1.0/teststep/${issueId}/`,
        `/public/rest/api/1.0/teststep/${issueId}`,
        `/public/rest/api/1.0/steps/${issueId}`,
        `/public/rest/api/1.0/steps/${issueId}/`,
        `/public/rest/api/1.0/teststeps/${issueId}`,
        `/public/rest/api/1.0/teststeps/${issueId}/`,
        `/public/rest/api/1.0/test/steps/${issueId}`,
        `/public/rest/api/1.0/test/steps/${issueId}/`
    ];

    console.log(`Testing ${endpoints.length} different endpoint formats for issue ID ${issueId}...`);

    for (const apiPath of endpoints) {
        const fullUrl = `${baseUrl}${apiPath}`;
        console.log(`\nTrying endpoint: ${apiPath}`);
        console.log(`Full URL: ${fullUrl}`);

        try {
            // Generate JWT for this specific API call
            const jwtToken = generateZephyrJwt("GET", apiPath);

            const headers = {
                "Content-Type": "application/json",
                zapiAccessKey: process.env.ZAPI_ACCESS_KEY || "",
                Authorization: `JWT ${jwtToken}`,
            };

            const response = await fetch(fullUrl, {
                method: "GET",
                headers,
            });

            console.log(`Response status: ${response.status} ${response.statusText}`);

            const responseText = await response.text();
            console.log(`Response body: ${responseText}`);

            if (response.ok) {
                console.log(`SUCCESS! Endpoint ${apiPath} works!`);
            }
        } catch (error) {
            console.error(`Error with endpoint ${apiPath}:`, error.message);
        }
    }
}

// Main function
async function main() {
    const ticketKey = 'DEMO-123';
    console.log(`Testing endpoints for ticket ${ticketKey}...`);

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
    console.log(`Found internal ID for ticket ${ticketKey}: ${issueId}`);

    // Test different endpoints
    await testEndpoints(issueId);
}

// Run the test
main().catch(error => {
    console.error('Test failed:', error);
});
