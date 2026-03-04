/**
 * CARDVAULT GIFT CARD BUYER BOT
 * A professional Discord bot for buying and selling gift cards
 * 
 * @version 3.0.0 - SLASH COMMANDS EDITION
 * @features: Slash Commands Only, Buttons, Select Menus, Activity Logging
 * @author YourName
 * @license MIT
 */

// ============================================
// DEPENDENCIES
// ============================================
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    Collection,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType
} = require('discord.js');
const Database = require('better-sqlite3');
const express = require('express');
const fs = require('fs');

// ============================================
// CONFIGURATION & INITIALIZATION
// ============================================

// Express server for Render (keeps bot alive)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        bot: 'CardVault',
        version: '3.0.0',
        features: ['slash-commands', 'buttons', 'logging'],
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`[SERVER] Web server running on port ${PORT}`);
});

// Environment variables
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID, // For testing - remove for global commands
    ADMIN_ID: process.env.ADMIN_ID,
    SUPPORT_ID: process.env.SUPPORT_ID || '1478007761697509531',
    LOG_CHANNEL: 'cardvault-logs'
};

// Validate required config
if (!CONFIG.TOKEN) {
    console.error('[ERROR] DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
}
if (!CONFIG.CLIENT_ID) {
    console.error('[ERROR] CLIENT_ID is not set in environment variables');
    process.exit(1);
}

// Discord client with all required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions
    ]
});

// Cooldowns map for rate limiting
const cooldowns = new Map();

// ============================================
// DATABASE MANAGER
// ============================================

class DatabaseManager {
    constructor(dbPath = 'cardvault.db') {
        this.db = new Database(dbPath);
        this.initialize();
        console.log('[DATABASE] Connected successfully');
    }

