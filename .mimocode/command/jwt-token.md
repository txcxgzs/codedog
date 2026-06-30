---
description: Generate JWT tokens for API testing. Supports different roles and expiration times.
---

# JWT Token Generation

This command generates JWT tokens for API testing. It supports different roles and expiration times.

## Usage

```bash
# Generate token for superadmin
jwt-token superadmin

# Generate token for admin
jwt-token admin

# Generate token with custom expiration
jwt-token superadmin 24h

# Generate token for specific user ID
jwt-token superadmin 5
```

## Implementation

```javascript
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/auth');

function generateToken(role = 'superadmin', userId = 5, expiresIn = '1h') {
    const token = jwt.sign(
        { 
            id: userId, 
            role: role 
        }, 
        JWT_SECRET || 'dev-test-secret',
        { expiresIn: expiresIn }
    );
    
    console.log(`Token for ${role} (user ${userId}):`);
    console.log(token);
    return token;
}

// Parse command line arguments
const args = process.argv.slice(2);
const role = args[0] || 'superadmin';
const userId = args[1] || 5;
const expiresIn = args[2] || '1h';

generateToken(role, userId, expiresIn);
```

## Usage Examples

```bash
# In server directory
cd C:/Users/Administrator/Desktop/codedog/server

# Generate superadmin token
node -e "
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/auth');
const token = jwt.sign({ id: 5, role: 'superadmin' }, JWT_SECRET || 'dev-test-secret', { expiresIn: '1h' });
console.log(token);
"

# Generate admin token
node -e "
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/auth');
const token = jwt.sign({ id: 3, role: 'admin' }, JWT_SECRET || 'dev-test-secret', { expiresIn: '1h' });
console.log(token);
"

# Generate user token
node -e "
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/auth');
const token = jwt.sign({ id: 1, role: 'user' }, JWT_SECRET || 'dev-test-secret', { expiresIn: '1h' });
console.log(token);
"
```

## Token Structure

```json
{
    "id": 5,
    "role": "superadmin",
    "iat": 1781838185,
    "exp": 1781841785
}
```

## Notes

- JWT_SECRET is read from `config/auth.js`
- In production, JWT_SECRET must be set (app exits if missing)
- Default expiration: 1 hour
- User ID 5 is superadmin in this project