/**
 * Country Selection Handler
 */

const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COUNTRY_AVAILABILITY, CURRENCIES } = require('../config/constants');

async function handleCountrySelect(interaction) {
    const { user, values, client } = interaction;
    const country = values[0];
    const session = client.sessions.get(user.id);
    
    if (!session) {
        return interaction.reply({ 
            content: '❌ Session expired. Please use `/start` again.',
            ephemeral: true 
        });
    }
    
    // Save country and currency to session
    session.data.country = country;
    session.data.currency = CURRENCIES[country] || 'USD';
    client.sessions.update(user.id, session);
    
    // Get available brands for selected country
    const availableBrands = COUNTRY_AVAILABILITY[country] || COUNTRY_AVAILABILITY.US;
    
    const brandSelect = new StringSelectMenuBuilder()
        .setCustomId('select_brand')
        .setPlaceholder('🎴 Choose a card brand')
        .addOptions(
            availableBrands.map(brand => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(brand)
                    .setValue(brand)
            )
        );
    
    // Create back button to return to payment method
    const backButton = new ButtonBuilder()
        .setCustomId('back_to_payment')
        .setLabel('← Back to Payment Method')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💳');
    
    const row = new ActionRowBuilder().addComponents(brandSelect);
    const buttonRow = new ActionRowBuilder().addComponents(backButton);
    
    // Get flag emoji
    const flags = {
        'US': '🇺🇸',
        'UK': '🇬🇧',
        'CANADA': '🇨🇦',
        'AUSTRALIA': '🇦🇺',
        'EURO': '🇪🇺'
    };
    const flag = flags[country] || '🌍';
    
    await interaction.update({
        content: `**${flag} Selected: ${country} (${CURRENCIES[country]})\n\nNow select your card brand:**`,
        components: [row, buttonRow]
    });
}

module.exports = { handleCountrySelect };
