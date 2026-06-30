---
description: Build client and check for errors. Quick verification of frontend build status.
---

# Client Build Check

This command builds the client and checks for errors. It's a quick verification of frontend build status.

## Usage

```bash
# Build and check for errors
build-check

# Build with verbose output
build-check --verbose

# Build and watch for changes
build-check --watch
```

## Implementation

```bash
#!/bin/bash

# Client Build Check Script
# Checks for errors in the client build

set -e

CLIENT_DIR="C:/Users/Administrator/Desktop/codedog/client"

echo "Building client..."
cd "$CLIENT_DIR"

# Run build and capture output
BUILD_OUTPUT=$(npm run build 2>&1)

# Check for errors
if echo "$BUILD_OUTPUT" | grep -E "(error|ERROR)"; then
    echo "BUILD FAILED"
    echo "$BUILD_OUTPUT" | grep -E "(error|ERROR)"
    exit 1
else
    echo "BUILD SUCCESS"
    # Extract build time if available
    echo "$BUILD_OUTPUT" | grep -E "built in" || echo "Build completed"
fi
```

## Key Indicators

- **BUILD SUCCESS**: No error lines in output, "built in" message present
- **BUILD FAILED**: Error lines present in output

## Common Errors

1. **Module not found**: Check import paths
2. **Syntax error**: Check for typos in code
3. **Type error**: Check for type mismatches
4. **Environment variable missing**: Check `.env` files

## Notes

- Client is at `C:/Users/Administrator/Desktop/codedog/client`
- Build output goes to `client/dist/`
- Build command: `npm run build`
- No test framework configured in client package