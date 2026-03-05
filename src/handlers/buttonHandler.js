/**
 * Button Interaction Handler
 */

const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedHelper } = require('../utils/embedBuilder');
const { logToChannel } = require('../utils/logger');
const { COUNTRY_AVAILABILITY, CURRENCIES } = require('../config/constants');

async function handleButton(interaction) {
    const { user, customId, client } = interaction;
    
    // FIXED: Added await here
    const userData = await client.db.getUser(user.id);
    
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
    
    // ===== HANDLE BACK BUTTON =====
    if (customId === 'back_to_payment') {
        const session = client.sessions.get(user.id);
        if (!session) {
            return interaction.reply({ 
                content: '❌ Session expired. Please use `/start` again.',
                ephemeral: true 
            });
        }
        
        // Show payment method buttons again
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sell_paypal')
                    .setLabel('PayPal')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💳'),
                new ButtonBuilder()
                    .setCustomId('sell_bitcoin')
                    .setLabel('Bitcoin')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🪙'),
                new ButtonBuilder()
                    .setCustomId('sell_bank')
                    .setLabel('Bank Transfer')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏦')
            );
        
        await interaction.update({
            content: '👋 **Welcome to CardVault!**\n\nClick a button below to choose your payment method:',
            components: [row]
        });
        
        return; // Important: stop execution here
    }
    
    // ===== HANDLE SELL BUTTONS =====
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
        
        // COUNTRY SELECTION FIRST
        const countrySelect = new StringSelectMenuBuilder()
            .setCustomId('select_country')
            .setPlaceholder('🌍 Select card country/region')
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel('🇺🇸 United States')
                    .setValue('US')
                    .setDescription('USD - US Dollar'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🇬🇧 United Kingdom')
                    .setValue('UK')
                    .setDescription('GBP - British Pound'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🇨🇦 Canada')
                    .setValue('CANADA')
                    .setDescription('CAD - Canadian Dollar'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🇦🇺 Australia')
                    .setValue('AUSTRALIA')
                    .setDescription('AUD - Australian Dollar'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🇪🇺 Europe')
                    .setValue('EURO')
                    .setDescription('EUR - Euro')
            ]);
        
        const row = new ActionRowBuilder().addComponents(countrySelect);
        
        await interaction.update({
            content: '**🌍 First, select the card\'s country/region:**',
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
