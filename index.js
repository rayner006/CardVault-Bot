const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const express = require('express');

// Web server for Render
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('CardVault Bot is running!');
});

app.listen(port, () => {
    console.log(`🌐 Web server listening on port ${port}`);
});

// Database
const db = new Database('cardvault.db');
console.log('⚠️ Warning: Database resets on every restart! Use external DB for persistence.');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        registered INTEGER,
        registeredAt INTEGER,
        paypal TEXT,
        btc TEXT,
        bankName TEXT,
        bankNumber TEXT,
        bankAccount TEXT,
        totalSold INTEGER DEFAULT 0,
        totalEarned INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
        txId TEXT PRIMARY KEY,
        userId TEXT,
        username TEXT,
        paymentMethod TEXT,
        paymentDetail TEXT,
        brand TEXT,
        value INTEGER,
        image TEXT,
        status TEXT,
        submittedAt INTEGER,
        approvedAt INTEGER,
        paidAt INTEGER
    );
`);

// Client with ALL required intents
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

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';
const ADMIN_ID = process.env.ADMIN_ID;

// Database helper functions
function getUser(userId) {
    const stmt = db.prepare('SELECT * FROM users WHERE userId = ?');
    return stmt.get(userId);
}

function setUser(userId, data) {
    const user = getUser(userId);
    if (user) {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        const stmt = db.prepare(`UPDATE users SET ${fields} WHERE userId = ?`);
        stmt.run(...values, userId);
    } else {
        const keys = ['userId', ...Object.keys(data)];
        const placeholders = keys.map(() => '?').join(', ');
        const values = [userId, ...Object.values(data)];
        const stmt = db.prepare(`INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`);
        stmt.run(...values);
    }
}

function saveTransaction(txId, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(data);
    const stmt = db.prepare(`INSERT INTO transactions (txId, ${keys.join(', ')}) VALUES (?, ${placeholders})`);
    stmt.run(txId, ...values);
}

// Store user sessions
const sessions = new Map();

client.once('ready', () => {
    console.log(`✅ CardVault is online! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`💾 Database connected: cardvault.db`);
    console.log(`🌐 Web server running on port ${port}`);
    console.log(`🔧 PREFIX: "${PREFIX}"`);
    console.log(`👑 ADMIN ID: ${ADMIN_ID}`);
    client.user.setActivity('💰 !sell | DM to sell', { type: 'WATCHING' });
    
    // Welcome message for new members
    client.on('guildMemberAdd', async (member) => {
        try {
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📜 Welcome to CardVault Gift Card Buyer')
                .setDescription('**READ THE RULES BELOW**\n———————————————————')
                .addFields(
                    { name: 'Step 1: 📝 Register', value: 'Type `!register` in the server to create your seller account', inline: false },
                    { name: 'Step 2: 💳 Set Payment Method', value: 'Use one of these commands:\n`!paypal email@example.com`\n`!btc yourBitcoinAddress`\n`!bank "Your Name" 0123456789 BankName`', inline: false },
                    { name: 'Step 3: 💬 Start Selling', value: 'DM the bot and type **sell** to begin your card submission', inline: false },
                    { name: '———————————————————', value: '**📋 RULES**', inline: false },
                    { name: '✅ DO:', value: '• Submit clear photos of cards\n• Ensure codes are visible\n• Set correct payment details\n• Be patient with reviews', inline: true },
                    { name: '❌ DON\'T:', value: '• Submit expired cards\n• Send fake or used cards\n• Spam or harass staff\n• Share others\' info', inline: true },
                    { name: '⚠️ WARNING', value: 'Violating rules = permanent ban! No exceptions.', inline: false },
                    { name: '💳 PAYMENT METHODS', value: 'We pay via:\n• PayPal (International)\n• Bitcoin (Worldwide)\n• Bank Transfer (Nigeria only)', inline: false },
                    { name: '⏱️ PROCESSING TIME', value: '• Review: 24 hours max\n• Payment: Instant after approval\n• Support: DM <@1478007761697509531>', inline: false },
                    { name: '📌 TIPS', value: '• Save your payment details to sell faster\n• Clear photos = faster approval\n• Check DMs regularly for updates', inline: false }
                )
                .setFooter({ text: 'CardVault • Safe & Fast Gift Card Selling' })
                .setTimestamp();

            await member.send({ embeds: [welcomeEmbed] });
            console.log(`✅ Welcome message sent to ${member.user.tag}`);
        } catch (error) {
            console.log(`❌ Could not send welcome DM to ${member.user.tag} - DMs might be closed`);
        }
    });
});

