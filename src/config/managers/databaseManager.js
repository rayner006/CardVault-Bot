/**
 * Database Manager
 */

const Database = require('better-sqlite3');
const { CARD_BRANDS } = require('../config/constants');

class DatabaseManager {
    constructor(dbPath = './data/cardvault.db') {
        this.db = new Database(dbPath);
        this.initialize();
    }

    initialize() {
        // Create tables (same as your original)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                userId TEXT PRIMARY KEY,
                registered INTEGER DEFAULT 0,
                registeredAt INTEGER,
                paypal TEXT,
                btc TEXT,
                bankName TEXT,
                bankNumber TEXT,
                bankAccount TEXT,
                totalSold INTEGER DEFAULT 0,
                totalEarned INTEGER DEFAULT 0,
                lastSeen INTEGER,
                warningCount INTEGER DEFAULT 0,
                isBanned INTEGER DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                txId TEXT PRIMARY KEY,
                userId TEXT,
                username TEXT,
                paymentMethod TEXT,
                paymentDetail TEXT,
                brand TEXT,
                value INTEGER,
                image TEXT,
                status TEXT DEFAULT 'pending',
                submittedAt INTEGER,
                approvedAt INTEGER,
                paidAt INTEGER,
                adminNotes TEXT,
                offerAmount INTEGER,
                FOREIGN KEY(userId) REFERENCES users(userId)
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT,
                userId TEXT,
                details TEXT,
                timestamp INTEGER
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS card_brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE
            )
        `);

        // Insert card brands
        const insertBrand = this.db.prepare('INSERT OR IGNORE INTO card_brands (name) VALUES (?)');
        CARD_BRANDS.forEach(brand => insertBrand.run(brand));
        console.log(`[DATABASE] Loaded ${CARD_BRANDS.length} card brands`);
    }

    // ===== USER METHODS =====
    getUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE userId = ?');
        return stmt.get(userId);
    }

    createUser(userId) {
        const existing = this.getUser(userId);
        if (existing) return existing;

        const stmt = this.db.prepare(`
            INSERT INTO users (userId, registered, registeredAt, lastSeen)
            VALUES (?, 1, ?, ?)
        `);
        
        const now = Date.now();
        stmt.run(userId, now, now);
        
        this.log('register', userId, 'User registered');
        return this.getUser(userId);
    }

    updateUser(userId, data) {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        
        const stmt = this.db.prepare(`UPDATE users SET ${fields} WHERE userId = ?`);
        stmt.run(...values, userId);
        
        this.log('update', userId, `Updated fields: ${Object.keys(data).join(', ')}`);
    }

    setPaymentMethod(userId, method, value) {
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
        
        this.updateUser(userId, updates);
        this.log('payment_set', userId, `Set ${method} payment method`);
    }

    // ===== TRANSACTION METHODS =====
    createTransaction(data) {
        const txId = 'CV-' + Date.now().toString(36).toUpperCase() + 
                     Math.random().toString(36).substring(2, 5).toUpperCase();
        
        const stmt = this.db.prepare(`
            INSERT INTO transactions (
                txId, userId, username, paymentMethod, paymentDetail,
                brand, value, image, status, submittedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
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
        );
        
        this.log('transaction_created', data.userId, `Created transaction ${txId}`);
        return txId;
    }

    getTransaction(txId) {
        const stmt = this.db.prepare('SELECT * FROM transactions WHERE txId = ?');
        return stmt.get(txId);
    }

    updateTransactionStatus(txId, status, adminNotes = '') {
        const updates = { status };
        
        if (status === 'approved') updates.approvedAt = Date.now();
        if (status === 'paid') updates.paidAt = Date.now();
        if (adminNotes) updates.adminNotes = adminNotes;
        
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        
        const stmt = this.db.prepare(`UPDATE transactions SET ${fields} WHERE txId = ?`);
        stmt.run(...values, txId);
        
        const tx = this.getTransaction(txId);
        this.log('status_update', tx.userId, `Transaction ${txId} status: ${status}`);
    }
    
    updateTransactionOffer(txId, offerAmount) {
        const stmt = this.db.prepare(`UPDATE transactions SET offerAmount = ? WHERE txId = ?`);
        stmt.run(offerAmount, txId);
        this.log('offer_updated', txId, `Offer amount set to $${offerAmount}`);
    }

    getPendingTransactions() {
        const stmt = this.db.prepare(`
            SELECT * FROM transactions 
            WHERE status = 'pending' 
            ORDER BY submittedAt DESC
        `);
        return stmt.all();
    }

    getUserTransactions(userId) {
        const stmt = this.db.prepare(`
            SELECT * FROM transactions 
            WHERE userId = ? 
            ORDER BY submittedAt DESC
            LIMIT 10
        `);
        return stmt.all(userId);
    }

    // ===== BRAND METHODS =====
    getCardBrands() {
        const stmt = this.db.prepare('SELECT name FROM card_brands ORDER BY name');
        return stmt.all().map(b => b.name);
    }

    // ===== STATS METHODS =====
    incrementUserStats(userId, value) {
        const user = this.getUser(userId);
        if (user) {
            const totalSold = (user.totalSold || 0) + 1;
            const totalEarned = (user.totalEarned || 0) + value;
            this.updateUser(userId, { totalSold, totalEarned });
        }
    }

    getTopSellers(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM users 
            WHERE totalSold > 0 
            ORDER BY totalSold DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // ===== LOGGING =====
    log(action, userId, details) {
        console.log(`[LOG] ${new Date().toLocaleTimeString()} | ${action} | ${userId} | ${details}`);
        
        const stmt = this.db.prepare(`
            INSERT INTO logs (action, userId, details, timestamp)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(action, userId, details, Date.now());
    }

    getRecentLogs(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT * FROM logs 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

// Singleton instance
const db = new DatabaseManager();
module.exports = { DatabaseManager, db };