    initialize() {
        // Create users table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                userId TEXT PRIMARY KEY,
                registered INTEGER DEFAULT 0,
                registeredAt INTEGER,
                paypal TEXT,
                btc TEXT,
                bankName TEXT,
                bankNumber TEXT,
                bankAccount TEXT,
                totalSold INTEGER DEFAULT 0,
                totalEarned INTEGER DEFAULT 0,
                lastSeen INTEGER,
                warningCount INTEGER DEFAULT 0,
                isBanned INTEGER DEFAULT 0
            )
        `);

        // Create transactions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                txId TEXT PRIMARY KEY,
                userId TEXT,
                username TEXT,
                paymentMethod TEXT,
                paymentDetail TEXT,
                brand TEXT,
                value INTEGER,
                image TEXT,
                status TEXT DEFAULT 'pending',
                submittedAt INTEGER,
                approvedAt INTEGER,
                paidAt INTEGER,
                adminNotes TEXT,
                FOREIGN KEY(userId) REFERENCES users(userId)
            )
        `);

        // Create logs table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT,
                userId TEXT,
                details TEXT,
                timestamp INTEGER
            )
        `);

        // Create card brands table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS card_brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE
            )
        `);

        // Insert default brands
        const brands = ['Amazon', 'Google Play', 'Steam', 'Xbox', 'PlayStation', 'Netflix', 'Spotify', 'iTunes', 'Visa', 'Mastercard', 'Razer Gold', 'Nintendo eShop'];
        const insertBrand = this.db.prepare('INSERT OR IGNORE INTO card_brands (name) VALUES (?)');
        brands.forEach(brand => insertBrand.run(brand));
    }

    // ===== USER METHODS =====
    
    getUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE userId = ?');
        return stmt.get(userId);
    }

    createUser(userId) {
        const existing = this.getUser(userId);
        if (existing) return existing;

        const stmt = this.db.prepare(`
            INSERT INTO users (userId, registered, registeredAt, lastSeen)
            VALUES (?, 1, ?, ?)
        `);
        
        const now = Date.now();
        stmt.run(userId, now, now);
        
        this.log('register', userId, 'User registered');
        return this.getUser(userId);
    }

    updateUser(userId, data) {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        
        const stmt = this.db.prepare(`UPDATE users SET ${fields} WHERE userId = ?`);
        stmt.run(...values, userId);
        
        this.log('update', userId, `Updated fields: ${Object.keys(data).join(', ')}`);
    }

    setPaymentMethod(userId, method, value) {
        const updates = {};
        
        switch(method) {
            case 'paypal':
                updates.paypal = value;
                break;
            case 'btc':
                updates.btc = value;
                break;
            case 'bank':
                const [name, number, bank] = value.split('|');
                updates.bankName = name.trim();
                updates.bankNumber = number.trim();
                updates.bankAccount = bank.trim();
                break;
        }
        
        this.updateUser(userId, updates);
        this.log('payment_set', userId, `Set ${method} payment method`);
    }

    // ===== TRANSACTION METHODS =====
    
    createTransaction(data) {
        const txId = 'CV-' + Date.now().toString(36).toUpperCase() + 
                     Math.random().toString(36).substring(2, 5).toUpperCase();
        
        const stmt = this.db.prepare(`
            INSERT INTO transactions (
                txId, userId, username, paymentMethod, paymentDetail,
                brand, value, image, status, submittedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            txId,
            data.userId,
            data.username,
            data.paymentMethod,
            data.paymentDetail,
            data.brand,
            data.value,
            data.image,
            'pending',
            Date.now()
        );
        
        this.log('transaction_created', data.userId, `Created transaction ${txId}`);
        return txId;
    }

    getTransaction(txId) {
        const stmt = this.db.prepare('SELECT * FROM transactions WHERE txId = ?');
        return stmt.get(txId);
    }

    updateTransactionStatus(txId, status, adminNotes = '') {
        const updates = { status };
        
        if (status === 'approved') updates.approvedAt = Date.now();
        if (status === 'paid') updates.paidAt = Date.now();
        if (adminNotes) updates.adminNotes = adminNotes;
        
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        
        const stmt = this.db.prepare(`UPDATE transactions SET ${fields} WHERE txId = ?`);
        stmt.run(...values, txId);
        
        const tx = this.getTransaction(txId);
        this.log('status_update', tx.userId, `Transaction ${txId} status: ${status}`);
    }

    getPendingTransactions() {
        const stmt = this.db.prepare(`
            SELECT * FROM transactions 
            WHERE status = 'pending' 
            ORDER BY submittedAt DESC
        `);
        return stmt.all();
    }

    getUserTransactions(userId) {
        const stmt = this.db.prepare(`
            SELECT * FROM transactions 
            WHERE userId = ? 
            ORDER BY submittedAt DESC
            LIMIT 10
        `);
        return stmt.all(userId);
    }

    // ===== BRAND METHODS =====
    
    getCardBrands() {
        const stmt = this.db.prepare('SELECT name FROM card_brands ORDER BY name');
        return stmt.all().map(b => b.name);
    }

    // ===== STATS METHODS =====
    
    incrementUserStats(userId, value) {
        const user = this.getUser(userId);
        if (user) {
            const totalSold = (user.totalSold || 0) + 1;
            const totalEarned = (user.totalEarned || 0) + value;
            this.updateUser(userId, { totalSold, totalEarned });
        }
    }

    getTopSellers(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM users 
            WHERE totalSold > 0 
            ORDER BY totalSold DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // ===== LOGGING =====
    
    log(action, userId, details) {
        console.log(`[LOG] ${new Date().toLocaleTimeString()} | ${action} | ${userId} | ${details}`);
        
        // Also save to database
        const stmt = this.db.prepare(`
            INSERT INTO logs (action, userId, details, timestamp)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(action, userId, details, Date.now());
    }

    getRecentLogs(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT * FROM logs 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

// Initialize database
const db = new DatabaseManager();

// ============================================
// SESSION MANAGER
// ============================================

class SessionManager {
    constructor() {
        this.sessions = new Collection();
        this.timeout = 30 * 60 * 1000; // 30 minutes
    }

    create(userId) {
        const session = {
            userId,
            step: 1,
            data: {},
            createdAt: Date.now()
        };
        
        this.sessions.set(userId, session);
        return session;
    }

    get(userId) {
        const session = this.sessions.get(userId);
        
        // Check if session expired
        if (session && (Date.now() - session.createdAt) > this.timeout) {
            this.sessions.delete(userId);
            return null;
        }
        
        return session;
    }

    update(userId, updates) {
        const session = this.get(userId);
        if (session) {
            Object.assign(session, updates);
            this.sessions.set(userId, session);
        }
        return session;
    }

    delete(userId) {
        return this.sessions.delete(userId);
    }

    nextStep(userId) {
        const session = this.get(userId);
        if (session) {
            session.step++;
            this.sessions.set(userId, session);
        }
        return session;
    }
}

// Initialize session manager
const sessions = new SessionManager();

// ============================================
// EMBED BUILDER HELPER
// ============================================

class EmbedHelper {
    static success(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`✅ ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        fields.forEach(field => embed.addFields(field));
        return embed;
    }

    static error(title, description) {
        return new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setTimestamp();
    }

    static info(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        fields.forEach(field => embed.addFields(field));
        return embed;
    }

    static warning(title, description) {
        return new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(`⚠️ ${title}`)
            .setDescription(description)
            .setTimestamp();
    }
}

// ============================================
// LOGGING HELPER
// ============================================

async function logToChannel(guild, action, user, details) {
    if (!guild) return;
    
    const logChannel = guild.channels.cache.find(c => c.name === CONFIG.LOG_CHANNEL);
    if (!logChannel) return;
    
    const logEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle(`📝 ${action}`)
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Time', value: new Date().toLocaleString(), inline: true },
            { name: 'Details', value: details, inline: false }
        )
        .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
}

// ============================================
// SLASH COMMANDS REGISTRATION
// ============================================

const commands = [
    // User Commands
    {
        name: 'register',
        description: 'Create your seller account',
    },
    {
        name: 'start',
        description: 'Open DM to start selling gift cards',
    },
    {
        name: 'profile',
        description: 'View your profile or another user',
        options: [
            {
                name: 'user',
                description: 'User to view profile (leave empty for yourself)',
                type: 6, // USER type
                required: false
            }
        ]
    },
    {
        name: 'paypal',
        description: 'Set your PayPal email',
        options: [
            {
                name: 'email',
                description: 'Your PayPal email address',
                type: 3, // STRING type
                required: true
            }
        ]
    },
    {
        name: 'btc',
        description: 'Set your Bitcoin address',
        options: [
            {
                name: 'address',
                description: 'Your Bitcoin wallet address',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'bank',
        description: 'Set your bank details',
        options: [
            {
                name: 'name',
                description: 'Your full account name (use quotes if needed)',
                type: 3,
                required: true
            },
            {
                name: 'number',
                description: 'Your account number',
                type: 3,
                required: true
            },
            {
                name: 'bank',
                description: 'Your bank name',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'help',
        description: 'Show all available commands',
    },
    {
        name: 'ping',
        description: 'Check bot latency',
    },
    {
        name: 'members',
        description: 'Show server member statistics',
    },
    {
        name: 'users',
        description: 'List human members in server',
    },
    {
        name: 'bots',
        description: 'List bots in server',
    },
    {
        name: 'leaderboard',
        description: 'Show top sellers',
    },
    
    // Admin Commands
    {
        name: 'pending',
        description: 'Show all pending transactions (Admin only)',
        default_member_permissions: '0' // Restrict to admins
    },
    {
        name: 'transaction',
        description: 'View transaction details (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'approve',
        description: 'Approve a pending transaction (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            },
            {
                name: 'amount',
                description: 'Amount to pay',
                type: 4, // INTEGER type
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'reject',
        description: 'Reject a pending transaction (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for rejection',
                type: 3,
                required: false
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'paid',
        description: 'Mark transaction as paid (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'logs',
        description: 'View recent logs (Admin only)',
        options: [
            {
                name: 'limit',
                description: 'Number of logs to show',
                type: 4,
                required: false,
                min_value: 1,
                max_value: 100
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'announce',
        description: 'Send announcement to all users (Admin only)',
        options: [
            {
                name: 'message',
                description: 'Announcement message',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    }
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

(async () => {
    try {
        console.log('[SLASH] Registering slash commands...');
        
        if (CONFIG.GUILD_ID) {
            // Guild commands (instant, for testing)
            await rest.put(
                Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
                { body: commands }
            );
            console.log(`[SLASH] Registered ${commands.length} commands for guild ${CONFIG.GUILD_ID}`);
        } else {
            // Global commands (can take up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(CONFIG.CLIENT_ID),
                { body: commands }
            );
            console.log(`[SLASH] Registered ${commands.length} global commands`);
        }
    } catch (error) {
        console.error('[SLASH] Failed to register commands:', error);
    }
})();

// ============================================
// BOT READY EVENT
// ============================================

client.once('ready', () => {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ BOT IS ONLINE!`);
    console.log('='.repeat(50));
    console.log(`🤖 Bot Tag: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`🔧 Slash Commands: ${commands.length}`);
    console.log(`👑 Admin ID: ${CONFIG.ADMIN_ID}`);
    console.log(`📝 Log Channel: #${CONFIG.LOG_CHANNEL}`);
    console.log('='.repeat(50) + '\n');

    // Set bot status
    client.user.setActivity('/start | Begin selling', { 
        type: 'WATCHING' 
    });
});

// ============================================
// WELCOME MESSAGE HANDLER
// ============================================

client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📜 Welcome to CardVault Gift Card Buyer')
            .setDescription('**READ THE RULES BELOW**\n———————————————————')
            .addFields(
                { 
                    name: 'Step 1: 📝 Register', 
                    value: `Type \`/register\` in the server to create your seller account`, 
                    inline: false 
                },
                { 
                    name: 'Step 2: 💳 Set Payment Method', 
                    value: `Use these commands:\n\`/paypal email:email@example.com\`\n\`/btc address:yourBitcoinAddress\`\n\`/bank name:"Your Full Name" number:0123456789 bank:BankName\``, 
                    inline: false 
                },
                { 
                    name: 'Step 3: 🚀 Start Selling', 
                    value: `Type \`/start\` in the server to open a DM, then follow the buttons`, 
                    inline: false 
                },
                { name: '———————————————————', value: '**📋 RULES**', inline: false },
                { 
                    name: '✅ DO:', 
                    value: '• Submit clear photos of cards\n• Ensure codes are visible\n• Set correct payment details\n• Be patient with reviews', 
                    inline: true 
                },
                { 
                    name: '❌ DON\'T:', 
                    value: '• Submit expired cards\n• Send fake or used cards\n• Spam or harass staff\n• Share others\' info', 
                    inline: true 
                },
                { 
                    name: '⚠️ WARNING', 
                    value: 'Violating rules = permanent ban! No exceptions.', 
                    inline: false 
                }
            )
            .setFooter({ text: 'CardVault • Safe & Fast Gift Card Selling' })
            .setTimestamp();

        await member.send({ embeds: [welcomeEmbed] });
        
        // Log to channel
        await logToChannel(member.guild, 'New Member Joined', member.user, 'Welcome DM sent');
        
        console.log(`[WELCOME] Message sent to ${member.user.tag}`);
    } catch (error) {
        console.log(`[WELCOME] Could not send DM to ${member.user.tag} - DMs closed`);
    }
});

