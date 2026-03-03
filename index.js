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

// ============================================
// DEBUGGING SECTION - WILL LOG ALL DMs
// ============================================
client.on('messageCreate', (message) => {
    // Log ALL messages for debugging
    console.log('\n' + '🔍'.repeat(30));
    console.log(`🔍 DEBUG: Message received at ${new Date().toLocaleTimeString()}`);
    console.log(`   Author: ${message.author.tag} (${message.author.id})`);
    console.log(`   Content: "${message.content}"`);
    console.log(`   Is DM? ${message.guild === null ? 'YES 🔥' : 'NO'}`);
    console.log(`   Channel: ${message.guild ? message.guild.name : 'DM'}`);
    console.log('🔍'.repeat(30) + '\n');

    // If it's a DM and not from a bot, send a test reply
    if (message.guild === null && !message.author.bot) {
        console.log('🎯🎯🎯 DM DETECTED BY DEBUGGER! 🎯🎯🎯');
        
        // Send a test reply to confirm DM works
        message.reply(`🔍 **DEBUG BOT HERE!**\n\nI received your message: "${message.content}"\n\nYour main bot will now process this. If you don't get a proper response, the issue is in the main bot code, not Discord.`)
            .then(() => console.log('✅ DEBUG: Test reply sent successfully!'))
            .catch(err => console.log('❌ DEBUG: Could not send reply:', err.message));
    }
});
// ============================================
// END DEBUGGING SECTION
// ============================================

