import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';

// Helper function to get a JIRA ticket
async function getJiraTicket(ticketKey, auth) {
    const jiraUrl = `https://${process.env.JIRA_HOST}/rest/api/3/issue/${ticketKey}`;

    console.log("JIRA URL:", jiraUrl);
    console.log("JIRA Auth:", `Basic ${auth.substring(0, 10)}...`);

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

            let errorMessage = `Status: ${response.status} ${response.statusText}`;
            if (responseData.errorMessages && responseData.errorMessages.length > 0) {
                errorMessage = responseData.errorMessages.join(", ");
            }

            return { success: false, errorMessage, data: responseData };
        }

        return { success: true, data: responseData };
    } catch (error) {
        console.error("Exception fetching ticket:", error);
        return {
            success: false,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

// Main function
async function queryIssue(ticketKey) {
    // Create the auth token for Jira API
    const auth = Buffer.from(
        `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
    ).toString("base64");

    // Get the ticket
    const result = await getJiraTicket(ticketKey, auth);

    if (!result.success) {
        console.error(`Error getting ticket ${ticketKey}: ${result.errorMessage}`);
        return;
    }

    console.log(`Successfully retrieved ticket ${ticketKey}`);
    console.log("Ticket ID:", result.data.id);
    console.log("Ticket Key:", result.data.key);
    console.log("Ticket Summary:", result.data.fields?.summary);
    console.log("Ticket Type:", result.data.fields?.issuetype?.name);
    console.log("Ticket Status:", result.data.fields?.status?.name);

    // Print the full ticket data
    console.log("\nFull Ticket Data:");
    console.log(JSON.stringify(result.data, null, 2));
}

// Test data
const ticketKey = "";

// Run the test
queryIssue(ticketKey)
    .then(() => {
        console.log("Query completed");
    })
    .catch(error => {
        console.error("Query failed:", error);
    });
