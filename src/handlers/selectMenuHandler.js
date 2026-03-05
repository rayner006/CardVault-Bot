/**
 * Select Menu Handler
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

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
        
        // Create modal for value input
        const modal = new ModalBuilder()
            .setCustomId('modal_value')
            .setTitle('Enter Card Value');
        
        const valueInput = new TextInputBuilder()
            .setCustomId('card_value')
            .setLabel('Card Value in USD')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 25, 50, 100')
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(4);
        
        const row = new ActionRowBuilder().addComponents(valueInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
}

module.exports = { handleSelectMenu };
