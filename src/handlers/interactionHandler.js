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
