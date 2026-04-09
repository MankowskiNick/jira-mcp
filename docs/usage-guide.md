# jira-mcp Usage Guide
## 1. Overview
`jira-mcp` is an MCP server that lets Claude-compatible agents work with JIRA and Zephyr Squad Cloud through JSON tool calls.
The 13 tools covered here are:
- JIRA: `create-ticket`, `update-ticket`, `get-ticket`, `search-tickets`, `link-tickets`, `add-comment`, `list-comments`, `transition-ticket`, `assign-ticket`, `add-watcher`, `remove-watcher`
- Zephyr: `get-test-steps`, `add-test-steps`
Use this call shape:
```json
{"tool":"tool-name","arguments":{"param":"value"}}
```
## 2. Tool Reference
### `create-ticket`
Create a JIRA ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `summary` | string | Yes | Ticket title |
| `issue_type` | enum | No | `Bug`, `Task`, `Story`, `Test`, `Epic`; default `Task` |
| `description` | string | No | Stored as ADF |
| `acceptance_criteria` | string | No | Stored in the acceptance-criteria custom field as ADF |
| `story_points` | number | No | Used for Stories; adds `QA-Testable` label |
| `create_test_ticket` | boolean | No | Overrides `AUTO_CREATE_TEST_TICKETS` |
| `parent_epic` | string | No | Epic key |
| `sprint` | string | No | Numeric sprint ID (as string) |
| `story_readiness` | enum | No | `Yes` or `No` |
| `project_key` | string | No | Overrides `JIRA_PROJECT_KEY` env var |
| `assignee` | string | No | Atlassian account ID |
| `labels` | string[] | No | Merged with auto-generated labels |
| `components` | string[] | No | Component names |
| `priority` | enum | No | `Highest`, `High`, `Medium`, `Low`, `Lowest` |
| `due_date` | string | No | `YYYY-MM-DD` |
| `crisis` | enum | No | `Yes` or `No`; auto-defaults to `No` for non-Test |
| `initiative_type` | string | No | Initiative type value; auto-defaults from env for non-Test |
| `product_name` | string | No | Product name value; auto-defaults from env for non-Test |
```json
{"tool":"create-ticket","arguments":{"summary":"Implement SSO","issue_type":"Story","description":"Add SAML login","story_points":5,"parent_epic":"PROJ-100","story_readiness":"Yes"}}
```
### `update-ticket`
Update an existing JIRA ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key, for example `PROJ-123` |
| `summary` | string | No | New summary |
| `description` | string | No | Stored as ADF |
| `acceptance_criteria` | string | No | Stored as ADF in the configured field |
| `story_points` | number | No | Updates the configured story-points field |
| `sprint` | string | No | Sprint name |
| `story_readiness` | enum | No | `Yes` or `No` |
| `crisis` | enum | No | `Yes` or `No` |
| `initiative_type` | string | No | Initiative type value |
| `product_name` | string | No | Product name value |
| `assignee` | string | No | Account ID, or `unassigned` |
| `priority` | enum | No | `Highest`, `High`, `Medium`, `Low`, `Lowest` |
| `labels` | string[] | No | Replaces existing labels |
| `components` | string[] | No | Component names |
| `fix_versions` | string[] | No | Fix version names |
| `due_date` | string | No | `YYYY-MM-DD` |
```json
{"tool":"update-ticket","arguments":{"ticket_key":"PROJ-123","priority":"High","labels":["auth","security"],"due_date":"2026-04-30"}}
```
### `get-ticket`
Get JIRA ticket details by key or ID.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_id` | string | Yes | Accepts a JIRA issue key or ID |
```json
{"tool":"get-ticket","arguments":{"ticket_id":"PROJ-123"}}
```
### `search-tickets`
Search tickets by issue type plus optional JQL criteria.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `issue_type` | enum | Yes | `Bug`, `Task`, `Story`, `Test`, `Epic` |
| `max_results` | number | No | Default `10`, max `50` |
| `additional_criteria` | string | No | Extra JQL appended with `AND (...)` |
```json
{"tool":"search-tickets","arguments":{"issue_type":"Bug","max_results":20,"additional_criteria":"status = \"Open\" AND priority = \"High\""}}
```
### `link-tickets`
Create a JIRA issue link.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `outward_issue` | string | Yes | Source issue key |
| `inward_issue` | string | Yes | Target issue key |
| `link_type` | string | No | Defaults to `Test Case Linking` |
```json
{"tool":"link-tickets","arguments":{"outward_issue":"PROJ-123","inward_issue":"PROJ-456","link_type":"Blocks"}}
```
### `add-comment`
Add a comment to a JIRA ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key |
| `comment` | string | Yes | Stored as ADF |
```json
{"tool":"add-comment","arguments":{"ticket_key":"PROJ-123","comment":"Starting implementation today."}}
```
### `list-comments`
List comments on a JIRA ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key |
| `max_results` | number | No | Default `20`, max `100` |
```json
{"tool":"list-comments","arguments":{"ticket_key":"PROJ-123","max_results":10}}
```
### `transition-ticket`
List transitions or move a ticket to a new status.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key |
| `transition_name` | string | No | Status transition name |
| `transition_id` | string | No | Use when names are ambiguous |
| `list_transitions` | boolean | No | Return available transitions instead of changing status |
| `comment` | string | No | Added during transition |
```json
{"tool":"transition-ticket","arguments":{"ticket_key":"PROJ-123","transition_name":"In Progress","comment":"Starting work now"}}
```
### `assign-ticket`
Assign or unassign a JIRA ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key |
| `account_id` | string | No | Omit to unassign |
```json
{"tool":"assign-ticket","arguments":{"ticket_key":"PROJ-123","account_id":"712020:abcd1234"}}
```
### `add-watcher`
Add a watcher to a ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key |
| `account_id` | string | Yes | Atlassian account ID |
```json
{"tool":"add-watcher","arguments":{"ticket_key":"PROJ-123","account_id":"712020:abcd1234"}}
```
### `remove-watcher`
Remove a watcher from a ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | Ticket key |
| `account_id` | string | Yes | Atlassian account ID |
```json
{"tool":"remove-watcher","arguments":{"ticket_key":"PROJ-123","account_id":"712020:abcd1234"}}
```
### `get-test-steps`
Get Zephyr test steps for a test ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | JIRA test ticket key |
```json
{"tool":"get-test-steps","arguments":{"ticket_key":"PROJ-456"}}
```
### `add-test-steps`
Add Zephyr test steps to a test ticket.
| Parameter | Type | Req | Notes |
| --- | --- | --- | --- |
| `ticket_key` | string | Yes | JIRA test ticket key |
| `steps` | object[] | Yes | Each step needs `step`; `data` and `result` are optional |
```json
{"tool":"add-test-steps","arguments":{"ticket_key":"PROJ-456","steps":[{"step":"Open login page","result":"Login form is visible"},{"step":"Submit valid credentials","result":"Dashboard loads"}]}}
```
## 3. Custom Fields Quick Reference
These defaults reflect the post-custom-field-update conventions described in the handoff.
| Friendly Name | Custom Field ID | Type | Env Var | Default IDs | Notes |
| --- | --- | --- | --- | --- | --- |
| Story Points | `customfield_10040` | Number | `JIRA_STORY_POINTS_FIELD` | N/A | Stories only |
| Acceptance Criteria | `customfield_10429` | ADF text | `JIRA_ACCEPTANCE_CRITERIA_FIELD` | N/A | Formatted as ADF |
| Story Readiness | `customfield_10635` | Select (single) | `JIRA_STORY_READINESS_FIELD` | Yes=`18381`, No=`18382` | Also use `JIRA_STORY_READINESS_YES_ID`, `JIRA_STORY_READINESS_NO_ID` |
| Crisis | `customfield_14238` | Select (single) | `JIRA_CRISIS_FIELD` | Yes=`23123`, No=`23124` | Defaults to `No` for non-Test issues |
| Initiative Type | `customfield_10636` | Select (single) | `JIRA_INITIATIVE_TYPE_FIELD` | Default=`23784` (`CNR`) | Also use `JIRA_INITIATIVE_TYPE_ID`, `JIRA_INITIATIVE_TYPE_VALUE` |
| Product Name | env configured | Select (array) | `JIRA_PRODUCT_FIELD` | env configured | Uses `JIRA_PRODUCT_VALUE` and `JIRA_PRODUCT_ID` |
| Epic Link | `customfield_10014` | String | `JIRA_EPIC_LINK_FIELD` | N/A | Epic key |
| Sprint | `customfield_10020` | Number | hardcoded | N/A | Sprint ID as integer |
## 4. Auto-populated Fields
On ticket creation, the server can populate these fields automatically:
- Crisis: defaults to `No` for non-Test issue types unless explicitly set to `Yes`
- Product Name: falls back to `JIRA_PRODUCT_VALUE` and `JIRA_PRODUCT_ID` when omitted on non-Test tickets
- Initiative Type: falls back to `JIRA_INITIATIVE_TYPE_VALUE` and `JIRA_INITIATIVE_TYPE_ID` when omitted on non-Test tickets
- Category: set from `JIRA_CATEGORY_FIELD`, `JIRA_DEFAULT_CATEGORY_ID`, and `JIRA_DEFAULT_CATEGORY_VALUE` for non-Test tickets
- `QA-Testable` label: added automatically to Stories with story points
- Auto test ticket: creating a Story with story points also creates a linked Test ticket unless `AUTO_CREATE_TEST_TICKETS=false`
## 5. Environment Variables
| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `JIRA_HOST` | JIRA instance hostname | — | Yes |
| `JIRA_USERNAME` | API username | — | Yes |
| `JIRA_API_TOKEN` | API token | — | Yes |
| `JIRA_PROJECT_KEY` | Default project key | `SCRUM` | No |
| `JIRA_STORY_POINTS_FIELD` | Story points field ID | `customfield_10040` | No |
| `JIRA_ACCEPTANCE_CRITERIA_FIELD` | Acceptance criteria field ID | `customfield_10429` | No |
| `JIRA_STORY_READINESS_FIELD` | Story readiness field ID | `customfield_10635` | No |
| `JIRA_STORY_READINESS_YES_ID` | Story readiness `Yes` option ID | `18381` | No |
| `JIRA_STORY_READINESS_NO_ID` | Story readiness `No` option ID | `18382` | No |
| `JIRA_CRISIS_FIELD` | Crisis field ID | `customfield_14238` | No |
| `JIRA_CRISIS_YES_ID` | Crisis `Yes` option ID | `23123` | No |
| `JIRA_CRISIS_NO_ID` | Crisis `No` option ID | `23124` | No |
| `JIRA_INITIATIVE_TYPE_FIELD` | Initiative type field ID | `customfield_10636` | No |
| `JIRA_INITIATIVE_TYPE_ID` | Initiative type default option ID | `23784` | No |
| `JIRA_INITIATIVE_TYPE_VALUE` | Initiative type default value | `CNR` | No |
| `JIRA_EPIC_LINK_FIELD` | Epic link field ID | `customfield_10014` | No |
| `JIRA_PRODUCT_FIELD` | Product name field ID | — | No |
| `JIRA_PRODUCT_VALUE` | Product name default value | — | No |
| `JIRA_PRODUCT_ID` | Product name default option ID | — | No |
| `JIRA_CATEGORY_FIELD` | Category field ID | — | No |
| `JIRA_DEFAULT_CATEGORY_ID` | Default category option ID | — | No |
| `JIRA_DEFAULT_CATEGORY_VALUE` | Default category value | — | No |
| `JIRA_ALTERNATE_CATEGORY_ID` | Alternate category option ID | — | No |
| `JIRA_ALTERNATE_CATEGORY_VALUE` | Alternate category value | — | No |
| `USE_ALTERNATE_CATEGORY` | Use alternate category | `false` | No |
| `AUTO_CREATE_TEST_TICKETS` | Auto-create test tickets for Stories | `true` | No |
| `ZAPI_BASE_URL` | Zephyr API base URL | `https://prod-api.zephyr4jiracloud.com/connect` | No |
| `ZAPI_ACCESS_KEY` | Zephyr access key | — | For Zephyr tools |
| `ZAPI_SECRET_KEY` | Zephyr secret key | — | For Zephyr tools |
## 6. Common Patterns
The examples below reflect the custom-field build described in the handoff. If your deployment is older, prefer the core parameter tables above.
**Creating a Story with all required fields**
```json
{
  "tool": "create-ticket",
  "arguments": {
    "summary": "Implement user authentication",
    "issue_type": "Story",
    "description": "As a user, I want to log in securely",
    "acceptance_criteria": "- Login form validates email format\n- Password must be 8+ characters\n- Failed login shows error message",
    "story_points": 5,
    "parent_epic": "PROJ-100",
    "story_readiness": "Yes",
    "priority": "High",
    "labels": ["auth", "security"]
  }
}
```
**Creating a Bug**
```json
{
  "tool": "create-ticket",
  "arguments": {
    "summary": "Login button unresponsive on mobile",
    "issue_type": "Bug",
    "description": "Steps to reproduce:\n1. Open app on mobile\n2. Tap login button\n3. Nothing happens",
    "priority": "Highest",
    "crisis": "No"
  }
}
```
**Updating story readiness and crisis**
```json
{
  "tool": "update-ticket",
  "arguments": {
    "ticket_key": "PROJ-123",
    "story_readiness": "Yes",
    "crisis": "No"
  }
}
```
**Transitioning a ticket**
```json
{
  "tool": "transition-ticket",
  "arguments": {
    "ticket_key": "PROJ-123",
    "transition_name": "In Progress",
    "comment": "Starting work on this story"
  }
}
```
**Listing available transitions first**
```json
{
  "tool": "transition-ticket",
  "arguments": {
    "ticket_key": "PROJ-123",
    "list_transitions": true
  }
}
```
**Adding test steps to a test ticket**
```json
{
  "tool": "add-test-steps",
  "arguments": {
    "ticket_key": "PROJ-456",
    "steps": [
      {"step": "Navigate to login page", "data": "https://app.example.com/login", "result": "Login form is displayed"},
      {"step": "Enter valid credentials", "data": "user@example.com / validPass123", "result": "Credentials accepted"},
      {"step": "Click Submit", "result": "User is redirected to dashboard"}
    ]
  }
}
```
