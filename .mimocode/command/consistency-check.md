---
description: Run consistency checks on the server codebase. Validates security invariants, auth, responses, and client code.
---

# Consistency Check

This command runs consistency checks on the server codebase. It validates security invariants, authentication, responses, and client code.

## Usage

```bash
# Run consistency check
consistency-check

# Run with verbose output
consistency-check --verbose

# Run specific checks
consistency-check --security
consistency-check --auth
```

## Implementation

```bash
#!/bin/bash

# Consistency Check Script
# Runs static validation of code invariants

set -e

SERVER_DIR="C:/Users/Administrator/Desktop/codedog/server"

echo "Running consistency check..."
cd "$SERVER_DIR"

# Run check:consistency script
npm run check:consistency

echo "Consistency check completed"
```

## Key Checks

1. **Security Headers**: x-powered-by disabled, CSP, X-Frame-Options, nosniff
2. **Request Limits**: JSON body limit 256kb, pageSize capped at 100
3. **Production Requirements**: CORS_ORIGIN, strong SESSION_SECRET/JWT_SECRET
4. **Rate Limiting**: Login (10/15min), Codemao import (20/10min), General write (120/1min)
5. **Auth Middleware**: JWT auth, optionalAuth, adminMiddleware
6. **Response Format**: {code, msg, data} structure

## Expected Output

If all checks pass:
```
✅ All consistency checks passed
```

If checks fail:
```
❌ Consistency check failed: [description of failure]
```

## Notes

- Script location: `scripts/check-consistency.js`
- Requires Node.js
- No server running needed (static analysis)
- Checks both server and client code