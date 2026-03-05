/**
 * DM Message Handler (for image uploads and receipt replies)
 */

const { EmbedBuilder } = require('discord.js');
const { EmbedHelper } = require('../utils/embedBuilder');

async function handleMessage(message) {
    if (message.author.bot) return;
    
    // ===== NEW: Check if this is a receipt reply =====
    if (message.guild === null && message.client.pendingReceipts?.has(message.author.id)) {
        return handleReceiptReply(message);
    }
    
    // ===== EXISTING: Normal card selling flow =====
    if (message.guild !== null) return; // Only DMs for selling flow
    
    const userId = message.author.id;
    const session = message.client.sessions.get(userId);
    
    if (!session || session.step !== 3) return;
    
    // Check for image attachment
    if (message.attachments.size === 0) {
        return message.reply('❌ Please upload an image of the card.\n\n📱 **Tap the + button to attach your photo**');
    }
    
    const image = message.attachments.first();
    
    if (!image.contentType?.startsWith('image/')) {
        return message.reply('❌ Please upload a valid image file.');
    }
    
    const txId = await message.client.db.createTransaction({
        userId,
        username: message.author.username,
        paymentMethod: session.data.paymentMethod,
        paymentDetail: session.data.paymentDetail,
        brand: session.data.brand,
        value: session.data.value,
        image: image.url
    });
    
    // Notify admin channel
    message.client.guilds.cache.forEach(async (guild) => {
        const adminChannel = guild.channels.cache.find(c => c.name === 'admin');
        if (adminChannel) {
            const adminEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🆕 New Gift Card Submission')
                .addFields(
                    { name: '🆔 Transaction', value: txId, inline: false },
                    { name: '👤 User', value: message.author.username, inline: true },
                    { name: '💳 Payment Method', value: session.data.paymentMethod, inline: true },
                    { name: '💳 Payment Details', value: session.data.paymentDetail || 'Not provided', inline: false },
                    { name: '📦 Card', value: `${session.data.brand} - $${session.data.value}`, inline: true }
                )
                .setImage(image.url)
                .setFooter({ text: `User ID: ${userId}` })
                .setTimestamp();
            
            await adminChannel.send({ embeds: [adminEmbed] });
            
            await adminChannel.send({ 
                content: `@here **New card ready for review!**\n\n` +
                         `**To APPROVE:** \`/approve id:${txId} amount:XX\`\n` +
                         `**To REJECT:** \`/reject id:${txId} reason:your reason\`\n\n` +
                         `**Example:** \`/approve id:${txId} amount:50\``
            });
        }
    });
    
    // Clear session
    message.client.sessions.delete(userId);
    
    // Confirm to user
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
    
    await message.client.db.log('card_submitted', userId, `Submitted ${session.data.brand} - $${session.data.value}`);
}

// ===== NEW: Handle receipt replies from users =====
async function handleReceiptReply(message) {
    const pendingReceipt = message.client.pendingReceipts.get(message.author.id);
    
    // Check for image attachment
    if (message.attachments.size === 0) {
        return message.reply('❌ Please upload an image of the receipt.\n\n📱 **Tap the + button to attach your photo**');
    }
    
    const image = message.attachments.first();
    
    if (!image.contentType?.startsWith('image/')) {
        return message.reply('❌ Please upload a valid image file.');
    }
    
    // Get transaction details
    const tx = await message.client.db.getTransaction(pendingReceipt.txId);
    
    // Notify admin channel
    message.client.guilds.cache.forEach(async (guild) => {
        const adminChannel = guild.channels.cache.find(c => c.name === 'admin');
        if (adminChannel) {
            const receiptEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🧾 Receipt Received')
                .setDescription(`Receipt for transaction **${pendingReceipt.txId}**`)
                .addFields(
                    { name: '👤 User', value: `${message.author.username} (${message.author.id})`, inline: true },
                    { name: '💳 Card', value: tx ? `${tx.brand} - $${tx.value}` : 'Unknown', inline: true },
                    { name: '📅 Requested by', value: `<@${pendingReceipt.requestedBy}>`, inline: true }
                )
                .setImage(image.url)
                .setTimestamp();
            
            await adminChannel.send({ embeds: [receiptEmbed] });
            
            // Also send a ping to the admin who requested it
            await adminChannel.send({
                content: `<@${pendingReceipt.requestedBy}> receipt received for **${pendingReceipt.txId}**`
            });
        }
    });
    
    // Clear pending receipt
    message.client.pendingReceipts.delete(message.author.id);
    
    // Confirm to user
    await message.reply('✅ Receipt received! Admin has been notified.');
    
    // Log
    await message.client.db.log('receipt_received', message.author.id, `Uploaded receipt for ${pendingReceipt.txId}`);
}

module.exports = { handleMessage };
