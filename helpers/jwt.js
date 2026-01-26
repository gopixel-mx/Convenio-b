const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const privateKey = fs.readFileSync(path.join(__dirname, 'admin.key'), 'utf8');

function signJwt(payload, options = {}) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60;
    const jwtPayload = { ...payload, iat: now, exp };
    return jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256', ...options });
}

module.exports = { signJwt };