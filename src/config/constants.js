/**
 * Bot configuration and constants
 */

module.exports = {
    CONFIG: {
        TOKEN: process.env.DISCORD_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        GUILD_ID: process.env.GUILD_ID,
        ADMIN_ID: process.env.ADMIN_ID,
        SUPPORT_ID: process.env.SUPPORT_ID,
        LOG_CHANNEL: 'cardvault-logs'
    },
    
    // Same cards, just with country variants
    CARD_BRANDS: [
        'Amazon',      // Available in: US, UK, CA, AU, EU
        'Steam',       // Available in: US, UK, CA, AU, EU
        'Sephora',     // Available in: US, CA, EU
        'Nordstrom',   // Available in: US
        'Walmart',     // Available in: US, CA
        'Google Play', // Available in: US, UK, CA, AU, EU
        'Amex',        // Available in: US, CA, AU, EU
        'Apple',       // Available in: US, UK, CA, AU, EU
        'Macy\'s',     // Available in: US
        'Footlocker',  // Available in: US, UK, CA, AU, EU
        'Nike',        // Available in: US, UK, CA, AU, EU
        'Mastercard',  // Available in: US, UK, CA, AU, EU
        'Xbox',        // Available in: US, UK, CA, AU, EU
        'Razor Gold',  // Available in: US, UK, AU, EU
        'Vanilla'      // Available in: US, CA
    ],
    
    // Country availability mapping
    COUNTRY_AVAILABILITY: {
        'US': ['Amazon', 'Steam', 'Sephora', 'Nordstrom', 'Walmart', 'Google Play', 'Amex', 'Apple', 'Macy\'s', 'Footlocker', 'Nike', 'Mastercard', 'Xbox', 'Razor Gold', 'Vanilla'],
        'UK': ['Amazon', 'Steam', 'Google Play', 'Apple', 'Footlocker', 'Nike', 'Mastercard', 'Xbox', 'Razor Gold'],
        'CANADA': ['Amazon', 'Steam', 'Sephora', 'Walmart', 'Google Play', 'Amex', 'Apple', 'Footlocker', 'Nike', 'Mastercard', 'Xbox', 'Vanilla'],
        'AUSTRALIA': ['Amazon', 'Steam', 'Google Play', 'Amex', 'Apple', 'Footlocker', 'Nike', 'Mastercard', 'Xbox', 'Razor Gold'],
        'EURO': ['Amazon', 'Steam', 'Sephora', 'Google Play', 'Amex', 'Apple', 'Footlocker', 'Nike', 'Mastercard', 'Xbox', 'Razor Gold']
    },
    
    // Currency mapping
    CURRENCIES: {
        'US': 'USD',
        'UK': 'GBP',
        'CANADA': 'CAD',
        'AUSTRALIA': 'AUD',
        'EURO': 'EUR'
    },
    
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
