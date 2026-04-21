# Zephyr Squad Cloud API Integration Guide

## The Problem: Wrong API

If you're getting 404 errors with endpoints like:
- `/rest/zapi/latest/cycle`
- `/rest/zapi/latest/zql/executeSearch`
- `/rest/zapi/latest/execution`

**You're using the wrong API.** These are **Zephyr Server/Data Center** endpoints, which don't exist on Jira Cloud.

## Zephyr Squad Cloud vs Server/Data Center

| Feature | Server/Data Center | Cloud |
|---------|-------------------|-------|
| Base URL | `https://{jira-host}/rest/zapi/latest/` | `https://prod-api.zephyr4jiracloud.com/connect/` |
| Authentication | Basic Auth (Jira credentials) | **JWT with Zephyr API Keys** |
| API Path | `/rest/zapi/latest/...` | `/public/rest/api/1.0/...` |
| Works with Jira Cloud | No | **Yes** |

## Requirements for Zephyr Squad Cloud API

### 1. Get Zephyr API Credentials

You need **separate API credentials** from Zephyr (not your Jira credentials):

1. Go to Jira → Apps → Zephyr Squad
2. Click the gear icon (⚙️) → API Keys
3. Generate a new API key pair:
   - **Access Key** (ZAPI_ACCESS_KEY)
   - **Secret Key** (ZAPI_SECRET_KEY)

### 2. Get Your Atlassian Account ID

Your Atlassian Account ID is required for JWT generation:

```bash
# Get your account ID via Jira API
curl -u your-email@example.com:YOUR_JIRA_API_TOKEN \
  "https://3eco.atlassian.net/rest/api/3/myself" | jq '.accountId'
```

### 3. Environment Variables

```bash
# Required for Zephyr Squad Cloud
ZAPI_BASE_URL="https://prod-api.zephyr4jiracloud.com/connect"
ZAPI_ACCESS_KEY="your_zephyr_access_key"    # From Zephyr API Keys
ZAPI_SECRET_KEY="your_zephyr_secret_key"    # From Zephyr API Keys
ZAPI_ACCOUNT_ID="your_atlassian_account_id" # From /rest/api/3/myself
```

## Authentication: JWT Token Generation

Zephyr Squad Cloud uses **JWT authentication** with a Query String Hash (QSH). Here's how it works:

### Step-by-Step JWT Generation

```javascript
import crypto from "crypto";
import jwt from "jsonwebtoken";

function generateZephyrJwt(method, apiPath, queryParams = {}) {
  // 1. Sort query parameters alphabetically
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map(key => `${key}=${queryParams[key]}`)
    .join("&");

  // 2. Build canonical string: METHOD&path&query
  const canonical = `${method.toUpperCase()}&${apiPath}&${canonicalQuery}`;

  // 3. Create SHA-256 hash of canonical string
  const qsh = crypto
    .createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");

  // 4. Build JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: process.env.ZAPI_ACCESS_KEY,  // Issuer = Access Key
    qsh: qsh,                           // Query String Hash
    iat: now,                           // Issued at
    exp: now + 3600,                    // Expires in 1 hour
  };

  // 5. Sign with HMAC-SHA256 using Secret Key
  return jwt.sign(payload, process.env.ZAPI_SECRET_KEY, {
    algorithm: "HS256",
  });
}
```

## API Endpoints

### Base URL
```
https://prod-api.zephyr4jiracloud.com/connect
```

### Test Steps

#### GET Test Steps
```
GET /public/rest/api/1.0/teststep/{issueId}?projectId={projectId}
```

#### POST Test Step
```
POST /public/rest/api/1.0/teststep/{issueId}?projectId={projectId}

Body:
{
  "projectId": "10001",
  "step": "Navigate to login page",
  "data": "https://example.com/login",
  "result": "Login page is displayed"
}
```

### Test Cycles

#### GET All Cycles
```
GET /public/rest/api/1.0/cycles/search?projectId={projectId}&versionId={versionId}
```

#### GET Cycle by ID
```
GET /public/rest/api/1.0/cycle/{cycleId}?projectId={projectId}
```

### Test Executions

#### GET Executions by Cycle
```
GET /public/rest/api/1.0/executions/search/cycle/{cycleId}?projectId={projectId}&versionId={versionId}
```

#### Create Execution
```
POST /public/rest/api/1.0/execution?projectId={projectId}

Body:
{
  "cycleId": "123",
  "issueId": "10001",
  "projectId": "10001",
  "versionId": "-1"
}
```

