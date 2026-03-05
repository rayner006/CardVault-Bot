/**
 * Slash Command Handler
 */

const { EmbedHelper } = require('../utils/embedBuilder');
const { logToChannel } = require('../utils/logger');
const { COOLDOWN_TIME } = require('../config/constants');

// Cooldowns map
const cooldowns = new Map();

async function handleSlashCommand(interaction) {
    const { commandName, options, user, client } = interaction;
    
    const isAdmin = user.id === process.env.ADMIN_ID;
    const adminCommands = ['pending', 'transaction', 'approve', 'reject', 'paid', 'logs', 'announce'];
    
    // Check admin permissions
    if (adminCommands.includes(commandName) && !isAdmin) {
        return interaction.reply({ 
            content: '❌ This command is for admins only.',
            ephemeral: true 
        });
    }
    
    // Check cooldown (skip for admin)
    if (!isAdmin) {
        const key = `${user.id}-${commandName}`;
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
        cooldowns.set(key, Date.now() + (COOLDOWN_TIME * 1000));
    }
    
    // Check if user is banned
    const userData = client.db.getUser(user.id);
    if (userData?.isBanned) {
        return interaction.reply({ 
            content: '❌ You are banned from using CardVault.',
            ephemeral: true 
        });
    }
    
    // Route to appropriate command handler
    switch (commandName) {
        case 'ping':
            await handlePing(interaction);
            break;
        case 'register':
            await handleRegister(interaction);
            break;
        case 'start':
            await handleStart(interaction);
            break;
        case 'profile':
            await handleProfile(interaction);
            break;
        case 'paypal':
            await handlePaypal(interaction);
            break;
        case 'btc':
            await handleBtc(interaction);
            break;
        case 'bank':
            await handleBank(interaction);
            break;
        case 'help':
            await handleHelp(interaction, isAdmin);
            break;
        case 'members':
            await handleMembers(interaction);
            break;
        case 'users':
            await handleUsers(interaction);
            break;
        case 'bots':
            await handleBots(interaction);
            break;
        case 'leaderboard':
            await handleLeaderboard(interaction);
            break;
        case 'pending':
            await handlePending(interaction);
            break;
        case 'transaction':
            await handleTransaction(interaction);
            break;
        case 'approve':
            await handleApprove(interaction);
            break;
        case 'reject':
            await handleReject(interaction);
            break;
        case 'paid':
            await handlePaid(interaction);
            break;
        case 'logs':
            await handleLogs(interaction);
            break;
        case 'announce':
            await handleAnnounce(interaction);
            break;
    }
    
    // Log command usage
    await logToChannel(
        interaction.guild,
        'Command Used',
        interaction.user,
        `/${interaction.commandName}`
    );
}

// Command implementations (move each from your original file)
async function handlePing(interaction) {
    await interaction.reply({
        embeds: [EmbedHelper.success(
            'Pong! 🏓',
            `Bot latency: ${Date.now() - interaction.createdTimestamp}ms\nAPI Latency: ${Math.round(interaction.client.ws.ping)}ms`
        )]
    });
}

async function handleRegister(interaction) {
    const { user, client } = interaction;
    client.db.createUser(user.id);
    
    await interaction.reply({
        embeds: [EmbedHelper.success(
            '✅ Registration Successful!',
            'You can now sell gift cards!',
            [
                { 
                    name: '💳 **STEP 1: Set Payment Method**', 
                    value: 
                    'Choose ONE of these commands:\n' +
                    '• `/paypal email:your@email.com`\n' +
                    '• `/btc address:yourBitcoinAddress`\n' +
                    '• `/bank name:"Your Name" number:0123456789 bank:BankName`', 
                    inline: false 
                },
                { 
                    name: '📝 **EXAMPLE:**', 
                    value: '`/bank name:"Sarah Johnson" number:8123456789 bank:GTBank`', 
                    inline: false 
                },
                { 
                    name: '🚀 **STEP 2: Start Selling**', 
                    value: 
                    '1. Enter `/start` in Welcome channel\n' +
                    '2. Check your DMs\n' +
                    '3. Follow the bot\'s instructions:\n' +
                    '   • Click payment button\n' +
                    '   • Select card brand\n' +
                    '   • Enter value\n' +
                    '   • Upload photo', 
                    inline: false 
                }
            ]
        )]
    });
}

