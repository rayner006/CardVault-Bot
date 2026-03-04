/**
 * CARDVAULT GIFT CARD BUYER BOT
 * A professional Discord bot for buying and selling gift cards
 * 
 * @version 2.0.1
 * @author YourName
 * @license MIT
 */

// ============================================
// DEPENDENCIES
// ============================================
const { Client, GatewayIntentBits, EmbedBuilder, Collection } = require('discord.js');
const Database = require('better-sqlite3');
const express = require('express');

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
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`[SERVER] Web server running on port ${PORT}`);
});

// Environment variables
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    PREFIX: process.env.PREFIX || '!',
    ADMIN_ID: process.env.ADMIN_ID,
    SUPPORT_ID: process.env.SUPPORT_ID || '1478007761697509531'
};

// Validate required config
if (!CONFIG.TOKEN) {
    console.error('[ERROR] DISCORD_TOKEN is not set in environment variables');
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
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions
    ]
});

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

        // Create settings table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);
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

    // ===== STATS METHODS =====
    
    incrementUserStats(userId, value) {
        const user = this.getUser(userId);
        if (user) {
            const totalSold = (user.totalSold || 0) + 1;
            const totalEarned = (user.totalEarned || 0) + value;
            this.updateUser(userId, { totalSold, totalEarned });
        }
    }

    // ===== LOGGING =====
    
    log(action, userId, details) {
        console.log(`[LOG] ${new Date().toLocaleTimeString()} | ${action} | ${userId} | ${details}`);
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
// BOT READY EVENT
// ============================================

client.once('ready', () => {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ BOT IS ONLINE!`);
    console.log('='.repeat(50));
    console.log(`🤖 Bot Tag: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`🔧 Prefix: ${CONFIG.PREFIX}`);
    console.log(`👑 Admin ID: ${CONFIG.ADMIN_ID}`);
    console.log('='.repeat(50) + '\n');

    // Set bot status
    client.user.setActivity(`${CONFIG.PREFIX}start | Begin selling`, { 
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
                    value: `Type \`${CONFIG.PREFIX}register\` in the server to create your seller account`, 
                    inline: false 
                },
                { 
                    name: 'Step 2: 💳 Set Payment Method', 
                    value: `Use one of these commands:\n\`${CONFIG.PREFIX}paypal email@example.com\`\n\`${CONFIG.PREFIX}btc yourBitcoinAddress\`\n\`${CONFIG.PREFIX}bank "Your Full Name" 0123456789 BankName\``, 
                    inline: false 
                },
                { 
                    name: 'Step 3: 🚀 Start Selling', 
                    value: `Type \`${CONFIG.PREFIX}start\` or \`${CONFIG.PREFIX}hello\` in the server to open a DM, then send **sell**`, 
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
        console.log(`[WELCOME] Message sent to ${member.user.tag}`);
    } catch (error) {
        console.log(`[WELCOME] Could not send DM to ${member.user.tag} - DMs closed`);
    }
});

// ============================================
// DM MESSAGE HANDLER (Selling Flow)
// ============================================

async function handleDM(message) {
    const userId = message.author.id;
    const content = message.content.toLowerCase().trim();
    
    try {
        // Check if user is banned
        const user = db.getUser(userId);
        if (user?.isBanned) {
            return message.reply('❌ You are banned from using CardVault.');
        }

        // Get or create session
        let session = sessions.get(userId);
        
        // If no session and not "sell", show welcome
        if (!session && content !== 'sell') {
            return message.reply({
                embeds: [EmbedHelper.info(
                    'Welcome to CardVault!',
                    'To sell a gift card, type **sell** to begin the submission process.'
                )]
            });
        }

        // Handle "sell" command - start new session
        if (content === 'sell') {
            // Check if registered
            if (!user || !user.registered) {
                return message.reply({
                    embeds: [EmbedHelper.error(
                        'Registration Required',
                        `You need to register first! Go to the server and type \`${CONFIG.PREFIX}register\``
                    )]
                });
            }

            // Create new session
            session = sessions.create(userId);
            
            return message.reply({
                embeds: [EmbedHelper.info(
                    '💳 Choose Payment Method',
                    'How do you want to get paid?',
                    [
                        { name: '1️⃣', value: 'PayPal (International)', inline: true },
                        { name: '2️⃣', value: 'Bitcoin (Crypto)', inline: true },
                        { name: '3️⃣', value: 'Bank Transfer (Nigeria)', inline: true }
                    ]
                ).setFooter({ text: 'Reply with 1, 2, or 3' })]
            });
        }

        // If no session at this point, something's wrong
        if (!session) {
            return message.reply('Welcome to CardVault! Type **sell** to start.');
        }

        // Process based on current step
        switch (session.step) {
            case 1: // Payment method selection
                if (!['1', '2', '3'].includes(content)) {
                    return message.reply('❌ Please reply with **1**, **2**, or **3**');
                }

                const method = content === '1' ? 'paypal' : content === '2' ? 'bitcoin' : 'bank';
                session.data.paymentMethod = method;

                // Check if payment details exist
                if (method === 'paypal' && !user.paypal) {
                    sessions.delete(userId);
                    return message.reply({
                        embeds: [EmbedHelper.error(
                            'PayPal Not Set',
                            `You need to set your PayPal email first!\nUse \`${CONFIG.PREFIX}paypal email@example.com\` in the server.`
                        )]
                    });
                }

                if (method === 'bitcoin' && !user.btc) {
                    sessions.delete(userId);
                    return message.reply({
                        embeds: [EmbedHelper.error(
                            'Bitcoin Address Not Set',
                            `You need to set your Bitcoin address first!\nUse \`${CONFIG.PREFIX}btc your_address\` in the server.`
                        )]
                    });
                }

                if (method === 'bank' && !user.bankName) {
                    sessions.delete(userId);
                    return message.reply({
                        embeds: [EmbedHelper.error(
                            'Bank Details Not Set',
                            `You need to set your bank details first!\nUse \`${CONFIG.PREFIX}bank "Your Full Name" 0123456789 BankName\` in the server.`
                        )]
                    });
                }

                // Store payment detail for later
                if (method === 'paypal') session.data.paymentDetail = user.paypal;
                if (method === 'bitcoin') session.data.paymentDetail = user.btc;
                if (method === 'bank') {
                    session.data.paymentDetail = `${user.bankName} | ${user.bankNumber} | ${user.bankAccount}`;
                }

                sessions.nextStep(userId);
                return message.reply(
                    '**Great! Now tell me the card brand**\n' +
                    'Examples: Amazon, Visa, Steam, Google Play, Xbox, etc.'
                );

            case 2: // Card brand
                session.data.brand = message.content;
                sessions.nextStep(userId);
                return message.reply(
                    '**What is the card value?**\n' +
                    'Please enter the amount in USD (e.g., 25, 50, 100)'
                );

            case 3: // Card value
                const value = parseInt(message.content);
                if (isNaN(value) || value <= 0) {
                    return message.reply('❌ Please enter a valid number (e.g., 25, 50, 100)');
                }
                session.data.value = value;
                sessions.nextStep(userId);
                return message.reply(
                    '**Please upload a CLEAR photo of the card**\n' +
                    'Make sure the code is visible!'
                );

            case 4: // Image upload
                if (message.attachments.size === 0) {
                    return message.reply('❌ Please upload an image of the card');
                }

                const image = message.attachments.first();
                
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

                // Notify admin channel
                const adminChannel = client.channels.cache.find(c => c.name === 'admin');
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

                // Clear session
                sessions.delete(userId);

                // Send confirmation to user
                return message.reply({
                    embeds: [EmbedHelper.success(
                        '✅ Card Submitted Successfully!',
                        `Your transaction ID: **${txId}**`,
                        [
                            { name: 'Card', value: `${session.data.brand} - $${session.data.value}`, inline: true },
                            { name: 'Status', value: '⏳ Pending Review', inline: true }
                        ]
                    ).setDescription('An admin will review your card shortly. You will be notified when approved.')]
                });

            default:
                sessions.delete(userId);
                return message.reply('Something went wrong. Please type **sell** to start over.');
        }

    } catch (error) {
        console.error('[ERROR] in handleDM:', error);
        return message.reply('❌ An error occurred. Please try again later.');
    }
}

// ============================================
// MAIN MESSAGE HANDLER
// ============================================

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Handle DMs
    if (message.guild === null) {
        await handleDM(message);
        return;
    }

    // Handle server commands - check prefix
    if (!message.content.startsWith(CONFIG.PREFIX)) return;

    // Parse command
    const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isAdmin = message.author.id === CONFIG.ADMIN_ID;

    // ===== BASIC COMMANDS =====
    
    if (command === 'ping') {
        return message.reply({
            embeds: [EmbedHelper.success(
                'Pong! 🏓',
                `Bot latency: ${Date.now() - message.createdTimestamp}ms`
            )]
        });
    }

    // ===== START/HELLO COMMANDS - Open DM channel =====
    if (command === 'start' || command === 'hello') {
        try {
            await message.author.send('👋 **Welcome to CardVault!**\n\nDM me **sell** to start selling your gift cards.\n\nNeed help? Type `!help` in the server.');
            message.reply('✅ **DM opened!** Check your DMs and type **sell** to begin.');
            console.log(`[START] Opened DM for ${message.author.tag}`);
        } catch (error) {
            message.reply('❌ Could not DM you. Please enable DMs from server members and try again.');
        }
        return;
    }

    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📚 CardVault Bot Commands')
            .addFields(
                { name: '🚀 **GET STARTED**', value: 
                    `\`${CONFIG.PREFIX}start\` or \`${CONFIG.PREFIX}hello\` - Opens DM so you can sell`, 
                    inline: false },
                { name: '📝 **Registration**', value: 
                    `\`${CONFIG.PREFIX}register\` - Create seller account`, 
                    inline: false },
                { name: '💳 **Payment Methods**', value: 
                    `\`${CONFIG.PREFIX}paypal email\` - Set PayPal\n` +
                    `\`${CONFIG.PREFIX}btc address\` - Set Bitcoin\n` +
                    `\`${CONFIG.PREFIX}bank "Full Name" 0123456789 Bank\` - Set Bank (use quotes!)`, 
                    inline: false },
                { name: '👤 **Profile**', value: 
                    `\`${CONFIG.PREFIX}profile\` - View your profile`, 
                    inline: false },
                { name: '📊 **Server Info**', value: 
                    `\`${CONFIG.PREFIX}members\` - Member count\n` +
                    `\`${CONFIG.PREFIX}users\` - List humans\n` +
                    `\`${CONFIG.PREFIX}bots\` - List bots`, 
                    inline: false },
                { name: '💬 **How to Sell**', value: 
                    `1. Type \`${CONFIG.PREFIX}start\` in server\n` +
                    `2. Check your DM\n` +
                    `3. Type **sell** in DM\n` +
                    `4. Follow the prompts`, 
                    inline: false }
            )
            .setFooter({ text: 'CardVault Gift Card Buyer' })
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }

    // ===== USER COMMANDS =====
    
    if (command === 'register') {
        const user = db.createUser(message.author.id);
        
        return message.reply({
            embeds: [EmbedHelper.success(
                '✅ Registration Successful!',
                'You can now sell gift cards!',
                [
                    { name: '📍 Next Step', value: `Type \`${CONFIG.PREFIX}start\` to open DM and begin selling`, inline: false },
                    { name: '💳 Set Payment Method', value: 
                        `\`${CONFIG.PREFIX}paypal email\`\n` +
                        `\`${CONFIG.PREFIX}btc address\`\n` +
                        `\`${CONFIG.PREFIX}bank "Full Name" 0123456789 Bank\``, inline: false }
                ]
            )]
        });
    }

    if (command === 'paypal') {
        const email = args[0];
        if (!email || !email.includes('@')) {
            return message.reply(`❌ Please provide a valid email. Example: \`${CONFIG.PREFIX}paypal email@example.com\``);
        }
        
        db.setPaymentMethod(message.author.id, 'paypal', email);
        
        return message.reply({
            embeds: [EmbedHelper.success(
                'PayPal Email Set',
                `✅ Your PayPal email has been set to: **${email}**`
            )]
        });
    }

    if (command === 'btc') {
        const address = args[0];
        if (!address || address.length < 10) {
            return message.reply(`❌ Please provide a valid Bitcoin address. Example: \`${CONFIG.PREFIX}btc 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa\``);
        }
        
        db.setPaymentMethod(message.author.id, 'btc', address);
        
        return message.reply({
            embeds: [EmbedHelper.success(
                'Bitcoin Address Set',
                `✅ Your Bitcoin address has been set to: **${address}**`
            )]
        });
    }

    // ===== FIXED BANK COMMAND =====
    if (command === 'bank') {
        // Better regex to extract quoted strings and remaining args
        const quoteRegex = /"([^"]*)"/g;
        const quotedMatches = [...message.content.matchAll(quoteRegex)];
        
        let accountName, accountNumber, bankName;
        
        if (quotedMatches.length >= 1) {
            // First quoted string is account name
            accountName = quotedMatches[0][1].trim();
            
            // Get the rest of the args (after the quoted parts)
            const remainingArgs = message.content
                .replace(/"([^"]*)"/g, '') // Remove quoted parts
                .split(/\s+/) // Split by spaces
                .filter(arg => arg && !arg.startsWith(CONFIG.PREFIX)); // Remove empty and prefix
            
            // First remaining arg is account number
            accountNumber = remainingArgs[0];
            
            // Everything else is bank name
            bankName = remainingArgs.slice(1).join(' ').trim();
        } else {
            // Fallback for no quotes (old format)
            accountName = args[0]?.replace(/"/g, '');
            accountNumber = args[1];
            bankName = args.slice(2).join(' ');
        }
        
        // Validation
        if (!accountName || !accountNumber || !bankName) {
            return message.reply(
                `❌ Usage: \`${CONFIG.PREFIX}bank "Your Full Name" 0123456789 Bank Name\`\n` +
                `Example: \`${CONFIG.PREFIX}bank "Ifada Rayner" 8021141940 OPay\`\n` +
                `⚠️ Make sure to use quotes around your name!`
            );
        }
        
        // Validate account number (basic check)
        if (!/^\d+$/.test(accountNumber)) {
            return message.reply('❌ Account number should contain only numbers!');
        }
        
        // Save to database
        db.setPaymentMethod(message.author.id, 'bank', `${accountName}|${accountNumber}|${bankName}`);
        
        return message.reply({
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
    }

    if (command === 'profile') {
        const target = message.mentions.users.first() || message.author;
        const userData = db.getUser(target.id);
        
        if (!userData) {
            return message.reply(`❌ ${target.username} is not registered.`);
        }
        
        const transactions = db.getUserTransactions(target.id);
        const recentTx = transactions.length > 0 ? transactions[0] : null;
        
        const profileEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`👤 ${target.username}'s Profile`)
            .addFields(
                { name: '💳 PayPal', value: userData.paypal || '❌ Not set', inline: false },
                { name: '₿ Bitcoin', value: userData.btc || '❌ Not set', inline: false },
                { name: '🏦 Bank Transfer', value: userData.bankName ? 
                    `${userData.bankName}\n${userData.bankNumber}\n${userData.bankAccount}` : 
                    '❌ Not set', inline: false },
                { name: '💰 Cards Sold', value: `${userData.totalSold || 0}`, inline: true },
                { name: '💵 Total Earned', value: `$${userData.totalEarned || 0}`, inline: true }
            )
            .setTimestamp();
        
        if (recentTx) {
            profileEmbed.addFields({ 
                name: '📋 Last Transaction', 
                value: `${recentTx.brand} - $${recentTx.value} (${recentTx.status})`, 
                inline: false 
            });
        }
        
        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === 'members') {
        const members = message.guild.members.cache;
        const total = members.size;
        const humans = members.filter(m => !m.user.bot).size;
        const bots = members.filter(m => m.user.bot).size;
        
        return message.reply({
            embeds: [EmbedHelper.info(
                `👥 Server Members - ${message.guild.name}`,
                '',
                [
                    { name: 'Total Members', value: `${total}`, inline: true },
                    { name: 'Humans', value: `${humans}`, inline: true },
                    { name: 'Bots', value: `${bots}`, inline: true }
                ]
            )]
        });
    }

    if (command === 'users') {
        const members = message.guild.members.cache
            .filter(m => !m.user.bot && m.user.id !== client.user.id)
            .map(m => m.user.username)
            .slice(0, 20)
            .join('\n');
        
        return message.reply({
            embeds: [EmbedHelper.info(
                '👤 Human Members',
                members || 'No humans found'
            )]
        });
    }

    if (command === 'bots') {
        const bots = message.guild.members.cache
            .filter(m => m.user.bot)
            .map(m => m.user.username)
            .slice(0, 20)
            .join('\n');
        
        return message.reply({
            embeds: [EmbedHelper.info(
                '🤖 Bots in Server',
                bots || 'No bots found'
            )]
        });
    }

    // ===== ADMIN COMMANDS =====
    
    if (!isAdmin) {
        // Not admin, ignore admin commands
        if (['pending', 'approve', 'reject', 'paid', 'transaction'].includes(command)) {
            return;
        }
        return;
    }

    if (command === 'pending') {
        const pending = db.getPendingTransactions();
        
        if (pending.length === 0) {
            return message.reply('✅ No pending transactions!');
        }
        
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(`⏳ Pending Transactions (${pending.length})`)
            .setTimestamp();
        
        pending.slice(0, 10).forEach(tx => {
            const date = new Date(tx.submittedAt).toLocaleString();
            embed.addFields({
                name: `${tx.txId} - ${tx.username}`,
                value: `${tx.brand} - $${tx.value} | ${date}`,
                inline: false
            });
        });
        
        if (pending.length > 10) {
            embed.setFooter({ text: `...and ${pending.length - 10} more` });
        }
        
        return message.reply({ embeds: [embed] });
    }

    if (command === 'transaction') {
        const txId = args[0];
        if (!txId) return message.reply('❌ Usage: `!transaction TX-ID`');
        
        const tx = db.getTransaction(txId);
        if (!tx) return message.reply('❌ Transaction not found!');
        
        const embed = new EmbedBuilder()
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
        
        return message.reply({ embeds: [embed] });
    }

    if (command === 'approve') {
        const txId = args[0];
        const amount = parseInt(args[1]);
        
        if (!txId || !amount) {
            return message.reply('❌ Usage: `!approve TX-ID AMOUNT`');
        }
        
        const tx = db.getTransaction(txId);
        if (!tx) return message.reply('❌ Transaction not found!');
        if (tx.status !== 'pending') return message.reply(`❌ This transaction is already ${tx.status}`);
        
        db.updateTransactionStatus(txId, 'approved');
        
        try {
            const user = await client.users.fetch(tx.userId);
            if (user) {
                await user.send({
                    embeds: [EmbedHelper.success(
                        'Card Approved!',
                        `Your card has been approved.`,
                        [
                            { name: 'Transaction', value: txId, inline: true },
                            { name: 'Offer', value: `$${amount}`, inline: true }
                        ]
                    )]
                });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Transaction ${txId} approved for $${amount}`);
    }

    if (command === 'reject') {
        const txId = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        if (!txId) return message.reply('❌ Usage: `!reject TX-ID REASON`');
        
        const tx = db.getTransaction(txId);
        if (!tx) return message.reply('❌ Transaction not found!');
        if (tx.status !== 'pending') return message.reply(`❌ This transaction is already ${tx.status}`);
        
        db.updateTransactionStatus(txId, 'rejected', reason);
        
        try {
            const user = await client.users.fetch(tx.userId);
            if (user) {
                await user.send({
                    embeds: [EmbedHelper.error(
                        'Card Rejected',
                        `Your card was rejected.`,
                        [
                            { name: 'Transaction', value: txId, inline: true },
                            { name: 'Reason', value: reason, inline: false }
                        ]
                    )]
                });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Transaction ${txId} rejected.`);
    }

    if (command === 'paid') {
        const txId = args[0];
        if (!txId) return message.reply('❌ Usage: `!paid TX-ID`');
        
        const tx = db.getTransaction(txId);
        if (!tx) return message.reply('❌ Transaction not found!');
        if (tx.status !== 'approved') return message.reply(`❌ This transaction is ${tx.status}. It needs to be approved first.`);
        
        db.updateTransactionStatus(txId, 'paid');
        db.incrementUserStats(tx.userId, tx.value);
        
        try {
            const user = await client.users.fetch(tx.userId);
            if (user) {
                await user.send({
                    embeds: [EmbedHelper.success(
                        '💰 Payment Sent!',
                        `Your payment has been processed.`,
                        [
                            { name: 'Transaction', value: txId, inline: true },
                            { name: 'Amount', value: `$${tx.value}`, inline: true }
                        ]
                    )]
                });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Payment for ${txId} marked as sent.`);
    }
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