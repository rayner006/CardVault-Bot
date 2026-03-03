const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Simple Test Bot is running!');
});

app.listen(port, () => {
    console.log('🌐 Web server started');
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;

client.once('ready', () => {
    console.log('✅ SIMPLE TEST BOT IS READY!');
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🆔 ID: ${client.user.id}`);
});

// ONE SINGLE MESSAGE HANDLER - NO EXTRA CODE
client.on('messageCreate', (message) => {
    console.log(`📨 Got message: "${message.content}" from ${message.author.tag}`);
    
    // Ignore bots
    if (message.author.bot) return;
    
    // ALWAYS reply to DMs
    if (message.guild === null) {
        console.log('💬 DM detected, replying...');
        message.reply(`You said: "${message.content}"`)
            .then(() => console.log('✅ Reply sent!'))
            .catch(err => console.log('❌ Reply failed:', err.message));
    }
    
    // Reply to !ping in server
    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
    }
});

client.login(TOKEN).catch(err => {
    console.error('❌ Login failed:', err.message);
});