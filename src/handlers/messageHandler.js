1  /**
2   * DM Message Handler (for image uploads)
3   */
4  
5  const { EmbedBuilder } = require('discord.js');
6  const { EmbedHelper } = require('../utils/embedBuilder');
7  
8  async function handleMessage(message) {
9      if (message.author.bot) return;
10     if (message.guild !== null) return; // Only DMs
11     
12     const userId = message.author.id;
13     const session = message.client.sessions.get(userId);
14     
15     if (!session || session.step !== 3) return;
16     
17     // Check for image attachment
18     if (message.attachments.size === 0) {
19         // FIXED: Clean message without drag/drop references
20         return message.reply('❌ Please upload an image of the card.\n\n📱 **Tap the + button to attach your photo**');
21     }
22     
23     const image = message.attachments.first();
24     
25     if (!image.contentType?.startsWith('image/')) {
26         return message.reply('❌ Please upload a valid image file.');
27     }
28     
29     // FIXED: Added await here
30     const txId = await message.client.db.createTransaction({
31         userId,
32         username: message.author.username,
33         paymentMethod: session.data.paymentMethod,
34         paymentDetail: session.data.paymentDetail,
35         brand: session.data.brand,
36         value: session.data.value,
37         image: image.url
38     });
39     
40     // Notify admin channel
41     message.client.guilds.cache.forEach(async (guild) => {
42         const adminChannel = guild.channels.cache.find(c => c.name === 'admin');
43         if (adminChannel) {
44             const adminEmbed = new EmbedBuilder()
45                 .setColor(0xFFA500)
46                 .setTitle('🆕 New Gift Card Submission')
47                 .addFields(
48                     { name: '🆔 Transaction', value: txId, inline: false },
49                     { name: '👤 User', value: message.author.username, inline: true },
50                     { name: '💳 Payment Method', value: session.data.paymentMethod, inline: true },
51                     { name: '💳 Payment Details', value: session.data.paymentDetail || 'Not provided', inline: false },
52                     { name: '📦 Card', value: `${session.data.brand} - $${session.data.value}`, inline: true }
53                 )
54                 .setImage(image.url)
55                 .setFooter({ text: `User ID: ${userId}` })
56                 .setTimestamp();
57             
58             await adminChannel.send({ embeds: [adminEmbed] });
59             
60             // Send admin instructions
61             await adminChannel.send({ 
62                 content: `@here **New card ready for review!**\n\n` +
63                          `**To APPROVE:** \`/approve id:${txId} amount:XX\`\n` +
64                          `**To REJECT:** \`/reject id:${txId} reason:your reason\`\n\n` +
65                          `**Example:** \`/approve id:${txId} amount:50\``
66             });
67         }
68     });
69     
70     // Clear session
71     message.client.sessions.delete(userId);
72     
73     // Confirm to user
74     await message.reply({
75         embeds: [EmbedHelper.success(
76             '✅ Card Submitted Successfully!',
77             `Your transaction ID: **${txId}**`,
78             [
79                 { name: 'Card', value: `${session.data.brand} - $${session.data.value}`, inline: true },
80                 { name: 'Status', value: '⏳ Pending Review', inline: true }
81             ]
82         ).setDescription('An admin will review your card shortly. You will be notified when approved.')]
83     });
84     
85     // FIXED: Added await here
86     await message.client.db.log('card_submitted', userId, `Submitted ${session.data.brand} - $${session.data.value}`);
87 }
88 
89 module.exports = { handleMessage };
