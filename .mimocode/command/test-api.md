---
description: Test sensitive word API endpoints with various test cases. Supports both Pages and Worker endpoints.
---

# Test Sensitive Word API

This command tests the sensitive word API endpoints with various test cases to verify functionality.

## Usage

```bash
# Test Pages endpoint
test-api pages

# Test Worker endpoint
test-api worker

# Test both endpoints
test-api all

# Test specific endpoint
test-api https://sensitive-word-api.pages.dev/api/check
```

## Test Cases

### Basic Functionality Tests

1. **Normal text** — Should return safe/low-risk
2. **Sensitive words** — Should return medium/high-risk
3. **Empty input** — Should handle gracefully
4. **Long text** — Should process without timeout

### Evasion Resistance Tests

1. **Space insertion** — 敏 感 词
2. **Hyphen insertion** — 敏-感-词
3. **Underscore insertion** — 敏_感_词
4. **Pinyin evasion** — minganci

### Severity Level Tests

1. **Level 1 words** — Should return low-risk (score ≤ 3)
2. **Level 2 words** — Should return medium-risk (score ≤ 8)
3. **Level 3 words** — Should return high-risk (score > 8)
4. **Level 4 words** — Should return high-risk (score > 8)

## Implementation

```python
import sys, urllib.request, json

def test_api(url, test_cases):
    print(f"Testing {url}")
    print("-" * 50)
    
    for test in test_cases:
        data = json.dumps({'text': test}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        try:
            resp = urllib.request.urlopen(req)
            result = json.loads(resp.read())
            score = result.get('data', {}).get('score', 0)
            level = result.get('data', {}).get('level', 'unknown')
            print(f"  {test}: score={score}, level={level}")
        except Exception as e:
            print(f"  {test}: ERROR - {e}")
    
    print()

# Default test cases
DEFAULT_TESTS = [
    "正常文本",
    "测试",
    "敏感词",
    "枪支",
    "毒品",
    "炸弹制作",
    "赌博",
    "色情",
    "暴力",
    "恐怖",
    # Evasion tests
    "敏 感 词",
    "敏-感-词",
    "敏_感_词",
    "minganci",
]

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: test-api <endpoint|pages|worker|all>")
        sys.exit(1)
    
    target = sys.argv[1]
    
    if target == "pages":
        url = "https://sensitive-word-api.pages.dev/api/check"
        test_api(url, DEFAULT_TESTS)
    elif target == "worker":
        url = "https://sensitive-word-checker.zengzilang2011.workers.dev/api/check"
        test_api(url, DEFAULT_TESTS)
    elif target == "all":
        urls = [
            "https://sensitive-word-api.pages.dev/api/check",
            "https://sensitive-word-checker.zengzilang2011.workers.dev/api/check",
        ]
        for url in urls:
            test_api(url, DEFAULT_TESTS)
    else:
        # Treat as custom URL
        test_api(target, DEFAULT_TESTS)
```

## Expected Output

For normal text:
```
正常文本: score=0, level=safe
测试: score=0, level=safe
```

For sensitive words:
```
枪支: score=3, level=low
毒品: score=3, level=low
炸弹制作: score=4, level=low
赌博: score=2, level=low
色情: score=2, level=low
```

## Notes

- Pages endpoint reads from D1 at runtime (admin changes take effect immediately)
- Worker endpoint uses precompiled regex (requires rebuild for vocabulary changes)
- Custom domains: `safeword.txcxgzs.com` (Worker), `sensitive-word-api.pages.dev` (Pages)