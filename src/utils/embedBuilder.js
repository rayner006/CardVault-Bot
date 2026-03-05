/**
 * Embed Builder Helper
 */

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

class EmbedHelper {
    static success(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`✅ ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        fields.forEach(field => embed.addFields(field));
        return embed;
    }

    static error(title, description) {
        return new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setTimestamp();
    }

    static info(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        fields.forEach(field => embed.addFields(field));
        return embed;
    }

    static warning(title, description) {
        return new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`⚠️ ${title}`)
            .setDescription(description)
            .setTimestamp();
    }
}

module.exports = { EmbedHelper };