### ZQL Search (Zephyr Query Language)

```
GET /public/rest/api/1.0/zql/executeSearch?zqlQuery={encodedQuery}&projectId={projectId}
```

Example ZQL queries:
- `project = "TECH27" AND cycleName = "Regression"`
- `executionStatus = "PASS" AND cycleId = 123`

## Complete Example: Get Test Steps

```javascript
import fetch from "node-fetch";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const ZAPI_BASE_URL = "https://prod-api.zephyr4jiracloud.com/connect";
const ZAPI_ACCESS_KEY = process.env.ZAPI_ACCESS_KEY;
const ZAPI_SECRET_KEY = process.env.ZAPI_SECRET_KEY;

function generateZephyrJwt(method, apiPath, queryParams = {}) {
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map(key => `${key}=${queryParams[key]}`)
    .join("&");

  const canonical = `${method.toUpperCase()}&${apiPath}&${canonicalQuery}`;

  const qsh = crypto
    .createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");

  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    { iss: ZAPI_ACCESS_KEY, qsh, iat: now, exp: now + 3600 },
    ZAPI_SECRET_KEY,
    { algorithm: "HS256" }
  );
}

async function getTestSteps(issueId, projectId) {
  const apiPath = `/public/rest/api/1.0/teststep/${issueId}`;
  const queryParams = { projectId };

  const jwtToken = generateZephyrJwt("GET", apiPath, queryParams);

  const url = `${ZAPI_BASE_URL}${apiPath}?projectId=${projectId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "zapiAccessKey": ZAPI_ACCESS_KEY,
      "Authorization": `JWT ${jwtToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Usage: You need the Jira ISSUE ID (numeric), not the ticket key
// First get the issue ID from Jira:
// GET https://3eco.atlassian.net/rest/api/3/issue/TECH27-123
// Then use issue.id from the response

const issueId = "12345";    // Numeric issue ID from Jira
const projectId = "10001";  // Numeric project ID from Jira

getTestSteps(issueId, projectId)
  .then(steps => console.log("Test Steps:", steps))
  .catch(err => console.error("Error:", err));
```

## Getting Issue ID and Project ID

The Zephyr API requires **numeric IDs**, not ticket keys. Here's how to get them:

```javascript
// Get issue details including numeric ID
async function getIssueId(ticketKey) {
  const response = await fetch(
    `https://3eco.atlassian.net/rest/api/3/issue/${ticketKey}`,
    {
      headers: {
        "Authorization": `Basic ${Buffer.from(
          `${JIRA_USERNAME}:${JIRA_API_TOKEN}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
    }
  );

  const issue = await response.json();
  return {
    issueId: issue.id,           // Numeric ID for Zephyr
    projectId: issue.fields.project.id,  // Numeric project ID
  };
}

// Example
const { issueId, projectId } = await getIssueId("TECH27-123");
```

## Common Errors and Solutions

### 404 "Plugin is not installed"
**Cause**: Using Server/DC endpoints (`/rest/zapi/latest/...`)
**Solution**: Use Cloud endpoints (`/public/rest/api/1.0/...`)

### 401 Unauthorized
**Cause**: Invalid JWT or missing Zephyr API keys
**Solution**:
1. Verify ZAPI_ACCESS_KEY and ZAPI_SECRET_KEY are correct
2. Ensure JWT is freshly generated (they expire)
3. Check the QSH hash includes the correct path and query params

### 403 Forbidden
**Cause**: User doesn't have Zephyr permissions
**Solution**: Contact Jira admin to grant Zephyr Squad permissions

### Invalid QSH
**Cause**: The query string hash doesn't match the actual request
**Solution**:
- Ensure the canonical string uses the exact API path and sorted query params
- Method must be uppercase (GET, POST)
- Query params must be sorted alphabetically

## Reference Implementation

See the implementation in this repository:
- `src/zephyr/auth.ts` - JWT generation
- `src/zephyr/test-steps.ts` - API calls for test steps
- `src/zephyr/tools.ts` - MCP tool definitions

## Additional Resources

- [Zephyr Squad Cloud API Documentation](https://support.smartbear.com/zephyr-squad-cloud/api-docs/)
- [JWT Authentication for Zephyr](https://support.smartbear.com/zephyr-squad-cloud/docs/api/jwt-authentication.html)
