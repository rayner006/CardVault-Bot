/**
 * Bot configuration and constants
 */

module.exports = {
    CONFIG: {
        TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        GUILD_ID: process.env.GUILD_ID,
        ADMIN_ID: process.env.ADMIN_ID,
        SUPPORT_ID: process.env.SUPPORT_ID || '1478007761697509531',
        LOG_CHANNEL: 'cardvault-logs'
    },
    
    CARD_BRANDS: [
        'Amazon',
        'Steam',
        'Sephora',
        'Nordstrom',
        'Walmart Visa',
        'Google Play',
        'Amex',
        'Apple',
        'Macy\'s',
        'Footlocker',
        'Nike',
        'Mastercard',
        'Xbox',
        'Razor Gold',
        'Vanilla'
    ],
    
    COOLDOWN_TIME: 3, // seconds
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    
    COLORS: {
        SUCCESS: 0x00FF00,
        ERROR: 0xFF0000,
        INFO: 0x0099FF,
        WARNING: 0xFFA500,
        LOG: 0x808080
    }
};
