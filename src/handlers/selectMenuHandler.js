/**
 * Select Menu Handler
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        session.step = 2;
        client.sessions.update(user.id, session);
        
        // Get currency from session (default to USD if not set)
        const currency = session.data.currency || 'USD';
        const currencySymbol = getCurrencySymbol(currency);
        
        // Create a message with back button before showing modal
        // Get flag emoji
        const flags = {
            'US': '🇺🇸',
            'UK': '🇬🇧',
            'CANADA': '🇨🇦',
            'AUSTRALIA': '🇦🇺',
            'EURO': '🇪🇺'
        };
        const flag = flags[session.data.country] || '🌍';
        
        // Create back button to return to country selection
        const backButton = new ButtonBuilder()
            .setCustomId('back_to_countries')
            .setLabel('← Back to Countries')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌍');
        
        const buttonRow = new ActionRowBuilder().addComponents(backButton);
        
        // Send a message with back button, then show modal
        await interaction.update({
            content: `**${flag} Selected: ${session.data.country} (${session.data.currency})\n🎴 Selected Brand: ${brand}\n\nClick the button below to enter card value:**`,
            components: [buttonRow]
        });
        
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
        
        // Show the modal
        setTimeout(async () => {
            try {
                await interaction.showModal(modal);
            } catch (error) {
                console.error('[MODAL ERROR]', error);
            }
        }, 500);
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
