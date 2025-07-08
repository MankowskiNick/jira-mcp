# JIRA MCP Integration

[![Certified by MCP Hub](https://img.shields.io/badge/Certified-MCP%20Hub-blue)](https://mcphub.com/mcp-servers/mankowskinick/jira-mcp)
[![MIT License](https://img.shields.io/npm/l/jira-mcp)](LICENSE)

A [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) server for integrating JIRA with Claude. This tool allows Claude to create JIRA tickets directly within your conversations.

## Overview

The JIRA MCP project is a Node.js/TypeScript application that provides a Model Context Protocol (MCP) server for integrating with JIRA and Zephyr. It allows AI assistants to interact with JIRA for project management and Zephyr for test management through a standardized protocol.

<img width="772" alt="grafik" src="https://github.com/user-attachments/assets/a6f9afd8-7f75-4316-9421-ee7126002d2b" />
<img width="1188" alt="grafik" src="https://github.com/user-attachments/assets/b8f089ac-4443-4a64-91c0-87b97175d9dd" />

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Configuration Location](#configuration-location)
  - [Configuration Template](#configuration-template)
  - [Basic Configuration](#basic-configuration)
  - [Required Configuration](#required-configuration)
  - [Optional Configuration](#optional-configuration)
    - [Test Ticket Creation](#test-ticket-creation)
    - [Zephyr Integration](#zephyr-integration)
    - [Custom Field Configuration](#custom-field-configuration)
    - [Product Field Configuration](#product-field-configuration-optional)
    - [Category Field Configuration](#category-field-configuration-optional)
  - [Minimal Configuration Example](#minimal-configuration-example)
  - [Finding Custom Field IDs](#finding-custom-field-ids)
- [Available Tools](#available-tools)
  - [create-ticket](#create-ticket)
  - [get-ticket](#get-ticket)
  - [search-tickets](#search-tickets)
  - [update-ticket](#update-ticket)
  - [link-tickets](#link-tickets)
  - [get-test-steps](#get-test-steps)
  - [add-test-steps](#add-test-steps)
- [Project Architecture](#project-architecture)
- [Core Components](#core-components)
- [Authentication](#authentication)
- [Data Formatting](#data-formatting)
- [Error Handling](#error-handling)
- [Utility Scripts](#utility-scripts)
  - [update-mcp-settings.js](#update-mcp-settingsjs)
- [Usage with Claude](#usage-with-claude)
- [Getting a JIRA API Token](#getting-a-jira-api-token)
- [Troubleshooting](#troubleshooting)

## Features

- Create JIRA tickets with summary, description, acceptance criteria, and issue type
- Assign story points to Story tickets
- Automatically create linked Test tickets for Stories with points
- Search for JIRA tickets by issue type and additional criteria
- Update existing JIRA tickets with new field values
- Link JIRA tickets together with specified relationship types
- Retrieve and add test steps for Zephyr test tickets
- Seamless integration with Claude desktop application
- Simple configuration using Claude's desktop configuration file

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/MankowskiNick/jira-mcp.git
   cd jira-mcp
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Build the project:
   ```
    npm run build -- on unix systems
    -- or --
    npm run build-win -- on windows systems
   ```

## Configuration

### Configuration Location

Add the JIRA MCP server configuration to your Claude configuration file:

- **Claude Desktop App**:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Roaming\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`

- **VSCode Extension**:
  - `~/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

### Configuration Template

A template configuration file has been provided in `jira-mcp-config-template.json`. This template shows all possible configuration options for the JIRA MCP server.

### Basic Configuration

Add the following configuration to your Claude configuration file:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/path/to/project/build/index.js"],
      "env": {
        "JIRA_HOST": "your-site.atlassian.net",
        "JIRA_USERNAME": "your-email@example.com",
        "JIRA_API_TOKEN": "your_api_token",
        "JIRA_PROJECT_KEY": "your_project_key",
        "AUTO_CREATE_TEST_TICKETS": "true",

        "JIRA_ACCEPTANCE_CRITERIA_FIELD": "customfield_10429",
        "JIRA_STORY_POINTS_FIELD": "customfield_10040",
        "JIRA_EPIC_LINK_FIELD": "customfield_10014",

        "JIRA_PRODUCT_FIELD": "customfield_10757",
        "JIRA_PRODUCT_VALUE": "Your Product Name",
        "JIRA_PRODUCT_ID": "12345",

        "JIRA_CATEGORY_FIELD": "customfield_10636",
        "USE_ALTERNATE_CATEGORY": "false",
        "JIRA_DEFAULT_CATEGORY_VALUE": "Default Category",
        "JIRA_DEFAULT_CATEGORY_ID": "12345",
        "JIRA_ALTERNATE_CATEGORY_VALUE": "Alternate Category",
        "JIRA_ALTERNATE_CATEGORY_ID": "67890"
      }
    }
  }
}
```

### Required Configuration

The following environment variables are **required** for the JIRA MCP server to function:

- `JIRA_HOST`: Your JIRA instance domain (e.g., `company.atlassian.net`)
- `JIRA_USERNAME`: Your JIRA username (usually your email address)
- `JIRA_API_TOKEN`: Your JIRA API token (see below for how to get this)
- `JIRA_PROJECT_KEY`: The key for your JIRA project (e.g., `SCRUM`, `DEV`, etc.)

### Optional Configuration

#### Test Ticket Creation

- `AUTO_CREATE_TEST_TICKETS`: Set to "true" (default) to automatically create linked Test tickets for Story tickets with points, or "false" to disable this feature

#### Zephyr Integration

These environment variables are required for the Zephyr integration to add test steps to test tickets:

- `ZAPI_BASE_URL`: The base URL for the Zephyr API (default: "https://prod-api.zephyr4jiracloud.com/connect")
- `ZAPI_ACCESS_KEY`: Your Zephyr Access Key (found in Zephyr Cloud settings under API Keys)
- `ZAPI_SECRET_KEY`: Your Zephyr Secret Key (found in Zephyr Cloud settings under API Keys)
- `ZAPI_JWT_EXPIRE_SEC`: JWT token expiration time in seconds (default: 3600)

#### Custom Field Configuration

The following environment variables allow you to configure custom fields without hardcoding them in the source code:

- `JIRA_ACCEPTANCE_CRITERIA_FIELD`: The field ID for acceptance criteria (default: "customfield_10429")
- `JIRA_STORY_POINTS_FIELD`: The field ID for story points (default: "customfield_10040")
- `JIRA_EPIC_LINK_FIELD`: The field ID for epic links (default: "customfield_10014")

#### Product Field Configuration (Optional)

This is entirely optional. All three variables must be provided together for this feature to work:

- `JIRA_PRODUCT_FIELD`: The field ID for the product field
- `JIRA_PRODUCT_VALUE`: The display value for the product
- `JIRA_PRODUCT_ID`: The ID of the product option

#### Category Field Configuration (Optional)

This is entirely optional. The category field is only used if `JIRA_CATEGORY_FIELD` is specified:

- `JIRA_CATEGORY_FIELD`: The field ID for the category field
- `USE_ALTERNATE_CATEGORY`: Set to "true" to use alternate category, "false" for default
- `JIRA_DEFAULT_CATEGORY_VALUE`: The display value for the default category
- `JIRA_DEFAULT_CATEGORY_ID`: The ID of the default category option
- `JIRA_ALTERNATE_CATEGORY_VALUE`: The display value for the alternate category
- `JIRA_ALTERNATE_CATEGORY_ID`: The ID of the alternate category option

### Minimal Configuration Example

If you want the absolute minimal configuration, you can use:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp/build/index.js"],
      "env": {
        "JIRA_HOST": "your-site.atlassian.net",
        "JIRA_USERNAME": "your-email@example.com",
        "JIRA_API_TOKEN": "your_api_token",
        "JIRA_PROJECT_KEY": "your_project_key"
      }
    }
  }
}
```

### Finding Custom Field IDs

If you need to find the custom field IDs for your JIRA instance:

1. Open a ticket in your JIRA instance
2. Press F12 to open developer tools
3. Go to the Network tab
4. Refresh the page
5. Look for a request to `issue/[ISSUE-KEY]`
6. Examine the response to find the custom field IDs

Alternatively, you can use the JIRA API to get a list of all fields:

```
GET https://your-site.atlassian.net/rest/api/3/field
```

## Available Tools

### create-ticket

Creates a new JIRA ticket.

**Parameters:**

- `summary`: The title/summary of the ticket (required)
- `issue_type`: The type of issue (`Bug`, `Task`, `Story`, or `Test`, defaults to `Task`)
- `description`: Detailed description of the ticket (optional)
- `acceptance_criteria`: Acceptance criteria for the ticket (optional, stored in customfield_10429)
- `story_points`: Story points for the ticket (optional, Fibonacci sequence: 1, 2, 3, 5, 8, 13, etc.)
- `create_test_ticket`: Override the default setting for automatically creating a linked Test ticket (optional, boolean)
- `parent_epic`: Key of the parent epic to link this ticket to (optional, e.g., "PROJ-123")
- `sprint`: The name of the sprint to assign the ticket to (optional, e.g., "2025_C1_S07")
- `story_readiness`: Whether the story is ready for development (optional, "Yes" or "No")

When creating a Story ticket with story points:

- The "QA-Testable" label is automatically added to the Story
- A linked Test ticket is automatically created (if `AUTO_CREATE_TEST_TICKETS` is enabled)
- The Test ticket uses the Story's title as its description
- The Test ticket is linked to the Story with a "Test Case Linking" relationship

**Example:**

```json
{
  "summary": "Implement user authentication feature",
  "issue_type": "Story",
  "description": "As a user, I want to be able to log in to the application",
  "acceptance_criteria": "- Users can log in with email and password\n- Password reset functionality works via email",
  "story_points": 5,
  "parent_epic": "PROJ-100",
  "sprint": "2025_C1_S07",
  "story_readiness": "Yes"
}
```

### get-ticket

Retrieves the details of an existing JIRA ticket.

**Parameters:**

- `ticket_id`: The ID/key of the JIRA ticket you want to read (required, e.g., "PROJ-123")

**Example:**

```json
{
  "ticket_id": "PROJ-123"
}
```

The response includes all fields of the ticket, including custom fields.

### search-tickets

Searches for JIRA tickets by issue type and additional criteria.

**Parameters:**

- `issue_type`: The type of issue to search for (`Bug`, `Task`, `Story`, or `Test`) (required)
- `max_results`: Maximum number of results to return (optional, default: 10, max: 50)
- `additional_criteria`: Additional JQL criteria to include in the search (optional)

**Example:**

```json
{
  "issue_type": "Bug",
  "max_results": 20,
  "additional_criteria": "status = 'Open' AND priority = 'High'"
}
```

This tool allows you to find all tickets of a specific type in your JIRA project. You can further refine your search by providing additional JQL criteria.

### update-ticket

Updates an existing JIRA ticket with new field values.

**Parameters:**

- `ticket_key`: The key of the JIRA ticket to update (required, e.g., "PROJ-123")
- `sprint`: The name of the sprint to assign the ticket to (optional, e.g., "2025_C1_S07")
- `story_readiness`: Whether the story is ready for development (optional, "Yes" or "No")

**Example:**

```json
{
  "ticket_key": "PROJ-123",
  "sprint": "2025_C1_S07",
  "story_readiness": "Yes"
}
```

This tool allows you to update existing tickets with sprint information and story readiness status. At least one field must be provided for the update to proceed.

### link-tickets

Links two JIRA tickets together with a specified relationship type.

**Parameters:**

- `outward_issue`: The key of the outward issue (required, e.g., "PROJ-123")
- `inward_issue`: The key of the inward issue (required, e.g., "PROJ-456")
- `link_type`: The type of link to create (optional, defaults to "Test Case Linking")

**Example:**

```json
{
  "outward_issue": "PROJ-123",
  "inward_issue": "PROJ-456",
  "link_type": "Blocks"
}
```

This creates a link between two tickets with the specified relationship type. For example, "PROJ-123 blocks PROJ-456".

### get-test-steps

Retrieves test steps from a Zephyr test ticket.

**Parameters:**

- `ticket_key`: The key of the test ticket to retrieve steps from (required, e.g., "PROJ-123")

**Example:**

```json
{
  "ticket_key": "PROJ-123"
}
```

This tool retrieves all test steps associated with a test ticket in Zephyr. The response includes the step description, test data, and expected result for each step.

### add-test-steps

Adds test steps to a test ticket via the Zephyr integration.

**Parameters:**

- `ticket_key`: The key of the test ticket to add steps to (required, e.g., "PROJ-123")
- `steps`: An array of test step objects (required), where each step object contains:
  - `step`: The description of the test step (required)
  - `data`: Test data for the step (optional)
  - `result`: Expected result of the step (optional)

**Example:**

```json
{
  "ticket_key": "PROJ-123",
  "steps": [
    {
      "step": "Navigate to the login page",
      "data": "https://example.com/login",
      "result": "Login form is displayed"
    },
    {
      "step": "Enter valid credentials",
      "data": "username=test, password=password123",
      "result": "User is logged in successfully"
    }
  ]
}
```

This tool requires Zephyr for Jira Cloud to be installed and configured. You'll need to set the Zephyr API environment variables in your configuration file.


## Project Architecture

The project follows a modular architecture with clear separation of concerns:

```
jira-mcp/
├── src/                      # Source code
│   ├── index.ts              # Main entry point
│   ├── utils.ts              # Shared utility functions
│   ├── jira/                 # JIRA integration module
│   │   ├── api.ts            # JIRA API interaction functions
│   │   ├── formatting.ts     # JIRA content formatting utilities
│   │   ├── index.ts          # JIRA module exports
│   │   ├── tools.ts          # JIRA MCP tools registration
│   │   └── types.ts          # JIRA type definitions
│   └── zephyr/               # Zephyr integration module
│       ├── auth.ts           # Zephyr authentication utilities
│       ├── index.ts          # Zephyr module exports
│       ├── test-steps.ts     # Zephyr test steps API functions
│       ├── tools.ts          # Zephyr MCP tools registration
│       └── types.ts          # Zephyr type definitions
├── util/                     # Utility scripts
│   └── update-mcp-settings.js # Script to update MCP settings
├── package.json              # Project metadata and dependencies
└── tsconfig.json             # TypeScript configuration
```

## Core Components

### MCP Server

The application creates an MCP server using the `@modelcontextprotocol/sdk` package. This server exposes tools that can be used by AI assistants to interact with JIRA and Zephyr.

```typescript
// src/index.ts
const server = new McpServer({
  name: "jira-mcp",
  version: "1.0.0",
});

// Register tools
registerJiraTools(server);
registerZephyrTools(server);

// Connect using stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### JIRA Integration

The JIRA integration module provides tools for interacting with the JIRA REST API:

1. **create-ticket**: Creates a new JIRA ticket with customizable fields
2. **link-tickets**: Links two JIRA tickets together with a specified relationship
3. **get-ticket**: Retrieves information about a specific JIRA ticket
4. **search-tickets**: Searches for JIRA tickets using JQL (JIRA Query Language)
5. **update-ticket**: Updates an existing JIRA ticket with new information

The module uses Basic Authentication with the JIRA API and formats content according to JIRA's Atlassian Document Format (ADF).

### Zephyr Integration

The Zephyr integration module provides tools for managing test steps in Zephyr:

1. **get-test-steps**: Retrieves test steps for a specific test ticket
2. **add-test-steps**: Adds test steps to a test ticket

The module uses JWT authentication with the Zephyr API, generating signed tokens for each request.


## Authentication

### JIRA Authentication

JIRA authentication uses Basic Auth with a username and API token:

```typescript
const auth = Buffer.from(
  `${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`
).toString("base64");
```

### Zephyr Authentication

Zephyr authentication uses JWT tokens generated with a specific algorithm:

```typescript
// Generate JWT for Zephyr API
const jwtToken = generateZephyrJwt("GET", apiPath, queryParams);
```

The JWT generation includes:
1. Creating a canonical string from the request method, path, and query parameters
2. Generating a SHA-256 hash of this string
3. Creating a JWT with claims including the hash, account ID, and timestamps
4. Signing the JWT with HMAC-SHA256 using the Zephyr Secret Key

## Data Formatting

The project includes utilities for formatting data according to JIRA's requirements:

- **formatDescription**: Formats text for JIRA ticket descriptions
- **formatAcceptanceCriteria**: Formats acceptance criteria with proper bullet points

These utilities create JSON structures that conform to JIRA's Atlassian Document Format (ADF).

## Error Handling

The application includes comprehensive error handling throughout:

- API responses are checked for success status codes
- Error messages are extracted from API responses when available
- Exceptions are caught and logged
- Error information is returned to the client in a consistent format

## Utility Scripts

The project includes utility scripts in the `util` directory that help with configuration and setup tasks.

### update-mcp-settings.js

This script automates the process of updating the Claude VSCode extension's MCP settings with the JIRA MCP configuration.

**Purpose:**
- Reads a merged JIRA MCP configuration file from the util directory
- Updates the Claude VSCode extension's MCP settings file with the JIRA MCP configuration
- Handles and fixes JSON parsing issues that might occur in the settings file
- Streamlines the configuration process for VSCode extension users

**Usage:**
```bash
node util/update-mcp-settings.js
```

**When to use:**
- After making changes to your JIRA MCP configuration
- When setting up the JIRA MCP integration with the Claude VSCode extension
- If you encounter issues with the VSCode extension's MCP settings

The script expects a file named `merged-jira-mcp-config.json` in the util directory, which should contain your complete JIRA MCP configuration. It will then update the VSCode extension's settings file located at `/home/joe/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`.

**Note:** You may need to modify the script to match your specific file paths if they differ from the defaults.

## Usage with Claude

Once configured properly, you can ask Claude to create JIRA tickets directly:

```
Please create a JIRA ticket to track the database performance issue we discussed.
```

You can also specify acceptance criteria for your tickets:

```
Create a JIRA ticket for implementing the new user authentication feature with the following acceptance criteria:
- Users can log in with email and password
- Password reset functionality works via email
- Account lockout occurs after 5 failed attempts
- OAuth integration with Google and Facebook
```

Claude will use the create-ticket tool to generate a ticket in your JIRA project with all the specified details.

## Getting a JIRA API Token

1. Log in to your Atlassian account at https://id.atlassian.com/manage-profile/security
2. Go to Security > API tokens
3. Click "Create API token"
4. Give your token a name (e.g., "Claude Integration")
5. Click "Create"
6. Copy the token (you won't be able to see it again)

## Troubleshooting

If you encounter issues:

1. Check that your JIRA credentials are correct
2. Verify the path to the project's index.js file in your configuration
3. Make sure you've given Claude permission to use tools
4. Check Claude's console logs for any error messages related to the JIRA MCP server
