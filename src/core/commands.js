/**
 * Slash Command Registration
 */

const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'register',
        description: 'Create your seller account',
    },
    {
        name: 'start',
        description: 'Open DM to start selling gift cards',
    },
    {
        name: 'profile',
        description: 'View your profile or another user',
        options: [
            {
                name: 'user',
                description: 'User to view profile (leave empty for yourself)',
                type: 6,
                required: false
            }
        ]
    },
    {
        name: 'paypal',
        description: 'Set your PayPal email',
        options: [
            {
                name: 'email',
                description: 'Your PayPal email address',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'btc',
        description: 'Set your Bitcoin address',
        options: [
            {
                name: 'address',
                description: 'Your Bitcoin wallet address',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'bank',
        description: 'Set your bank details',
        options: [
            {
                name: 'name',
                description: 'Your full account name',
                type: 3,
                required: true
            },
            {
                name: 'number',
                description: 'Your account number',
                type: 3,
                required: true
            },
            {
                name: 'bank',
                description: 'Your bank name',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'help',
        description: 'Show all available commands',
    },
    {
        name: 'ping',
        description: 'Check bot latency',
    },
    {
        name: 'members',
        description: 'Show server member statistics',
    },
    {
        name: 'users',
        description: 'List human members in server',
    },
    {
        name: 'bots',
        description: 'List bots in server',
    },
    {
        name: 'leaderboard',
        description: 'Show top sellers',
    },
    {
        name: 'pending',
        description: 'Show all pending transactions (Admin only)',
        default_member_permissions: '0'
    },
    {
        name: 'transaction',
        description: 'View transaction details (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'approve',
        description: 'Approve a pending transaction (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            },
            {
                name: 'amount',
                description: 'Amount to pay',
                type: 4,
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'reject',
        description: 'Reject a pending transaction (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for rejection',
                type: 3,
                required: false
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'paid',
        description: 'Mark transaction as paid (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'logs',
        description: 'View recent logs (Admin only)',
        options: [
            {
                name: 'limit',
                description: 'Number of logs to show',
                type: 4,
                required: false,
                min_value: 1,
                max_value: 100
            }
        ],
        default_member_permissions: '0'
    },
    {
        name: 'announce',
        description: 'Send announcement to all users (Admin only)',
        options: [
            {
                name: 'message',
                description: 'Announcement message',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    },
    // NEW RECEIPT COMMAND - Add this
    {
        name: 'receipt',
        description: 'Request receipt from user (Admin only)',
        options: [
            {
                name: 'id',
                description: 'Transaction ID',
                type: 3,
                required: true
            }
        ],
        default_member_permissions: '0'
    }
];

async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`[SLASH] Registered ${commands.length} commands for guild ${process.env.GUILD_ID}`);
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log(`[SLASH] Registered ${commands.length} global commands`);
        }
    } catch (error) {
        console.error('[SLASH] Failed to register commands:', error);
    }
}

module.exports = { commands, registerCommands };