// Handle DM conversations
async function handleDM(message) {
    console.log('='.repeat(50));
    console.log('🚨 MAIN BOT: handleDM FUNCTION WAS CALLED!');
    console.log('='.repeat(50));
    console.log(`User: ${message.author.tag} (${message.author.id})`);
    console.log(`Message content: "${message.content}"`);
    
    const userId = message.author.id;
    
    try {
        // Check if user is in a selling session
        if (!sessions.has(userId)) {
            console.log('📌 No active session found for user');
            
            // Start new session if they type 'sell'
            if (message.content.toLowerCase() === 'sell') {
                console.log('✅ User typed "sell" - starting new session');
                
                // Check if registered
                console.log('🔍 Checking registration for user:', userId);
                const userData = getUser(userId);
                console.log('📊 User data from database:', userData);
                
                if (!userData) {
                    console.log('❌ User has NO data in database at all');
                    return message.reply('❌ You need to register first! Go to the server and type `!register`');
                }
                
                if (!userData.registered) {
                    console.log('❌ User found but not registered (registered =', userData.registered, ')');
                    return message.reply('❌ You need to register first! Go to the server and type `!register`');
                }
                
                console.log('✅ User is registered! Creating session...');
                sessions.set(userId, { step: 1, data: {} });
                
                // Ask for payment method first
                const paymentEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('💳 Choose Payment Method')
                    .setDescription('How do you want to get paid?')
                    .addFields(
                        { name: '1️⃣', value: 'PayPal (International)', inline: true },
                        { name: '2️⃣', value: 'Bitcoin (Crypto)', inline: true },
                        { name: '3️⃣', value: 'Bank Transfer (Nigeria)', inline: true }
                    )
                    .setFooter({ text: 'Reply with 1, 2, or 3' });
                
                console.log('📤 Sending payment method embed to user');
                return message.reply({ embeds: [paymentEmbed] });
            } else {
                console.log('📝 User did not type "sell", sending welcome message');
                return message.reply('Welcome to CardVault! To sell a gift card, type **sell**');
            }
        }
        
        // Continue existing session
        console.log('🔄 User has active session, step:', sessions.get(userId).step);
        const session = sessions.get(userId);
        
        switch (session.step) {
            case 1: // Get payment method
                console.log('Step 1: Getting payment method, user replied:', message.content);
                const method = message.content.trim();
                if (!['1', '2', '3'].includes(method)) {
                    console.log('❌ Invalid payment method choice');
                    return message.reply('❌ Please reply with **1** (PayPal), **2** (Bitcoin), or **3** (Bank Transfer)');
                }
                
                session.data.paymentMethod = method === '1' ? 'paypal' : method === '2' ? 'bitcoin' : 'bank';
                console.log('✅ Payment method selected:', session.data.paymentMethod);
                
                const userData = getUser(userId);
                console.log('Checking payment details for user:', userData);
                
                if (session.data.paymentMethod === 'paypal') {
                    if (!userData?.paypal) {
                        console.log('❌ No PayPal email set');
                        return message.reply('❌ You haven\'t set your PayPal email! Use `!paypal email@example.com` in the server first.\n\nType **cancel** to end this session.');
                    }
                    session.data.paymentDetail = userData.paypal;
                    console.log('✅ PayPal email found:', userData.paypal);
                }
                
                if (session.data.paymentMethod === 'bitcoin') {
                    if (!userData?.btc) {
                        console.log('❌ No Bitcoin address set');
                        return message.reply('❌ You haven\'t set your Bitcoin address! Use `!btc your_address` in the server first.\n\nType **cancel** to end this session.');
                    }
                    session.data.paymentDetail = userData.btc;
                    console.log('✅ Bitcoin address found:', userData.btc);
                }
                
                if (session.data.paymentMethod === 'bank') {
                    if (!userData?.bankName) {
                        console.log('❌ No bank details set');
                        return message.reply('❌ You haven\'t set your bank details! Use `!bank "Name" 0123456789 BankName` in the server first.\n\nType **cancel** to end this session.');
                    }
                    session.data.paymentDetail = `${userData.bankName} | ${userData.bankNumber} | ${userData.bankAccount}`;
                    console.log('✅ Bank details found:', session.data.paymentDetail);
                }
                
                session.step = 2;
                console.log('Moving to step 2 - asking for brand');
                const brandList = [
                    '**Amazon**', '**Visa**', '**Mastercard**', '**Amex**',
                    '**Steam**', '**Xbox**', '**Razer Gold**', '**Google Play**', 
                    '**Apple**', '**iTunes**', '**Spotify**', '**Vanilla**',
                    '**Sephora**', '**Nordstrom**', '**Macy**',
                    '**Walmart**', '**Target**', '**Nike**', '**Footlocker**',
                ];

                const row1 = brandList.slice(0, 4).join(' • ');
                const row2 = brandList.slice(4, 8).join(' • ');
                const row3 = brandList.slice(8, 12).join(' • ');
                const row4 = brandList.slice(12, 16).join(' • ');
                const row5 = brandList.slice(16, 20).join(' • ');

                await message.reply(
                    `**2️⃣ What brand is the card?**\n\n` +
                    `${row1}\n` +
                    `${row2}\n` +
                    `${row3}\n` +
                    `${row4}\n` +
                    `${row5}\n\n` +
                    `*Type the brand name or **cancel** to stop.*`
                );
                break;
                
            case 2: // Get brand
                console.log('Step 2: Getting brand, user replied:', message.content);
                if (message.content.toLowerCase() === 'cancel') {
                    console.log('User cancelled session');
                    sessions.delete(userId);
                    return message.reply('❌ Selling cancelled.');
                }
                
                session.data.brand = message.content;
                session.step = 3;
                console.log('Moving to step 3 - asking for value');
                await message.reply(`**3️⃣ What is the value?**\n(e.g., 25, 50, 100)\n\nType **cancel** to stop.`);
                break;
                
            case 3: // Get value
                console.log('Step 3: Getting value, user replied:', message.content);
                if (message.content.toLowerCase() === 'cancel') {
                    console.log('User cancelled session');
                    sessions.delete(userId);
                    return message.reply('❌ Selling cancelled.');
                }
                
                const value = parseInt(message.content);
                if (isNaN(value) || value <= 0) {
                    console.log('❌ Invalid value entered');
                    return message.reply('❌ Please enter a valid number (e.g., 25, 50, 100)\n\nType **cancel** to stop.');
                }
                session.data.value = value;
                session.step = 4;
                console.log('Moving to step 4 - asking for image');
                await message.reply(`**4️⃣ Please upload a CLEAR photo of the gift card**\nMake sure the code is visible!\n\nType **cancel** to stop.`);
                break;
                
            case 4: // Get image
                console.log('Step 4: Getting image, attachments count:', message.attachments.size);
                if (message.content.toLowerCase() === 'cancel') {
                    console.log('User cancelled session');
                    sessions.delete(userId);
                    return message.reply('❌ Selling cancelled.');
                }
                
                if (message.attachments.size === 0) {
                    console.log('❌ No image attached');
                    return message.reply('❌ Please upload an image of the gift card\n\nType **cancel** to stop.');
                }
                
                const image = message.attachments.first();
                session.data.image = image.url;
                console.log('✅ Image received:', image.url);
                
                const txId = 'CV-' + Date.now().toString(36).toUpperCase();
                console.log('Generated transaction ID:', txId);
                
                let paymentMethodDisplay = '';
                switch(session.data.paymentMethod) {
                    case 'paypal':
                        paymentMethodDisplay = '💳 PayPal';
                        break;
                    case 'bitcoin':
                        paymentMethodDisplay = '₿ Bitcoin';
                        break;
                    case 'bank':
                        paymentMethodDisplay = '🇳🇬 Bank Transfer';
                        break;
                }
                
                console.log('💾 Saving transaction to database...');
                saveTransaction(txId, {
                    userId: userId,
                    username: message.author.username,
                    paymentMethod: session.data.paymentMethod,
                    paymentDetail: session.data.paymentDetail,
                    brand: session.data.brand,
                    value: session.data.value,
                    image: session.data.image,
                    status: 'pending',
                    submittedAt: Date.now()
                });
                console.log('✅ Transaction saved');
                
                console.log('Looking for admin channel...');
                const adminChannel = client.channels.cache.find(c => c.name === 'admin');
                if (adminChannel) {
                    console.log('✅ Admin channel found, sending notification');
                    const adminEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('🆕 New Gift Card Submission')
                        .addFields(
                            { name: '🆔 Transaction', value: txId, inline: true },
                            { name: '👤 User', value: message.author.username, inline: true },
                            { name: '💳 Payment', value: paymentMethodDisplay, inline: true },
                            { name: '📦 Card', value: `${session.data.brand} - $${session.data.value}`, inline: true },
                            { name: '📍 Payment Details', value: session.data.paymentDetail, inline: false }
                        )
                        .setImage(image.url)
                        .setFooter({ text: `User ID: ${userId}` })
                        .setTimestamp();
                    
                    await adminChannel.send({ embeds: [adminEmbed] });
                    await adminChannel.send(`@here New card ready for review! Use \`!approve ${txId} 40\` or \`!reject ${txId} reason\``);
                } else {
                    console.log('❌ Admin channel not found! Make sure you have a channel named #admin');
                }
                
                sessions.delete(userId);
                console.log('Session cleared');
                
                console.log('Sending confirmation to user');
                const confirmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Gift Card Submitted!')
                    .addFields(
                        { name: '🆔 Transaction ID', value: txId },
                        { name: '📦 Card', value: `${session.data.brand} - $${session.data.value}`, inline: true },
                        { name: '💳 Payment Method', value: paymentMethodDisplay, inline: true },
                        { name: '📍 Status', value: '⏳ Pending Review' }
                    )
                    .setDescription('An admin will review your card shortly. You will be notified when approved.')
                    .setTimestamp();
                
                await message.reply({ embeds: [confirmEmbed] });
                console.log('✅ Transaction flow complete!');
                break;
        }
    } catch (error) {
        console.error('❌ ERROR in handleDM:', error);
        return message.reply('❌ An error occurred. Please try again later.');
    }
}

