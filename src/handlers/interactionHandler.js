/**
 * Main Interaction Handler
 */

const { handleSlashCommand } = require('./commandHandler');
const { handleButton } = require('./buttonHandler');
const { handleSelectMenu } = require('./selectMenuHandler');
const { handleCountrySelect } = require('./countryHandler'); // ADD THIS

async function handleInteraction(interaction) {
    try {
        // Disable slash commands in DMs
        if (interaction.isChatInputCommand() && !interaction.guild) {
            return interaction.reply({ 
                content: '❌ Slash commands cannot be used in DMs. Please use the buttons below to continue selling.',
                ephemeral: true 
            });
        }
        
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction);
        }
        
        // Handle button interactions
        else if (interaction.isButton()) {
            await handleButton(interaction);
        }
        
        // Handle select menu interactions
        else if (interaction.isStringSelectMenu()) {
            // Check if it's a country selection
            if (interaction.customId === 'select_country') {
                await handleCountrySelect(interaction);
            } else {
                await handleSelectMenu(interaction);
            }
        }
        
        // Handle modal submissions
        else if (interaction.isModalSubmit()) {
            await handleModalSubmit(interaction);
        }
        
    } catch (error) {
        console.error('[ERROR] Interaction error:', error);
        
        const errorMessage = '❌ An error occurred while processing your request.';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
}

async function handleModalSubmit(interaction) {
    if (interaction.customId === 'modal_value') {
        const value = parseInt(interaction.fields.getTextInputValue('card_value'));
        const user = interaction.user;
        const session = interaction.client.sessions.get(user.id);
        
        if (!session) {
            return interaction.reply({ 
                content: '❌ Session expired. Please use `/start` again.',
                ephemeral: true 
            });
        }
        
        if (isNaN(value) || value <= 0) {
            return interaction.reply({ 
                content: '❌ Please enter a valid number.',
                ephemeral: true 
            });
        }
        
        session.data.value = value;
        interaction.client.sessions.update(user.id, { step: 3 });
        
        // CLEANED MESSAGE - No drag/drop references
        await interaction.reply({
            content: '📸 **Please upload a CLEAR photo of the card**\nMake sure the code is visible!\n\n📱 **Tap the + button to attach your photo**',
            ephemeral: false
        });
    }
}

module.exports = { handleInteraction };
