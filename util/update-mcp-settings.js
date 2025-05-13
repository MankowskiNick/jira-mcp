import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const mergedConfigPath = path.join(__dirname, 'merged-jira-mcp-config.json');
const settingsPath = '/home/joe/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json';

try {
    // Read the merged config file
    const mergedConfig = JSON.parse(fs.readFileSync(mergedConfigPath, 'utf8'));
    const jiraMcpConfig = mergedConfig.mcpServers['github.com/MankowskiNick/jira-mcp'];

    // Read the current settings file
    let settingsContent = fs.readFileSync(settingsPath, 'utf8');

    // The settings file seems to be missing the opening curly brace, let's fix that
    if (!settingsContent.trim().startsWith('{')) {
        settingsContent = '{' + settingsContent;
    }

    // Add missing commas between properties
    settingsContent = settingsContent.replace(/"\s*"(?!,)/g, '", "');
    settingsContent = settingsContent.replace(/}\s*"/g, '}, "');
    settingsContent = settingsContent.replace(/]\s*"/g, '], "');

    // Parse the settings
    let settings;
    try {
        settings = JSON.parse(settingsContent);
    } catch (e) {
        console.error('Error parsing settings file:', e.message);
        console.error('Attempting to fix JSON format issues...');

        // More aggressive fixing
        settingsContent = settingsContent.replace(/([{,])\s*"([^"]+)":\s*"([^"]+)"\s*(?=[},])/g, '$1"$2":"$3",');
        settingsContent = settingsContent.replace(/,\s*}/g, '}');

        try {
            settings = JSON.parse(settingsContent);
        } catch (e) {
            console.error('Still unable to parse settings file after fixes.');
            process.exit(1);
        }
    }

    // Update the jira-mcp configuration
    if (!settings.mcpServers) {
        settings.mcpServers = {};
    }
    settings.mcpServers['github.com/MankowskiNick/jira-mcp'] = jiraMcpConfig;

    // Write the updated settings back to the file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

    console.log('Successfully updated MCP settings for jira-mcp.');
} catch (error) {
    console.error('Error updating MCP settings:', error.message);
    process.exit(1);
}
