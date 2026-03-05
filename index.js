/**
 * CARDVAULT GIFT CARD BUYER BOT
 * @version 3.0.0 - MySQL Edition
 */

require('dotenv').config();

// Core
const { client } = require('./core/client');
const { registerCommands } = require('./core/commands');

// Managers
const { DatabaseManager } = require('./managers/databaseManager');
const { sessionManager } = require('./managers/sessionManager');

// Handlers
const { handleInteraction } = require('./handlers/interactionHandler');
const { handleMessage } = require('./handlers/messageHandler');

// Events
const { handleReady } = require('./events/ready');
const { handleGuildMemberAdd } = require('./events/guildMemberAdd');

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

// Initialize database and start bot
async function startBot() {
    try {
        console.log('[BOT] Starting up...');
        
        // Initialize MySQL database
        console.log('[DATABASE] Connecting to TiDB Cloud...');
        const db = new DatabaseManager();
        await db.initialize();
        
        // Attach managers to client for global access
        client.db = db;
        client.sessions = sessionManager;
        
        // Register commands
        registerCommands();
        
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
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('[BOT] Received SIGTERM, shutting down gracefully...');
            if (client.db) await client.db.close();
            client.destroy();
            process.exit(0);
        });
        
        process.on('SIGINT', async () => {
            console.log('[BOT] Received SIGINT, shutting down gracefully...');
            if (client.db) await client.db.close();
            client.destroy();
            process.exit(0);
        });
        
        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
        console.log('[BOT] Login successful');
        
    } catch (error) {
        console.error('[BOT] Failed to start:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();
