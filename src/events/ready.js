/**
 * Ready Event Handler
 */

function handleReady(client) {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ BOT IS ONLINE!`);
    console.log('='.repeat(50));
    console.log(`🤖 Bot Tag: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`👑 Admin ID: ${process.env.ADMIN_ID}`);
    console.log(`📝 Log Channel: #cardvault-logs`);
    console.log('='.repeat(50) + '\n');

    client.user.setActivity('/start | Begin selling', { 
        type: 'WATCHING' 
    });
}

module.exports = { handleReady };
