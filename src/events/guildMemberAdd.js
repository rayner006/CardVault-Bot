/**
 * Guild Member Add Event Handler
 */

const { EmbedBuilder } = require('discord.js');
const { logToChannel } = require('../utils/logger');

async function handleGuildMemberAdd(member) {
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
                    name: '📝 EXAMPLE:', 
                    value: `\`/bank name:"Sarah Johnson" number:8123456789 bank:GTBank\``, 
                    inline: false 
                },
                { 
                    name: '📍 Where to Type Commands', 
                    value: `All commands must be typed in **#👋-welcome** channel - that's the only channel where you can send messages!`, 
                    inline: false 
                },
                { 
                    name: 'Step 3: 🚀 Start Selling', 
                    value: `Type \`/start\` in the server to open a DM, then follow the buttons`, 
                    inline: false 
                },
                { 
                    name: 'Step 4: 📋 Check Commands', 
                    value: `Visit <#📜-cardvault-commands> for all available commands`, 
                    inline: false 
                },
                { 
                    name: '🎮 ACCEPTED CARDS:', 
                    value: 'Amazon • Steam • Sephora • Nordstrom • Walmart Visa • Google Play • Amex • Apple • Macy\'s • Footlocker • Nike • Mastercard • Xbox • Razor Gold • Vanilla', 
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
        await logToChannel(member.guild, 'New Member Joined', member.user, 'Welcome DM sent');
        console.log(`[WELCOME] Message sent to ${member.user.tag}`);
    } catch (error) {
        console.log(`[WELCOME] Could not send DM to ${member.user.tag} - DMs closed`);
    }
}

module.exports = { handleGuildMemberAdd };
