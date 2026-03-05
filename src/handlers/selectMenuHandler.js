/**
 * Select Menu Handler
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { CURRENCIES } = require('../config/constants');

async function handleSelectMenu(interaction) {
    const { user, values, client } = interaction;
    
    if (interaction.customId === 'select_brand') {
        const brand = values[0];
        const session = client.sessions.get(user.id);
        
        if (!session) {
            return interaction.reply({ 
                content: '❌ Session expired. Please use `/start` again.',
                ephemeral: true 
            });
        }
        
        session.data.brand = brand;
        client.sessions.update(user.id, { step: 2 });
        
        // Get currency from session (default to USD if not set)
        const currency = session.data.currency || 'USD';
        const currencySymbol = getCurrencySymbol(currency);
        
        // Create modal for value input with DYNAMIC currency
        const modal = new ModalBuilder()
            .setCustomId('modal_value')
            .setTitle(`Enter Card Value (${currency})`);
        
        const valueInput = new TextInputBuilder()
            .setCustomId('card_value')
            .setLabel(`Card Value in ${currency} ${currencySymbol}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`e.g., 25, 50, 100 ${currency}`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(4);
        
        const row = new ActionRowBuilder().addComponents(valueInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
}

// Helper function to get currency symbol
function getCurrencySymbol(currency) {
    const symbols = {
        'USD': '$',
        'GBP': '£',
        'CAD': 'C$',
        'AUD': 'A$',
        'EUR': '€'
    };
    return symbols[currency] || '$';
}

module.exports = { handleSelectMenu };