// Handle DM conversations - WITH DEBUG LOGS
async function handleDM(message) {
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
    console.log(`🔴 handleDM CALLED at ${new Date().toLocaleTimeString()}`);
    console.log(`🔴 User: ${message.author.tag} (${message.author.id})`);
    console.log(`🔴 Content: "${message.content}"`);
    console.log(`🔴 Content lowercase: "${message.content.toLowerCase().trim()}"`);
    console.log(`🔴 Is "sell"? ${message.content.toLowerCase().trim() === 'sell'}`);
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
    
    const userId = message.author.id;
    const content = message.content.toLowerCase().trim();
    
    try {
        // Check if they said "sell"
        if (content === 'sell') {
            console.log('✅ "sell" detected! Checking registration...');
            
            // Check if registered
            const userData = getUser(userId);
            console.log('📊 User data:', userData);
            
            if (!userData || !userData.registered) {
                console.log('❌ User not registered');
                return message.author.send('❌ You need to register first! Go to the server and type `!register`');
            }
            
            console.log('✅ User is registered! Sending payment options...');
            
            // Ask for payment method
            const paymentEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('💳 Choose Payment Method')
                .setDescription('How do you want to get paid?')
                .addFields(
                    { name: '1️⃣', value: 'PayPal', inline: true },
                    { name: '2️⃣', value: 'Bitcoin', inline: true },
                    { name: '3️⃣', value: 'Bank Transfer (Nigeria)', inline: true }
                )
                .setFooter({ text: 'Reply with 1, 2, or 3' });
            
            // Save session
            sessions.set(userId, { step: 1, data: {} });
            console.log('✅ Session created, step 1');
            
            // Send the message
            await message.author.send({ embeds: [paymentEmbed] });
            console.log('✅ Payment options sent!');
            return;
        }
        
        // Check if they're in a session
        if (sessions.has(userId)) {
            console.log(`🔄 User in session, step: ${sessions.get(userId).step}`);
            const session = sessions.get(userId);
            
            if (session.step === 1) {
                console.log('Step 1: Processing payment method choice');
                // Choosing payment method
                if (content === '1' || content === '2' || content === '3') {
                    const method = content === '1' ? 'paypal' : content === '2' ? 'bitcoin' : 'bank';
                    session.data.paymentMethod = method;
                    console.log(`✅ Payment method selected: ${method}`);
                    
                    // Check if they have payment details saved
                    const userData = getUser(userId);
                    
                    if (method === 'paypal' && !userData?.paypal) {
                        console.log('❌ No PayPal email set');
                        sessions.delete(userId);
                        return message.author.send('❌ You need to set your PayPal email first! Use `!paypal email@example.com` in the server.');
                    }
                    
                    if (method === 'bitcoin' && !userData?.btc) {
                        console.log('❌ No Bitcoin address set');
                        sessions.delete(userId);
                        return message.author.send('❌ You need to set your Bitcoin address first! Use `!btc your_address` in the server.');
                    }
                    
                    if (method === 'bank' && !userData?.bankName) {
                        console.log('❌ No bank details set');
                        sessions.delete(userId);
                        return message.author.send('❌ You need to set your bank details first! Use `!bank "Name" 0123456789 BankName` in the server.');
                    }
                    
                    session.step = 2;
                    console.log('✅ Moving to step 2');
                    return message.author.send(`**Great! Now tell me the card brand** (e.g., Amazon, Visa, Steam, etc.)`);
                } else {
                    console.log('❌ Invalid payment method choice');
                    return message.author.send('❌ Please reply with **1**, **2**, or **3**');
                }
            }
            
            if (session.step === 2) {
                console.log('Step 2: Saving brand');
                // Save brand
                session.data.brand = message.content;
                session.step = 3;
                console.log('✅ Moving to step 3');
                return message.author.send(`**What is the card value?** (e.g., 25, 50, 100)`);
            }
            
            if (session.step === 3) {
                console.log('Step 3: Saving value');
                // Save value
                const value = parseInt(message.content);
                if (isNaN(value) || value <= 0) {
                    console.log('❌ Invalid value');
                    return message.author.send('❌ Please enter a valid number (e.g., 25, 50, 100)');
                }
                session.data.value = value;
                session.step = 4;
                console.log('✅ Moving to step 4');
                return message.author.send(`**Please upload a CLEAR photo of the card** (Make sure the code is visible!)`);
            }
            
            if (session.step === 4) {
                console.log('Step 4: Processing image');
                // Check for image
                if (message.attachments.size === 0) {
                    console.log('❌ No image attached');
                    return message.author.send('❌ Please upload an image of the card');
                }
                
                console.log('✅ Image received, processing submission');
                // Process submission
                const image = message.attachments.first();
                const txId = 'CV-' + Date.now().toString(36).toUpperCase();
                console.log(`✅ Transaction ID: ${txId}`);
                
                // Save to database
                saveTransaction(txId, {
                    userId: userId,
                    username: message.author.username,
                    paymentMethod: session.data.paymentMethod,
                    paymentDetail: 'Saved in user profile',
                    brand: session.data.brand,
                    value: session.data.value,
                    image: image.url,
                    status: 'pending',
                    submittedAt: Date.now()
                });
                console.log('✅ Transaction saved to database');
                
                // Notify admin channel
                const adminChannel = client.channels.cache.find(c => c.name === 'admin');
                if (adminChannel) {
                    console.log('✅ Notifying admin channel');
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
                } else {
                    console.log('❌ Admin channel not found');
                }
                
                // Clear session
                sessions.delete(userId);
                console.log('✅ Session cleared');
                
                // Send confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Card Submitted!')
                    .addFields(
                        { name: 'Transaction ID', value: txId },
                        { name: 'Card', value: `${session.data.brand} - $${session.data.value}` },
                        { name: 'Status', value: '⏳ Pending Review' }
                    )
                    .setDescription('An admin will review your card shortly.');
                
                await message.author.send({ embeds: [confirmEmbed] });
                console.log('✅ Confirmation sent to user');
                return;
            }
        }
        
        // Default response
        console.log('📝 No session and not "sell", sending welcome message');
        return message.author.send('Welcome to CardVault! To sell a gift card, type **sell**');
        
    } catch (error) {
        console.error('❌❌❌ ERROR in handleDM:', error);
        return message.author.send('❌ An error occurred. Please try again.');
    }
}

