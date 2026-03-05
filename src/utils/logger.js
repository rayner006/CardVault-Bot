/**
 * Logging Utility
 */

const { EmbedBuilder } = require('discord.js');
const { COLORS, CONFIG } = require('../config/constants');

async function logToChannel(guild, action, user, details) {
    if (!guild) return;
    
    const logChannel = guild.channels.cache.find(c => c.name === CONFIG.LOG_CHANNEL);
    if (!logChannel) return;
    
    const logEmbed = new EmbedBuilder()
        .setColor(COLORS.LOG)
        .setTitle(`📝 ${action}`)
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Time', value: new Date().toLocaleString(), inline: true },
            { name: 'Details', value: details, inline: false }
        )
        .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
}

module.exports = { logToChannel };
