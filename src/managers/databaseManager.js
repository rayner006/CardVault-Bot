/**
 * MySQL Database Manager for CardVault Bot
 */

const mysql = require('mysql2/promise');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT) || 4000,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0
            });

            // Test connection
            const connection = await this.pool.getConnection();
            console.log('[DATABASE] MySQL connected successfully');
            
            // Create tables
            await this.createTables();
            
            connection.release();
            this.initialized = true;
            
        } catch (error) {
            console.error('[DATABASE] MySQL connection failed:', error);
            throw error;
        }
    }

    async createTables() {
        // Users table
        await this.pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                userId VARCHAR(255) PRIMARY KEY,
                registered BOOLEAN DEFAULT 0,
                registeredAt BIGINT,
                paypal TEXT,
                btc TEXT,
                bankName TEXT,
                bankNumber TEXT,
                bankAccount TEXT,
                totalSold INT DEFAULT 0,
                totalEarned INT DEFAULT 0,
                lastSeen BIGINT,
                warningCount INT DEFAULT 0,
                isBanned BOOLEAN DEFAULT 0
            )
        `);

        // Transactions table
        await this.pool.execute(`
            CREATE TABLE IF NOT EXISTS transactions (
                txId VARCHAR(255) PRIMARY KEY,
                userId VARCHAR(255),
                username TEXT,
                paymentMethod TEXT,
                paymentDetail TEXT,
                brand TEXT,
                value INT,
                image TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                submittedAt BIGINT,
                approvedAt BIGINT,
                paidAt BIGINT,
                adminNotes TEXT,
                offerAmount INT,
                FOREIGN KEY (userId) REFERENCES users(userId)
            )
        `);

        // Logs table
        await this.pool.execute(`
            CREATE TABLE IF NOT EXISTS logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action TEXT,
                userId VARCHAR(255),
                details TEXT,
                timestamp BIGINT
            )
        `);

        // Card brands table
        await this.pool.execute(`
            CREATE TABLE IF NOT EXISTS card_brands (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE
            )
        `);

        // Insert default card brands
        const brands = [
            'Amazon', 'Steam', 'Sephora', 'Nordstrom', 'Walmart Visa',
            'Google Play', 'Amex', 'Apple', 'Macy\'s', 'Footlocker',
            'Nike', 'Mastercard', 'Xbox', 'Razor Gold', 'Vanilla'
        ];

        for (const brand of brands) {
            await this.pool.execute(
                'INSERT IGNORE INTO card_brands (name) VALUES (?)',
                [brand]
            );
        }

        console.log('[DATABASE] Tables created/verified');
    }

    async query(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('[DATABASE] Query error:', error);
            throw error;
        }
    }

    async getOne(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows[0] || null;
    }

    // ===== USER METHODS =====
    
    async getUser(userId) {
        return await this.getOne('SELECT * FROM users WHERE userId = ?', [userId]);
    }

    async createUser(userId) {
        const existing = await this.getUser(userId);
        if (existing) return existing;

        const now = Date.now();
        await this.query(
            'INSERT INTO users (userId, registered, registeredAt, lastSeen) VALUES (?, 1, ?, ?)',
            [userId, now, now]
        );
        
        await this.log('register', userId, 'User registered');
        return await this.getUser(userId);
    }

    async updateUser(userId, data) {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), userId];
        
        await this.query(`UPDATE users SET ${fields} WHERE userId = ?`, values);
        await this.log('update', userId, `Updated fields: ${Object.keys(data).join(', ')}`);
    }

    async setPaymentMethod(userId, method, value) {
        const updates = {};
        
        switch(method) {
            case 'paypal':
                updates.paypal = value;
                break;
            case 'btc':
                updates.btc = value;
                break;
            case 'bank':
                const [name, number, bank] = value.split('|');
                updates.bankName = name.trim();
                updates.bankNumber = number.trim();
                updates.bankAccount = bank.trim();
                break;
        }
        
        await this.updateUser(userId, updates);
        await this.log('payment_set', userId, `Set ${method} payment method`);
    }

    // ===== TRANSACTION METHODS =====
    
    async createTransaction(data) {
        const txId = 'CV-' + Date.now().toString(36).toUpperCase() + 
                     Math.random().toString(36).substring(2, 5).toUpperCase();
        
        await this.query(
            `INSERT INTO transactions (
                txId, userId, username, paymentMethod, paymentDetail,
                brand, value, image, status, submittedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                txId,
                data.userId,
                data.username,
                data.paymentMethod,
                data.paymentDetail,
                data.brand,
                data.value,
                data.image,
                'pending',
                Date.now()
            ]
        );
        
        await this.log('transaction_created', data.userId, `Created transaction ${txId}`);
        return txId;
    }

    async getTransaction(txId) {
        return await this.getOne('SELECT * FROM transactions WHERE txId = ?', [txId]);
    }

    async updateTransactionStatus(txId, status, adminNotes = '') {
        const updates = { status };
        
        if (status === 'approved') updates.approvedAt = Date.now();
        if (status === 'paid') updates.paidAt = Date.now();
        
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), txId];
        
        await this.query(`UPDATE transactions SET ${fields} WHERE txId = ?`, values);
        
        if (adminNotes) {
            await this.query('UPDATE transactions SET adminNotes = ? WHERE txId = ?', [adminNotes, txId]);
        }
        
        const tx = await this.getTransaction(txId);
        await this.log('status_update', tx.userId, `Transaction ${txId} status: ${status}`);
    }
    
    async updateTransactionOffer(txId, offerAmount) {
        await this.query('UPDATE transactions SET offerAmount = ? WHERE txId = ?', [offerAmount, txId]);
        await this.log('offer_updated', txId, `Offer amount set to $${offerAmount}`);
    }

    async getPendingTransactions() {
        return await this.query(
            'SELECT * FROM transactions WHERE status = "pending" ORDER BY submittedAt DESC'
        );
    }

    async getUserTransactions(userId) {
        return await this.query(
            'SELECT * FROM transactions WHERE userId = ? ORDER BY submittedAt DESC LIMIT 10',
            [userId]
        );
    }

    // ===== BRAND METHODS =====
    
    async getCardBrands() {
        const rows = await this.query('SELECT name FROM card_brands ORDER BY name');
        return rows.map(b => b.name);
    }

    // ===== STATS METHODS =====
    
    async incrementUserStats(userId, value) {
        const user = await this.getUser(userId);
        if (user) {
            const totalSold = (user.totalSold || 0) + 1;
            const totalEarned = (user.totalEarned || 0) + value;
            await this.updateUser(userId, { totalSold, totalEarned });
        }
    }

    async getTopSellers(limit = 10) {
        return await this.query(
            'SELECT * FROM users WHERE totalSold > 0 ORDER BY totalSold DESC LIMIT ?',
            [limit]
        );
    }

    // ===== LOGGING =====
    
    async log(action, userId, details) {
        console.log(`[LOG] ${new Date().toLocaleTimeString()} | ${action} | ${userId} | ${details}`);
        
        await this.query(
            'INSERT INTO logs (action, userId, details, timestamp) VALUES (?, ?, ?, ?)',
            [action, userId, details, Date.now()]
        );
    }

    async getRecentLogs(limit = 50) {
        return await this.query(
            'SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('[DATABASE] MySQL connection pool closed');
        }
    }
}

module.exports = { DatabaseManager };