// MAIN MESSAGE HANDLER
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Handle DM messages
    if (message.guild === null) {
        console.log('🎯 MAIN BOT: DM detected, calling handleDM');
        await handleDM(message);
        return;
    }
    
    // Handle server commands
    if (!message.content.startsWith(PREFIX)) return;
    
    console.log('📢 MAIN BOT: Command detected in server');
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    const isAdmin = message.author.id === ADMIN_ID;
    
    // Test commands
    if (command === 'ping') {
        return message.reply('Pong! 🏓 Bot is working!');
    }
    
    if (command === 'dmtest') {
        try {
            await message.author.send('✅ DM working! CardVault can message you.');
            message.reply('Check your DMs!');
        } catch (error) {
            message.reply('❌ I could not DM you. Please enable DMs from server members.');
        }
        return;
    }
    
    // User commands
    if (command === 'register') {
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
    
    if (command === 'online') {
        const members = message.guild.members.cache;
        const online = members.filter(m => m.presence?.status === 'online').size;
        const idle = members.filter(m => m.presence?.status === 'idle').size;
        const dnd = members.filter(m => m.presence?.status === 'dnd').size;
        const offline = members.filter(m => !m.presence || m.presence?.status === 'offline').size;
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`🟢 Online Status - ${message.guild.name}`)
            .addFields(
                { name: '🟢 Online', value: `${online}`, inline: true },
                { name: '🟡 Idle', value: `${idle}`, inline: true },
                { name: '🔴 Do Not Disturb', value: `${dnd}`, inline: true },
                { name: '⚫ Offline', value: `${offline}`, inline: true }
            )
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
    
    if (command === 'bots') {
        const bots = message.guild.members.cache
            .filter(m => m.user.bot)
            .map(m => m.user.username)
            .slice(0, 20)
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🤖 Bots in Server (first 20)`)
            .setDescription(bots || 'No bots found')
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
                .setDescription(description || 'None')
                .setFooter({ text: 'Use !approve TXID amount or !reject TXID reason' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Database error:', error);
            return message.reply('❌ Error fetching transactions. Check the console.');
        }
    }
    
    if (command === 'transaction' && isAdmin) {
        const txId = args[0];
        if (!txId) {
            return message.reply('❌ Usage: `!transaction TX-ID`');
        }
        
        const stmt = db.prepare('SELECT * FROM transactions WHERE txId = ?');
        const tx = stmt.get(txId);
        
        if (!tx) {
            return message.reply('❌ Transaction not found!');
        }
        
        let paymentMethodDisplay = '';
        switch(tx.paymentMethod) {
            case 'paypal': paymentMethodDisplay = '💳 PayPal'; break;
            case 'bitcoin': paymentMethodDisplay = '₿ Bitcoin'; break;
            case 'bank': paymentMethodDisplay = '🇳🇬 Bank Transfer'; break;
        }
        
        const date = new Date(tx.submittedAt).toLocaleString();
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📋 Transaction: ${tx.txId}`)
            .addFields(
                { name: '👤 User', value: tx.username, inline: true },
                { name: '📦 Card', value: `${tx.brand} - $${tx.value}`, inline: true },
                { name: '💳 Payment', value: paymentMethodDisplay, inline: true },
                { name: '📍 Payment Details', value: tx.paymentDetail, inline: false },
                { name: '📊 Status', value: tx.status, inline: true },
                { name: '📅 Submitted', value: date, inline: true }
            )
            .setImage(tx.image)
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'approve' && isAdmin) {
        const txId = args[0];
        const amount = parseInt(args[1]);
        
        if (!txId || !amount) {
            return message.reply('❌ Usage: `!approve TX-ID AMOUNT`\nExample: `!approve CV-ABC123 40`');
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
                        { name: '🆔 Transaction', value: txId, inline: true },
                        { name: '📦 Card', value: `${tx.brand} - $${tx.value}`, inline: true },
                        { name: '💰 Our Offer', value: `$${amount}`, inline: true }
                    )
                    .setDescription(`We offer $${amount} for your gift card.\n\nAn admin will process payment soon.`)
                    .setTimestamp();
                
                await user.send({ embeds: [offerEmbed] });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Card Approved')
            .addFields(
                { name: '🆔 Transaction', value: txId, inline: true },
                { name: '💰 Offer', value: `$${amount}`, inline: true },
                { name: '👤 User', value: tx.username, inline: true }
            )
            .setDescription(`User has been notified. Use \`!paid ${txId}\` after sending payment.`)
            .setTimestamp();
        
        return message.reply({ embeds: [confirmEmbed] });
    }
    
    if (command === 'reject' && isAdmin) {
        const txId = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        if (!txId) {
            return message.reply('❌ Usage: `!reject TX-ID REASON`\nExample: `!reject CV-ABC123 Invalid card`');
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
                        { name: '🆔 Transaction', value: txId, inline: true },
                        { name: '📦 Card', value: `${tx.brand} - $${tx.value}`, inline: true },
                        { name: '📋 Reason', value: reason, inline: false }
                    )
                    .setDescription('Your gift card could not be accepted.')
                    .setTimestamp();
                
                await user.send({ embeds: [rejectEmbed] });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Transaction ${txId} rejected. User notified.`);
    }
    
    if (command === 'paid' && isAdmin) {
        const txId = args[0];
        
        if (!txId) {
            return message.reply('❌ Usage: `!paid TX-ID`');
        }
        
        const stmt = db.prepare('SELECT * FROM transactions WHERE txId = ?');
        const tx = stmt.get(txId);
        
        if (!tx) {
            return message.reply('❌ Transaction not found!');
        }
        
        if (tx.status !== 'approved') {
            return message.reply(`❌ This transaction is ${tx.status}. It needs to be approved first.`);
        }
        
        const updateStmt = db.prepare('UPDATE transactions SET status = ?, paidAt = ? WHERE txId = ?');
        updateStmt.run('paid', Date.now(), txId);
        
        const userData = getUser(tx.userId);
        if (userData) {
            const totalSold = (userData.totalSold || 0) + 1;
            const totalEarned = (userData.totalEarned || 0) + tx.value;
            setUser(tx.userId, { totalSold, totalEarned });
        }
        
        try {
            const user = await client.users.fetch(tx.userId);
            if (user) {
                const paidEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('💰 Payment Sent!')
                    .addFields(
                        { name: '🆔 Transaction', value: txId, inline: true },
                        { name: '💳 Payment Method', value: tx.paymentMethod, inline: true }
                    )
                    .setDescription(`Your payment has been sent to:\n${tx.paymentDetail}\n\nThank you for selling with CardVault!`)
                    .setTimestamp();
                
                await user.send({ embeds: [paidEmbed] });
            }
        } catch (error) {
            console.log('Could not DM user');
        }
        
        return message.reply(`✅ Payment for ${txId} marked as sent. User notified.`);
    }
    
    // Help for non-admins trying admin commands
    if ((command === 'approve' || command === 'reject' || command === 'paid' || command === 'pending' || command === 'transaction') && !isAdmin) {
        return message.reply('❌ You do not have permission to use admin commands.');
    }
});

// Login
client.login(TOKEN);