// ============================================
// INTERACTION HANDLER (Slash Commands & Buttons)
// ============================================

client.on('interactionCreate', async (interaction) => {
    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            // Check cooldown (except for admins)
            if (interaction.user.id !== CONFIG.ADMIN_ID) {
                const cooldownTime = 3; // 3 seconds
                const key = `${interaction.user.id}-${interaction.commandName}`;
                
                if (cooldowns.has(key)) {
                    const expires = cooldowns.get(key);
                    if (Date.now() < expires) {
                        const timeLeft = ((expires - Date.now()) / 1000).toFixed(1);
                        return interaction.reply({ 
                            content: `⏱️ Slow down! Wait ${timeLeft}s before using this command again.`,
                            ephemeral: true 
                        });
                    }
                }
                
                cooldowns.set(key, Date.now() + (cooldownTime * 1000));
            }
            
            // Check if user is banned
            const userData = db.getUser(interaction.user.id);
            if (userData?.isBanned) {
                return interaction.reply({ 
                    content: '❌ You are banned from using CardVault.',
                    ephemeral: true 
                });
            }
            
            // Handle each command
            await handleSlashCommand(interaction);
            
            // Log command usage
            await logToChannel(
                interaction.guild,
                'Command Used',
                interaction.user,
                `/${interaction.commandName}`
            );
        }
        
        // Handle button interactions
        else if (interaction.isButton()) {
            await handleButton(interaction);
        }
        
        // Handle select menu interactions
        else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        }
        
    } catch (error) {
        console.error('[ERROR] Interaction error:', error);
        
        const errorMessage = '❌ An error occurred while processing your request.';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// ============================================
// SLASH COMMAND HANDLER
// ============================================

async function handleSlashCommand(interaction) {
    const { commandName, options, user, guild } = interaction;
    
    // Check admin commands
    const isAdmin = user.id === CONFIG.ADMIN_ID;
    const adminCommands = ['pending', 'transaction', 'approve', 'reject', 'paid', 'logs', 'announce'];
    
    if (adminCommands.includes(commandName) && !isAdmin) {
        return interaction.reply({ 
            content: '❌ This command is for admins only.',
            ephemeral: true 
        });
    }
    
    switch (commandName) {
        // ===== USER COMMANDS =====
        
        case 'ping':
            await interaction.reply({
                embeds: [EmbedHelper.success(
                    'Pong! 🏓',
                    `Bot latency: ${Date.now() - interaction.createdTimestamp}ms\nAPI Latency: ${Math.round(client.ws.ping)}ms`
                )]
            });
            break;
            
        case 'register':
            const userData = db.createUser(user.id);
            await interaction.reply({
                embeds: [EmbedHelper.success(
                    '✅ Registration Successful!',
                    'You can now sell gift cards!',
                    [
                        { name: '📍 Next Step', value: `Use \`/start\` to open DM and begin selling`, inline: false },
                        { name: '💳 Set Payment Method', value: 
                            `\`/paypal email:your@email.com\`\n` +
                            `\`/btc address:yourBitcoinAddress\`\n` +
                            `\`/bank name:"Your Name" number:0123456789 bank:BankName\``, inline: false }
                    ]
                )]
            });
            break;
            
        case 'start':
            try {
                // Check if registered
                const registered = db.getUser(user.id);
                if (!registered || !registered.registered) {
                    return interaction.reply({ 
                        content: '❌ You need to register first! Use `/register`',
                        ephemeral: true 
                    });
                }
                
                await user.send('👋 **Welcome to CardVault!**\n\nClick the button below to start selling.');
                
                // Create payment method selection buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('sell_paypal')
                            .setLabel('PayPal')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💳'),
                        new ButtonBuilder()
                            .setCustomId('sell_bitcoin')
                            .setLabel('Bitcoin')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('₿'),
                        new ButtonBuilder()
                            .setCustomId('sell_bank')
                            .setLabel('Bank Transfer')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🏦')
                    );
                
                await user.send({
                    content: '**Choose your payment method:**',
                    components: [row]
                });
                
                await interaction.reply({ 
                    content: '✅ **DM opened!** Check your DMs to start selling.',
                    ephemeral: true 
                });
            } catch (error) {
                await interaction.reply({ 
                    content: '❌ Could not DM you. Please enable DMs from server members.',
                    ephemeral: true 
                });
            }
            break;
            
        case 'profile':
            const targetUser = options.getUser('user') || user;
            const profileData = db.getUser(targetUser.id);
            
            if (!profileData) {
                return interaction.reply({ 
                    content: `❌ ${targetUser.username} is not registered.`,
                    ephemeral: true 
                });
            }
            
            const transactions = db.getUserTransactions(targetUser.id);
            const recentTx = transactions.length > 0 ? transactions[0] : null;
            
            const profileEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`👤 ${targetUser.username}'s Profile`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '💳 PayPal', value: profileData.paypal || '❌ Not set', inline: false },
                    { name: '₿ Bitcoin', value: profileData.btc || '❌ Not set', inline: false },
                    { name: '🏦 Bank Transfer', value: profileData.bankName ? 
                        `${profileData.bankName}\n${profileData.bankNumber}\n${profileData.bankAccount}` : 
                        '❌ Not set', inline: false },
                    { name: '💰 Cards Sold', value: `${profileData.totalSold || 0}`, inline: true },
                    { name: '💵 Total Earned', value: `$${profileData.totalEarned || 0}`, inline: true }
                )
                .setTimestamp();
            
            if (recentTx) {
                profileEmbed.addFields({ 
                    name: '📋 Last Transaction', 
                    value: `${recentTx.brand} - $${recentTx.value} (${recentTx.status})`, 
                    inline: false 
                });
            }
            
            await interaction.reply({ embeds: [profileEmbed] });
            break;
            
        case 'paypal':
            const email = options.getString('email');
            
            if (!email.includes('@')) {
                return interaction.reply({ 
                    content: '❌ Please provide a valid email address.',
                    ephemeral: true 
                });
            }
            
            db.setPaymentMethod(user.id, 'paypal', email);
            
            await interaction.reply({
                embeds: [EmbedHelper.success(
                    'PayPal Email Set',
                    `✅ Your PayPal email has been set to: **${email}**`
                )]
            });
            break;
            
        case 'btc':
            const address = options.getString('address');
            
            if (address.length < 10) {
                return interaction.reply({ 
                    content: '❌ Please provide a valid Bitcoin address.',
                    ephemeral: true 
                });
            }
            
            db.setPaymentMethod(user.id, 'btc', address);
            
            await interaction.reply({
                embeds: [EmbedHelper.success(
                    'Bitcoin Address Set',
                    `✅ Your Bitcoin address has been set to: **${address}**`
                )]
            });
            break;
            
        case 'bank':
            const accountName = options.getString('name');
            const accountNumber = options.getString('number');
            const bankName = options.getString('bank');
            
            // Validate account number
            if (!/^\d+$/.test(accountNumber)) {
                return interaction.reply({ 
                    content: '❌ Account number should contain only numbers!',
                    ephemeral: true 
                });
            }
            
            db.setPaymentMethod(user.id, 'bank', `${accountName}|${accountNumber}|${bankName}`);
            
            await interaction.reply({
                embeds: [EmbedHelper.success(
                    'Bank Details Saved',
                    '✅ Your bank details have been saved:',
                    [
                        { name: 'Account Name', value: accountName, inline: true },
                        { name: 'Account Number', value: accountNumber, inline: true },
                        { name: 'Bank', value: bankName, inline: true }
                    ]
                )]
            });
            break;
            
        case 'help':
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📚 CardVault Bot Commands')
                .setDescription('All commands are slash commands! Just type `/` and browse.')
                .addFields(
                    { name: '🚀 **Getting Started**', value: 
                        '`/register` - Create account\n' +
                        '`/start` - Open DM to sell\n' +
                        '`/profile` - View your profile', 
                        inline: false },
                    { name: '💳 **Payment Methods**', value: 
                        '`/paypal` - Set PayPal\n' +
                        '`/btc` - Set Bitcoin\n' +
                        '`/bank` - Set Bank details', 
                        inline: false },
                    { name: '📊 **Server Info**', value: 
                        '`/members` - Member stats\n' +
                        '`/users` - List humans\n' +
                        '`/bots` - List bots\n' +
                        '`/leaderboard` - Top sellers', 
                        inline: false },
                    { name: '❓ **Other**', value: 
                        '`/help` - This menu\n' +
                        '`/ping` - Check latency', 
                        inline: false }
                )
                .setFooter({ text: 'CardVault Gift Card Buyer' })
                .setTimestamp();
            
            if (isAdmin) {
                helpEmbed.addFields({ 
                    name: '👑 **Admin Commands**', 
                    value: 
                        '`/pending` - View pending\n' +
                        '`/approve` - Approve card\n' +
                        '`/reject` - Reject card\n' +
                        '`/paid` - Mark as paid\n' +
                        '`/transaction` - View details\n' +
                        '`/logs` - View activity logs\n' +
                        '`/announce` - Broadcast message', 
                    inline: false 
                });
            }
            
            await interaction.reply({ embeds: [helpEmbed] });
            break;
            
        case 'members':
            const members = interaction.guild.members.cache;
            const total = members.size;
            const humans = members.filter(m => !m.user.bot).size;
            const bots = members.filter(m => m.user.bot).size;
            
            await interaction.reply({
                embeds: [EmbedHelper.info(
                    `👥 Server Members - ${interaction.guild.name}`,
                    '',
                    [
                        { name: 'Total Members', value: `${total}`, inline: true },
                        { name: 'Humans', value: `${humans}`, inline: true },
                        { name: 'Bots', value: `${bots}`, inline: true }
                    ]
                )]
            });
            break;
            
        case 'users':
            const humanList = interaction.guild.members.cache
                .filter(m => !m.user.bot && m.user.id !== client.user.id)
                .map(m => m.user.username)
                .slice(0, 20)
                .join('\n');
            
            await interaction.reply({
                embeds: [EmbedHelper.info(
                    '👤 Human Members',
                    humanList || 'No humans found'
                )]
            });
            break;
            
        case 'bots':
            const botList = interaction.guild.members.cache
                .filter(m => m.user.bot)
                .map(m => m.user.username)
                .slice(0, 20)
                .join('\n');
            
            await interaction.reply({
                embeds: [EmbedHelper.info(
                    '🤖 Bots in Server',
                    botList || 'No bots found'
                )]
            });
            break;
            
        case 'leaderboard':
            const topSellers = db.getTopSellers(10);
            
            if (topSellers.length === 0) {
                return interaction.reply('📊 No sellers yet! Be the first!');
            }
            
            let leaderboardText = '';
            for (let i = 0; i < topSellers.length; i++) {
                const seller = topSellers[i];
                try {
                    const userObj = await client.users.fetch(seller.userId);
                    leaderboardText += `${i + 1}. **${userObj.username}** - ${seller.totalSold} cards ($${seller.totalEarned})\n`;
                } catch {
                    leaderboardText += `${i + 1}. Unknown User - ${seller.totalSold} cards ($${seller.totalEarned})\n`;
                }
            }
            
            await interaction.reply({
                embeds: [EmbedHelper.info(
                    '🏆 Top Sellers',
                    leaderboardText
                )]
            });
            break;
            
        // ===== ADMIN COMMANDS =====
        
        case 'pending':
            const pending = db.getPendingTransactions();
            
            if (pending.length === 0) {
                return interaction.reply('✅ No pending transactions!');
            }
            
            const pendingEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`⏳ Pending Transactions (${pending.length})`)
                .setTimestamp();
            
            pending.slice(0, 10).forEach(tx => {
                const date = new Date(tx.submittedAt).toLocaleString();
                pendingEmbed.addFields({
                    name: `${tx.txId} - ${tx.username}`,
                    value: `${tx.brand} - $${tx.value} | ${date}`,
                    inline: false
                });
            });
            
            if (pending.length > 10) {
                pendingEmbed.setFooter({ text: `...and ${pending.length - 10} more` });
            }
            
            await interaction.reply({ embeds: [pendingEmbed] });
            break;
            
        case 'transaction':
            const txId = options.getString('id');
            const tx = db.getTransaction(txId);
            
            if (!tx) {
                return interaction.reply({ 
                    content: '❌ Transaction not found!',
                    ephemeral: true 
                });
            }
            
            const txEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📋 Transaction: ${tx.txId}`)
                .addFields(
                    { name: '👤 User', value: tx.username, inline: true },
                    { name: '📦 Card', value: `${tx.brand} - $${tx.value}`, inline: true },
                    { name: '💳 Payment', value: tx.paymentMethod, inline: true },
                    { name: '📊 Status', value: tx.status, inline: true },
                    { name: '📅 Submitted', value: new Date(tx.submittedAt).toLocaleString(), inline: true }
                )
                .setImage(tx.image)
                .setTimestamp();
            
            await interaction.reply({ embeds: [txEmbed] });
            break;
            
        case 'approve':
            const approveId = options.getString('id');
            const amount = options.getInteger('amount');
            
            const approveTx = db.getTransaction(approveId);
            if (!approveTx) {
                return interaction.reply({ 
                    content: '❌ Transaction not found!',
                    ephemeral: true 
                });
            }
            
            if (approveTx.status !== 'pending') {
                return interaction.reply({ 
                    content: `❌ This transaction is already ${approveTx.status}`,
                    ephemeral: true 
                });
            }
            
            db.updateTransactionStatus(approveId, 'approved');
            
            try {
                const userObj = await client.users.fetch(approveTx.userId);
                if (userObj) {
                    await userObj.send({
                        embeds: [EmbedHelper.success(
                            'Card Approved!',
                            `Your card has been approved.`,
                            [
                                { name: 'Transaction', value: approveId, inline: true },
                                { name: 'Offer', value: `$${amount}`, inline: true }
                            ]
                        )]
                    });
                }
            } catch (error) {
                console.log('Could not DM user');
            }
            
            await interaction.reply(`✅ Transaction ${approveId} approved for $${amount}`);
            break;
            
        case 'reject':
            const rejectId = options.getString('id');
            const reason = options.getString('reason') || 'No reason provided';
            
            const rejectTx = db.getTransaction(rejectId);
            if (!rejectTx) {
                return interaction.reply({ 
                    content: '❌ Transaction not found!',
                    ephemeral: true 
                });
            }
            
            if (rejectTx.status !== 'pending') {
                return interaction.reply({ 
                    content: `❌ This transaction is already ${rejectTx.status}`,
                    ephemeral: true 
                });
            }
            
            db.updateTransactionStatus(rejectId, 'rejected', reason);
            
            try {
                const userObj = await client.users.fetch(rejectTx.userId);
                if (userObj) {
                    await userObj.send({
                        embeds: [EmbedHelper.error(
                            'Card Rejected',
                            `Your card was rejected.`,
                            [
                                { name: 'Transaction', value: rejectId, inline: true },
                                { name: 'Reason', value: reason, inline: false }
                            ]
                        )]
                    });
                }
            } catch (error) {
                console.log('Could not DM user');
            }
            
            await interaction.reply(`✅ Transaction ${rejectId} rejected.`);
            break;
            
        case 'paid':
            const paidId = options.getString('id');
            
            const paidTx = db.getTransaction(paidId);
            if (!paidTx) {
                return interaction.reply({ 
                    content: '❌ Transaction not found!',
                    ephemeral: true 
                });
            }
            
            if (paidTx.status !== 'approved') {
                return interaction.reply({ 
                    content: `❌ This transaction is ${paidTx.status}. It needs to be approved first.`,
                    ephemeral: true 
                });
            }
            
            db.updateTransactionStatus(paidId, 'paid');
            db.incrementUserStats(paidTx.userId, paidTx.value);
            
            try {
                const userObj = await client.users.fetch(paidTx.userId);
                if (userObj) {
                    await userObj.send({
                        embeds: [EmbedHelper.success(
                            '💰 Payment Sent!',
                            `Your payment has been processed.`,
                            [
                                { name: 'Transaction', value: paidId, inline: true },
                                { name: 'Amount', value: `$${paidTx.value}`, inline: true }
                            ]
                        )]
                    });
                }
            } catch (error) {
                console.log('Could not DM user');
            }
            
            await interaction.reply(`✅ Payment for ${paidId} marked as sent.`);
            break;
            
        case 'logs':
            const limit = options.getInteger('limit') || 20;
            const logs = db.getRecentLogs(limit);
            
            const logsEmbed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle(`📋 Recent Logs (${logs.length})`)
                .setTimestamp();
            
            let logText = '';
            logs.slice(0, 15).forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                logText += `[${date}] ${log.action} | ${log.userId} | ${log.details}\n`;
            });
            
            if (logText.length > 2000) {
                logText = logText.substring(0, 1900) + '...';
            }
            
            logsEmbed.setDescription('```\n' + logText + '\n```');
            
            await interaction.reply({ embeds: [logsEmbed] });
            break;
            
        case 'announce':
            const announcement = options.getString('message');
            
            await interaction.reply({
                content: '📢 Sending announcement to all users...',
                ephemeral: true
            });
            
            const allUsers = db.db.prepare('SELECT userId FROM users').all();
            let sentCount = 0;
            
            for (const u of allUsers) {
                try {
                    const userObj = await client.users.fetch(u.userId);
                    await userObj.send({
                        embeds: [EmbedHelper.info(
                            '📢 Announcement',
                            announcement
                        )]
                    });
                    sentCount++;
                    // Small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log(`Could not DM user ${u.userId}`);
                }
            }
            
            await interaction.followUp({
                content: `✅ Announcement sent to ${sentCount} users.`,
                ephemeral: true
            });
            break;
    }
}

// ============================================
// BUTTON HANDLER (Selling Flow)
// ============================================

async function handleButton(interaction) {
    const { user, customId } = interaction;
    
    // Check if user is banned
    const userData = db.getUser(user.id);
    if (userData?.isBanned) {
        return interaction.reply({ 
            content: '❌ You are banned from using CardVault.',
            ephemeral: true 
        });
    }
    
    // Check if registered
    if (!userData || !userData.registered) {
        return interaction.reply({ 
            content: '❌ You need to register first! Use `/register` in the server.',
            ephemeral: true 
        });
    }
    
    // Handle sell buttons
    if (customId.startsWith('sell_')) {
        const method = customId.replace('sell_', '');
        
        // Check if payment method is set
        if (method === 'paypal' && !userData.paypal) {
            return interaction.reply({ 
                content: '❌ You need to set your PayPal email first! Use `/paypal` in the server.',
                ephemeral: true 
            });
        }
        if (method === 'bitcoin' && !userData.btc) {
            return interaction.reply({ 
                content: '❌ You need to set your Bitcoin address first! Use `/btc` in the server.',
                ephemeral: true 
            });
        }
        if (method === 'bank' && !userData.bankName) {
            return interaction.reply({ 
                content: '❌ You need to set your bank details first! Use `/bank` in the server.',
                ephemeral: true 
            });
        }
        
        // Create session
        let session = sessions.get(user.id);
        if (session) sessions.delete(user.id);
        
        session = sessions.create(user.id);
        session.data.paymentMethod = method;
        
        // Store payment detail
        if (method === 'paypal') session.data.paymentDetail = userData.paypal;
        if (method === 'bitcoin') session.data.paymentDetail = userData.btc;
        if (method === 'bank') {
            session.data.paymentDetail = `${userData.bankName} | ${userData.bankNumber} | ${userData.bankAccount}`;
        }
        
        // Get card brands for select menu
        const brands = db.getCardBrands();
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_brand')
            .setPlaceholder('Choose a card brand')
            .addOptions(
                brands.slice(0, 25).map(brand => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(brand)
                        .setValue(brand)
                )
            );
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.update({
            content: '**Select your card brand:**',
            components: [row]
        });
    }
    
    // Log button interaction
    await logToChannel(
        interaction.guild,
        'Button Click',
        user,
        `Button: ${customId}`
    );
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const { user, values } = interaction;
    
    if (interaction.customId === 'select_brand') {
        const brand = values[0];
        const session = sessions.get(user.id);
        
        if (!session) {
            return interaction.reply({ 
                content: '❌ Session expired. Please use `/start` again.',
                ephemeral: true 
            });
        }
        
        session.data.brand = brand;
        sessions.update(user.id, { step: 2 });
        
        // Create modal for card value
        const modal = new ModalBuilder()
            .setCustomId('modal_value')
            .setTitle('Enter Card Value');
        
        const valueInput = new TextInputBuilder()
            .setCustomId('card_value')
            .setLabel('Card Value in USD')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 25, 50, 100')
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(4);
        
        const row = new ActionRowBuilder().addComponents(valueInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'modal_value') {
        const value = parseInt(interaction.fields.getTextInputValue('card_value'));
        const user = interaction.user;
        const session = sessions.get(user.id);
        
        if (!session) {
            return interaction.reply({ 
                content: '❌ Session expired. Please use `/start` again.',
                ephemeral: true 
            });
        }
        
        if (isNaN(value) || value <= 0) {
            return interaction.reply({ 
                content: '❌ Please enter a valid number.',
                ephemeral: true 
            });
        }
        
        session.data.value = value;
        sessions.update(user.id, { step: 3 });
        
        await interaction.reply({
            content: '**Please upload a CLEAR photo of the card**\nMake sure the code is visible!\n\nJust drag and drop your image here.',
            ephemeral: false
        });
    }
});

// ============================================
// DM MESSAGE HANDLER (For Image Uploads)
// ============================================

client.on('messageCreate', async (message) => {
    // Ignore bot messages and server messages
    if (message.author.bot) return;
    if (message.guild !== null) return;
    
    const userId = message.author.id;
    const session = sessions.get(userId);
    
    if (!session || session.step !== 3) return;
    
    // Check if message has image
    if (message.attachments.size === 0) {
        return message.reply('❌ Please upload an image of the card.');
    }
    
    const image = message.attachments.first();
    
    // Check if it's an image
    if (!image.contentType?.startsWith('image/')) {
        return message.reply('❌ Please upload a valid image file.');
    }
    
    // Create transaction
    const txId = db.createTransaction({
        userId,
        username: message.author.username,
        paymentMethod: session.data.paymentMethod,
        paymentDetail: session.data.paymentDetail,
        brand: session.data.brand,
        value: session.data.value,
        image: image.url
    });
    
    // Notify admin channel in all guilds
    client.guilds.cache.forEach(async (guild) => {
        const adminChannel = guild.channels.cache.find(c => c.name === 'admin');
        if (adminChannel) {
            const adminEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🆕 New Gift Card Submission')
                .addFields(
                    { name: '🆔 Transaction', value: txId, inline: true },
                    { name: '👤 User', value: message.author.username, inline: true },
                    { name: '💳 Payment', value: session.data.paymentMethod, inline: true },
                    { name: '📦 Card', value: `${session.data.brand} - $${session.data.value}`, inline: true }
                )
                .setImage(image.url)
                .setFooter({ text: `User ID: ${userId}` })
                .setTimestamp();
            
            await adminChannel.send({ embeds: [adminEmbed] });
            await adminChannel.send(`<@${CONFIG.ADMIN_ID}> New card ready for review!`);
        }
    });
    
    // Clear session
    sessions.delete(userId);
    
    // Send confirmation to user
    await message.reply({
        embeds: [EmbedHelper.success(
            '✅ Card Submitted Successfully!',
            `Your transaction ID: **${txId}**`,
            [
                { name: 'Card', value: `${session.data.brand} - $${session.data.value}`, inline: true },
                { name: 'Status', value: '⏳ Pending Review', inline: true }
            ]
        ).setDescription('An admin will review your card shortly. You will be notified when approved.')]
    });
    
    // Log
    db.log('card_submitted', userId, `Submitted ${session.data.brand} - $${session.data.value}`);
});

// ============================================
// ERROR HANDLING
// ============================================

process.on('unhandledRejection', (error) => {
    console.error('[FATAL] Unhandled promise rejection:', error);
});

client.on('error', (error) => {
    console.error('[CLIENT ERROR]', error);
});

// ============================================
// START BOT
// ============================================

client.login(CONFIG.TOKEN).then(() => {
    console.log('[BOT] Login successful');
}).catch((error) => {
    console.error('[BOT] Login failed:', error.message);
    process.exit(1);
});