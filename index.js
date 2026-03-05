/**
 * CARDVAULT GIFT CARD BUYER BOT
 * @version 3.0.0
 */

require('dotenv').config();

// Core
const { client } = require('./src/core/client');
const { registerCommands } = require('./src/core/commands');

// Managers
const { db } = require('./src/managers/databaseManager');
const { sessionManager } = require('./src/managers/sessionManager');

// Handlers
const { handleInteraction } = require('./src/handlers/interactionHandler');
const { handleMessage } = require('./src/handlers/messageHandler');

// Events
const { handleReady } = require('./src/events/ready');
const { handleGuildMemberAdd } = require('./src/events/guildMemberAdd');

// Express server
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        bot: 'CardVault',
        version: '3.0.0',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`[SERVER] Web server running on port ${PORT}`);
});

// Register commands
registerCommands();

// Attach managers to client for global access
client.db = db;
client.sessions = sessionManager;

// Event handlers
client.once('ready', handleReady);
client.on('guildMemberAdd', handleGuildMemberAdd);
client.on('interactionCreate', handleInteraction);
client.on('messageCreate', handleMessage);

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('[FATAL] Unhandled rejection:', error);
});

client.on('error', (error) => {
    console.error('[CLIENT ERROR]', error);
});

// Login
client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('[BOT] Login failed:', error.message);
    process.exit(1);
});