async function handleStart(interaction) {
    const { user, client } = interaction;
    
    try {
        const registered = client.db.getUser(user.id);
        if (!registered || !registered.registered) {
            return interaction.reply({ 
                content: '❌ You need to register first! Use `/register`',
                ephemeral: true 
            });
        }
        
        // Check if at least one payment method is set
        if (!registered.paypal && !registered.btc && !registered.bankName) {
            return interaction.reply({ 
                content: '❌ You need to set a payment method first! Use `/paypal`, `/btc`, or `/bank`',
                ephemeral: true 
            });
        }
        
        // Create payment method selection buttons
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                    .setEmoji('🪙'),
                new ButtonBuilder()
                    .setCustomId('sell_bank')
                    .setLabel('Bank Transfer')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏦')
            );
        
        await user.send({
            content: '👋 **Welcome to CardVault!**\n\nClick a button below to choose your payment method:',
            components: [row]
        });
        
        await interaction.reply({ 
            content: '✅ **DM opened!** Check your DMs to start selling.',
            ephemeral: true 
        });
        
    } catch (error) {
        console.error('[START ERROR]', error);
        await interaction.reply({ 
            content: '❌ Could not DM you. Please enable DMs from server members.',
            ephemeral: true 
        });
    }
}

async function handleProfile(interaction) {
    const { user, options, client } = interaction;
    const targetUser = options.getUser('user') || user;
    const profileData = client.db.getUser(targetUser.id);
    
    if (!profileData) {
        return interaction.reply({ 
            content: `❌ ${targetUser.username} is not registered.`,
            ephemeral: true 
        });
    }
    
    const transactions = client.db.getUserTransactions(targetUser.id);
    const recentTx = transactions.length > 0 ? transactions[0] : null;
    
    const { EmbedBuilder } = require('discord.js');
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
}

async function handlePaypal(interaction) {
    const { user, options, client } = interaction;
    const email = options.getString('email');
    
    if (!email.includes('@')) {
        return interaction.reply({ 
            content: '❌ Please provide a valid email address.',
            ephemeral: true 
        });
    }
    
    client.db.setPaymentMethod(user.id, 'paypal', email);
    
    await interaction.reply({
        embeds: [EmbedHelper.success(
            'PayPal Email Set',
            `✅ Your PayPal email has been set to: **${email}**`
        )]
    });
}

async function handleBtc(interaction) {
    const { user, options, client } = interaction;
    const address = options.getString('address');
    
    if (address.length < 10) {
        return interaction.reply({ 
            content: '❌ Please provide a valid Bitcoin address.',
            ephemeral: true 
        });
    }
    
    client.db.setPaymentMethod(user.id, 'btc', address);
    
    await interaction.reply({
        embeds: [EmbedHelper.success(
            'Bitcoin Address Set',
            `✅ Your Bitcoin address has been set to: **${address}**`
        )]
    });
}

async function handleBank(interaction) {
    const { user, options, client } = interaction;
    const accountName = options.getString('name');
    const accountNumber = options.getString('number');
    const bankName = options.getString('bank');
    
    if (!/^\d+$/.test(accountNumber)) {
        return interaction.reply({ 
            content: '❌ Account number should contain only numbers!',
            ephemeral: true 
        });
    }
    
    client.db.setPaymentMethod(user.id, 'bank', `${accountName}|${accountNumber}|${bankName}`);
    
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
}