// Main message handler - WITH DEBUG LOGS
client.on('messageCreate', async (message) => {
    console.log('🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵');
    console.log(`🔵 MAIN HANDLER at ${new Date().toLocaleTimeString()}`);
    console.log(`🔵 Author: ${message.author.tag}`);
    console.log(`🔵 Content: "${message.content}"`);
    console.log(`🔵 Is DM? ${message.guild === null}`);
    console.log(`🔵 Is Bot? ${message.author.bot}`);
    console.log('🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵');
    
    // Ignore bot messages
    if (message.author.bot) {
        console.log('🤖 Ignoring bot message');
        return;
    }
    
    // Handle DMs
    if (message.guild === null) {
        console.log('📨 DM DETECTED - Calling handleDM');
        await handleDM(message);
        return;
    }
    
    // Handle server commands
    console.log('📢 Server message - checking for commands');
    if (!message.content.startsWith(PREFIX)) {
        console.log('❌ No prefix, ignoring');
        return;
    }
    
    console.log('✅ Command detected');
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    console.log(`📋 Command: ${command}`);
    
    const isAdmin = message.author.id === ADMIN_ID;
    
    // Test commands
    if (command === 'ping') {
        console.log('🏓 Pong command');
        return message.reply('Pong! 🏓 Bot is working!');
    }
    
    if (command === 'dmtest') {
        console.log('📨 DM test command');
        try {
            await message.author.send('✅ DM working! CardVault can message you.');
            message.reply('Check your DMs!');
            console.log('✅ Test DM sent');
        } catch (error) {
            console.log('❌ DM test failed:', error.message);
            message.reply('❌ I could not DM you. Please enable DMs from server members.');
        }
        return;
    }
    
    // User commands
    if (command === 'register') {
        console.log('📝 Register command');
        setUser(message.author.id, {
            registered: 1,
            registeredAt: Date.now()
        });
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Registration Successful')
            .setDescription('You can now sell gift cards!')
            .addFields(
                { name: '📍 Next Step', value: 'DM the bot and type **sell** to start' },
                { name: '💳 Payment Options', value: '• PayPal\n• Bitcoin\n• Bank Transfer (Nigeria)' },
                { name: '📝 Setup Payment', value: 'Use these commands:\n`!paypal email`\n`!btc address`\n`!bank "Name" 0123456789 Bank`' }
            )
            .setFooter({ text: 'CardVault Gift Card Buyer' })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'paypal') {
        const email = args[0];
        if (!email || !email.includes('@')) {
            return message.reply('❌ Please provide a valid email. Example: `!paypal email@example.com`');
        }
        setUser(message.author.id, { paypal: email });
        return message.reply(`✅ PayPal email set to: ${email}`);
    }
    
    if (command === 'btc') {
        const address = args[0];
        if (!address || address.length < 10) {
            return message.reply('❌ Please provide a valid Bitcoin address');
        }
        setUser(message.author.id, { btc: address });
        return message.reply(`✅ Bitcoin address set to: ${address}`);
    }
    
    if (command === 'bank') {
        const accountName = args[0]?.replace(/"/g, '');
        const accountNumber = args[1];
        const bankName = args.slice(2).join(' ');
        
        if (!accountName || !accountNumber || !bankName) {
            return message.reply('❌ Usage: `!bank "Your Name" 0123456789 Bank Name`\nExample: `!bank "John Doe" 0123456789 GTBank`');
        }
        
        setUser(message.author.id, {
            bankName: accountName,
            bankNumber: accountNumber,
            bankAccount: bankName
        });
        
        return message.reply(`✅ Bank details saved:\n**${accountName}**\n${accountNumber}\n${bankName}`);
    }
    
    if (command === 'profile') {
        const user = message.mentions.users.first() || message.author;
        const userData = getUser(user.id);
        
        const paypal = userData?.paypal || '❌ Not set';
        const btc = userData?.btc || '❌ Not set';
        let bankInfo = '❌ Not set';
        
        if (userData?.bankName) {
            bankInfo = `${userData.bankName}\n${userData.bankNumber}\n${userData.bankAccount}`;
        }
        
        const totalSold = userData?.totalSold || 0;
        const totalEarned = userData?.totalEarned || 0;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`👤 ${user.username}'s Profile`)
            .addFields(
                { name: '🌍 PayPal', value: paypal, inline: false },
                { name: '₿ Bitcoin', value: btc, inline: false },
                { name: '🇳🇬 Bank Transfer', value: bankInfo, inline: false },
                { name: '💰 Cards Sold', value: `${totalSold}`, inline: true },
                { name: '💵 Total Earned', value: `$${totalEarned}`, inline: true }
            )
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'members') {
        const members = message.guild.members.cache;
        const totalMembers = members.size;
        const humans = members.filter(m => !m.user.bot).size;
        const bots = members.filter(m => m.user.bot).size;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`👥 Server Members - ${message.guild.name}`)
            .addFields(
                { name: 'Total Members', value: `${totalMembers}`, inline: true },
                { name: 'Humans', value: `${humans}`, inline: true },
                { name: 'Bots', value: `${bots}`, inline: true }
            )
            .setFooter({ text: 'CardVault Gift Card Buyer' })
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'users') {
        const members = message.guild.members.cache
            .filter(m => !m.user.bot && m.user.id !== client.user.id)
            .map(m => m.user.username)
            .slice(0, 20)
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`👤 Human Members (first 20)`)
            .setDescription(members || 'No humans found')
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    // Admin commands
    if (command === 'pending' && isAdmin) {
        try {
            const stmt = db.prepare("SELECT * FROM transactions WHERE status = 'pending' ORDER BY submittedAt DESC");
            const pending = stmt.all();
            
            if (pending.length === 0) {
                return message.reply('✅ No pending transactions!');
            }
            
            let description = '';
            pending.slice(0, 10).forEach(tx => {
                const date = new Date(tx.submittedAt).toLocaleString();
                description += `**${tx.txId}** - ${tx.brand} $${tx.value} - ${tx.username}\n${date}\n\n`;
            });
            
            if (pending.length > 10) {
                description += `\n*...and ${pending.length - 10} more*`;
            }
            
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`⏳ Pending Transactions (${pending.length})`)
                .setDescription(description)
                .setFooter({ text: 'Use !approve TXID amount or !reject TXID reason' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Database error:', error);
            return message.reply('❌ Error fetching transactions.');
        }
    }
    
    if (command === 'approve' && isAdmin) {
        const txId = args[0];
        const amount = parseInt(args[1]);
        
        if (!txId || !amount) {
            return message.reply('❌ Usage: `!approve TX-ID AMOUNT`');
        }
        
        const stmt = db.prepare('SELECT * FROM transactions WHERE txId = ?');
        const tx = stmt.get(txId);
        
        if (!tx) {
            return message.reply('❌ Transaction not found!');
        }
        
        if (tx.status !== 'pending') {
            return message.reply(`❌ This transaction is already ${tx.status}`);
        }
        
        const updateStmt = db.prepare('UPDATE transactions SET status = ?, approvedAt = ? WHERE txId = ?');
        updateStmt.run('approved', Date.now(), txId);
        
        try {
            const user = await client.users.fetch(tx.userId);
            if (user) {
                const offerEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Card Approved!')
                    .addFields(
                        { name: '🆔 Transaction', value: txId },
                        { name: '💰 Offer', value: `$${amount}` }
                    )
                    .setDescription('An admin will process payment soon.');
                
                await user.send({ embeds: [offerEmbed] });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Transaction ${txId} approved for $${amount}`);
    }
    
    if (command === 'reject' && isAdmin) {
        const txId = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        if (!txId) {
            return message.reply('❌ Usage: `!reject TX-ID REASON`');
        }
        
        const stmt = db.prepare('SELECT * FROM transactions WHERE txId = ?');
        const tx = stmt.get(txId);
        
        if (!tx) {
            return message.reply('❌ Transaction not found!');
        }
        
        if (tx.status !== 'pending') {
            return message.reply(`❌ This transaction is already ${tx.status}`);
        }
        
        const updateStmt = db.prepare('UPDATE transactions SET status = ? WHERE txId = ?');
        updateStmt.run('rejected', txId);
        
        try {
            const user = await client.users.fetch(tx.userId);
            if (user) {
                const rejectEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Card Rejected')
                    .addFields(
                        { name: '🆔 Transaction', value: txId },
                        { name: '📋 Reason', value: reason }
                    )
                    .setTimestamp();
                
                await user.send({ embeds: [rejectEmbed] });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Transaction ${txId} rejected.`);
    }
});

// Login
client.login(TOKEN);