import dotenv from 'dotenv';
dotenv.config();

import { getZephyrTestSteps, getJiraIssueId } from './build/get-zephyr-test-steps.js';

// Main function to get test steps from a ticket
async function getTestSteps(ticketKey) {
    console.log(`Retrieving test steps for ticket ${ticketKey}...`);

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

    // Get the test steps
    const projectId = idResult.projectId;
    if (!projectId) {
        console.error("Project ID not found, cannot get test steps");
        return;
    }

    const result = await getZephyrTestSteps(issueId, projectId);

    if (!result.success) {
        console.error(`Error getting test steps for ticket ${ticketKey}: ${result.errorMessage}`);
        return;
    }

    // Check if we have test steps
    if (!result.steps || result.steps.length === 0) {
        console.log(`No test steps found for ticket ${ticketKey}.`);
        return;
    }

    // Format and display the test steps
    console.log(`Found ${result.steps.length} test step(s) for ticket ${ticketKey}:`);

    result.steps.forEach((step, index) => {
        console.log(`\nStep ${index + 1}:`);
        console.log(`  ID: ${step.id}`);
        console.log(`  Order: ${step.orderId}`);
        console.log(`  Step: ${step.step}`);
        console.log(`  Data: ${step.data || ''}`);
        console.log(`  Result: ${step.result || ''}`);
    });

    return result.steps;
}

// Run the test with the specified ticket key
const ticketKey = 'DEMO-123';
getTestSteps(ticketKey)
    .then(steps => {
        if (steps) {
            console.log('\nTest completed successfully');
        } else {
            console.log('\nTest completed with errors');
        }
    })
    .catch(error => {
        console.error('Test failed:', error);
    });
