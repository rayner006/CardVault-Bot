/**
 * Button Interaction Handler
 */

const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { EmbedHelper } = require('../utils/embedBuilder');
const { logToChannel } = require('../utils/logger');

async function handleButton(interaction) {
    const { user, customId, client } = interaction;
    
    const userData = client.db.getUser(user.id);
    if (userData?.isBanned) {
        return interaction.reply({ 
            content: '❌ You are banned from using CardVault.',
            ephemeral: true 
        });
    }
    
    if (!userData || !userData.registered) {
        return interaction.reply({ 
            content: '❌ You need to register first! Use `/register` in the server.',
            ephemeral: true 
        });
    }
    
    if (customId.startsWith('sell_')) {
        const method = customId.replace('sell_', '');
        
        // Check if payment method is set
        if (method === 'paypal' && !userData.paypal) {
            return interaction.reply({ 
                content: '❌ You need to set your PayPal email first! Use `/paypal` in the server.',
                ephemeral: true 
            });
        }
        if (method === 'bitcoin' && !userData.btc) {
            return interaction.reply({ 
                content: '❌ You need to set your Bitcoin address first! Use `/btc` in the server.',
                ephemeral: true 
            });
        }
        if (method === 'bank' && !userData.bankName) {
            return interaction.reply({ 
                content: '❌ You need to set your bank details first! Use `/bank` in the server.',
                ephemeral: true 
            });
        }
        
        // Create or reset session
        let session = client.sessions.get(user.id);
        if (session) client.sessions.delete(user.id);
        
        session = client.sessions.create(user.id);
        session.data.paymentMethod = method;
        
        // Set payment detail based on method
        if (method === 'paypal') session.data.paymentDetail = userData.paypal;
        if (method === 'bitcoin') session.data.paymentDetail = userData.btc;
        if (method === 'bank') {
            session.data.paymentDetail = `${userData.bankName} | ${userData.bankNumber} | ${userData.bankAccount}`;
        }
        
        // Create brand selection menu
        const brands = client.db.getCardBrands();
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_brand')
            .setPlaceholder('Choose a card brand')
            .addOptions(
                brands.slice(0, 25).map(brand => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(brand)
                        .setValue(brand)
                )
            );
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.update({
            content: '**Select your card brand:**',
            components: [row]
        });
    }
    
    // Log button click
    await logToChannel(
        interaction.guild,
        'Button Click',
        user,
        `Button: ${customId}`
    );
}

module.exports = { handleButton };
