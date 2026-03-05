/**
 * Session Manager
 */

const { Collection } = require('discord.js');
const { SESSION_TIMEOUT } = require('../config/constants');

class SessionManager {
    constructor() {
        this.sessions = new Collection();
        this.timeout = SESSION_TIMEOUT;
    }

    create(userId) {
        const session = {
            userId,
            step: 1,
            data: {},
            createdAt: Date.now()
        };
        
        this.sessions.set(userId, session);
        return session;
    }

    get(userId) {
        const session = this.sessions.get(userId);
        
        if (session && (Date.now() - session.createdAt) > this.timeout) {
            this.sessions.delete(userId);
            return null;
        }
        
        return session;
    }

    update(userId, updates) {
        const session = this.get(userId);
        if (session) {
            Object.assign(session, updates);
            this.sessions.set(userId, session);
        }
        return session;
    }

    delete(userId) {
        return this.sessions.delete(userId);
    }

    nextStep(userId) {
        const session = this.get(userId);
        if (session) {
            session.step++;
            this.sessions.set(userId, session);
        }
        return session;
    }
}

const sessionManager = new SessionManager();
module.exports = { SessionManager, sessionManager };