async function handleHelp(interaction, isAdmin) {
    const { EmbedBuilder } = require('discord.js');
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
            { name: '🎮 **Accepted Cards**', value: 
                'Amazon • Steam • Sephora • Nordstrom • Walmart Visa • Google Play • Amex • Apple • Macy\'s • Footlocker • Nike • Mastercard • Xbox • Razor Gold • Vanilla', 
                inline: false },
            { name: '📊 **Server Info**', value: 
                '`/members` - Member stats\n' +
                '`/users` - List humans\n' +
                '`/bots` - List bots\n' +
                '`/leaderboard` - Top sellers', 
                inline: false },
            { name: '📍 **Where to Type**', value: 
                'All commands must be typed in **#👋-welcome** channel', 
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
}

async function handleMembers(interaction) {
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
}

async function handleUsers(interaction) {
    const humanList = interaction.guild.members.cache
        .filter(m => !m.user.bot && m.user.id !== interaction.client.user.id)
        .map(m => m.user.username)
        .slice(0, 20)
        .join('\n');
    
    await interaction.reply({
        embeds: [EmbedHelper.info(
            '👤 Human Members',
            humanList || 'No humans found'
        )]
    });
}

async function handleBots(interaction) {
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
}

async function handleLeaderboard(interaction) {
    const { client } = interaction;
    const topSellers = client.db.getTopSellers(10);
    
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
}

async function handlePending(interaction) {
    const { client } = interaction;
    const pending = client.db.getPendingTransactions();
    
    if (pending.length === 0) {
        return interaction.reply('✅ No pending transactions!');
    }
    
    const { EmbedBuilder } = require('discord.js');
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
}

async function handleTransaction(interaction) {
    const { options, client } = interaction;
    const txId = options.getString('id');
    const tx = client.db.getTransaction(txId);
    
    if (!tx) {
        return interaction.reply({ 
            content: '❌ Transaction not found!',
            ephemeral: true 
        });
    }
    
    const { EmbedBuilder } = require('discord.js');
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
}

async function handleApprove(interaction) {
    const { options, client } = interaction;
    const approveId = options.getString('id');
    const amount = options.getInteger('amount');
    
    const approveTx = client.db.getTransaction(approveId);
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
    
    client.db.updateTransactionStatus(approveId, 'approved');
    client.db.updateTransactionOffer(approveId, amount);
    
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
}

async function handleReject(interaction) {
    const { options, client } = interaction;
    const rejectId = options.getString('id');
    const reason = options.getString('reason') || 'No reason provided';
    
    const rejectTx = client.db.getTransaction(rejectId);
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
    
    client.db.updateTransactionStatus(rejectId, 'rejected', reason);
    
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
}

async function handlePaid(interaction) {
    const { options, client } = interaction;
    const paidId = options.getString('id');
    
    const paidTx = client.db.getTransaction(paidId);
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
    
    client.db.updateTransactionStatus(paidId, 'paid');
    client.db.incrementUserStats(paidTx.userId, paidTx.value);
    
    try {
        const userObj = await client.users.fetch(paidTx.userId);
        if (userObj) {
            await userObj.send({
                embeds: [EmbedHelper.success(
                    'Paid (Approved)',
                    `Your card has been approved and payment has been sent.`,
                    [
                        { name: 'Transaction', value: paidId, inline: true },
                        { name: 'Card Amount', value: `$${paidTx.value}`, inline: true },
                        { name: 'Offer Paid', value: `$${paidTx.offerAmount || paidTx.value}`, inline: true }
                    ]
                )]
            });
        }
    } catch (error) {
        console.log('Could not DM user');
    }
    
    await interaction.reply(`✅ Payment for ${paidId} marked as sent.`);
}

async function handleLogs(interaction) {
    const { options, client } = interaction;
    const limit = options.getInteger('limit') || 20;
    const logs = client.db.getRecentLogs(limit);
    
    const { EmbedBuilder } = require('discord.js');
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
}

async function handleAnnounce(interaction) {
    const { options, client } = interaction;
    const announcement = options.getString('message');
    
    await interaction.reply({
        content: '📢 Sending announcement to all users...',
        ephemeral: true
    });
    
    const allUsers = client.db.db.prepare('SELECT userId FROM users').all();
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
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`Could not DM user ${u.userId}`);
        }
    }
    
    await interaction.followUp({
        content: `✅ Announcement sent to ${sentCount} users.`,
        ephemeral: true
    });
}

module.exports = { handleSlashCommand };
