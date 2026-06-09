require('dotenv').config();
const crypto = require('crypto');

const configuredJwtSecret = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const INSECURE_JWT_SECRETS = new Set([
    'development-secret-key-do-not-use-in-production'
]);

function isValidJwtSecret(secret) {
    return typeof secret === 'string'
        && secret.length >= 32
        && !INSECURE_JWT_SECRETS.has(secret);
}

function resolveJwtSecret() {
    if (isValidJwtSecret(configuredJwtSecret)) {
        return configuredJwtSecret;
    }

    const message = 'JWT_SECRET is missing, too short, or uses an insecure default. Set a random secret with at least 32 characters.';
    if (process.env.NODE_ENV === 'production') {
        console.error(message);
        process.exit(1);
    }

    console.warn(`${message} Generated an in-memory development secret for this process.`);
    return crypto.randomBytes(48).toString('hex');
}

module.exports = {
    JWT_SECRET: resolveJwtSecret(),
    JWT_EXPIRES_IN
};
