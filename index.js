/**
 * CARDVAULT GIFT CARD BUYER BOT
 * @version 3.0.0 - MySQL Edition
 */

require('dotenv').config();

// ========== DIAGNOSTIC - Show current directory structure ==========
const fs = require('fs');
console.log('=== CURRENT DIRECTORY CONTENTS ===');
console.log('Files in current directory:');
try {
    const files = fs.readdirSync('.');
    console.log(files);
    
    console.log('\nChecking if ./src exists:');
    if (fs.existsSync('./src')) {
        console.log('./src EXISTS - contents:');
        console.log(fs.readdirSync('./src'));
    } else {
        console.log('./src DOES NOT EXIST');
    }
    
    console.log('\nChecking if ./src/src exists:');
    if (fs.existsSync('./src/src')) {
        console.log('./src/src EXISTS - contents:');
        console.log(fs.readdirSync('./src/src'));
    } else {
        console.log('./src/src DOES NOT EXIST');
    }
    
    console.log('\nChecking current working directory:');
    console.log(process.cwd());
} catch (err) {
    console.log('Error reading directory:', err.message);
}
console.log('================================\n');
// ========== END DIAGNOSTIC ==========

// Core
const { client } = require('./src/core/client');
const { registerCommands } = require('./src/core/commands');

// Managers
const { DatabaseManager } = require('./src/managers/databaseManager');
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
