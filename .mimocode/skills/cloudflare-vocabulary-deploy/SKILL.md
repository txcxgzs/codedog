---
name: cloudflare-vocabulary-deploy
description: Build and deploy sensitive word vocabulary to Cloudflare Pages and Workers. Handles vocabulary file reading, build generation, deployment, and verification.
---

# Cloudflare Vocabulary Deploy Skill

This skill automates the deployment of sensitive word vocabulary to Cloudflare Pages and Workers. It handles the complete workflow from vocabulary file reading to deployment verification.

## When to Use

- When deploying vocabulary changes to Cloudflare Pages/Worker
- When rebuilding vocabulary after false positive cleanup
- When deploying to `sensitive-word-api.pages.dev` or `safeword.txcxgzs.com`

## Prerequisites

- Node.js installed
- Wrangler CLI authenticated (`npx wrangler login`)
- Vocabulary file at `C:\Users\Administrator\Desktop\Vocabulary\合并词库-清理后.txt`
- Cloudflare Pages project: `sensitive-word-api`
- Cloudflare Worker project: `cf-worker`

## Workflow Steps

### 1. Validate Vocabulary File

```bash
# Check vocabulary file exists and count entries
python3 -c "
import os
vocab_path = r'C:\Users\Administrator\Desktop\Vocabulary\合并词库-清理后.txt'
if os.path.exists(vocab_path):
    with open(vocab_path, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]
    print(f'Vocabulary file: {len(lines)} entries')
else:
    print('ERROR: Vocabulary file not found')
    exit(1)
"
```

### 2. Build Pages Vocabulary

```bash
# Build vocabulary for Cloudflare Pages
cd C:\Users\Administrator\Desktop\Vocabulary\cf-pages
node build.js
```

### 3. Deploy to Cloudflare Pages

```bash
# Deploy to Cloudflare Pages
npx wrangler pages deploy . --project-name sensitive-word-api --branch main
```

### 4. Build Worker Vocabulary (if applicable)

```bash
# Build vocabulary for Cloudflare Worker
cd C:\Users\Administrator\Desktop\Vocabulary\cf-worker
node build.js
```

### 5. Deploy to Cloudflare Worker

```bash
# Deploy to Cloudflare Worker
npx wrangler deploy
```

### 6. Verify Deployment

```bash
# Test Pages endpoint
python3 -c "
import sys, urllib.request, json
sys.stdout.reconfigure(encoding='utf-8')

url = 'https://sensitive-word-api.pages.dev/api/check'
tests = ['test', '正常文本', '敏感词']
for test in tests:
    data = json.dumps({'text': test}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f'{test}: {result.get(\"msg\", \"unknown\")}')
    except Exception as e:
        print(f'{test}: ERROR - {e}')
"
```

## Key Files

- `C:\Users\Administrator\Desktop\Vocabulary\合并词库-清理后.txt` — Source vocabulary file
- `C:\Users\Administrator\Desktop\Vocabulary\cf-pages\build.js` — Pages build script
- `C:\Users\Administrator\Desktop\Vocabulary\cf-pages\severity.js` — Severity mappings
- `C:\Users\Administrator\Desktop\Vocabulary\cf-pages\functions\api\check.js` — Check endpoint
- `C:\Users\Administrator\Desktop\Vocabulary\cf-worker\src\index.js` — Worker entry

## Common Issues

1. **Build fails with "No matching export"**: Delete old admin subdirectories under `functions/api/admin/`
2. **ES module import errors**: Ensure `{"type": "module"}` in `cf-pages/package.json`
3. **Deployment generates new subdomain hash**: Pages deploys create new URLs; custom domains remain stable
4. **Worker too large (503)**: Ensure three-tier matching architecture is used, not all 50k+ entries as regex

## Success Criteria

- Vocabulary file validates successfully
- Pages build completes without errors
- Worker build completes without errors (if deploying Worker)
- Deployment to Cloudflare succeeds
- API endpoints respond correctly
- Custom domains (`safeword.txcxgzs.com`, `sensitive-word-api.pages.dev`) are accessible