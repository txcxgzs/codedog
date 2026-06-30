---
description: Extract and process vocabulary files. Handles vocabulary cleaning, false positive removal, and format conversion.
---

# Vocabulary Extraction

This command extracts and processes vocabulary files. It handles vocabulary cleaning, false positive removal, and format conversion.

## Usage

```bash
# Extract vocabulary
extract-vocab

# Extract with specific source
extract-vocab --source "path/to/source.txt"

# Extract with false positive list
extract-vocab --false-positives "path/to/false_positives.txt"

# Extract and clean
extract-vocab --clean
```

## Implementation

```python
import os
import sys

def extract_vocabulary(source_path, output_path=None, false_positives_path=None):
    """
    Extract and process vocabulary files.
    
    Args:
        source_path: Path to source vocabulary file
        output_path: Path to output file (default: same as source with _extracted suffix)
        false_positives_path: Path to false positives list file
    """
    if not os.path.exists(source_path):
        print(f"ERROR: Source file not found: {source_path}")
        sys.exit(1)
    
    # Read source vocabulary
    with open(source_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines() if line.strip()]
    
    print(f"Source vocabulary: {len(lines)} entries")
    
    # Read false positives if provided
    false_positives = set()
    if false_positives_path and os.path.exists(false_positives_path):
        with open(false_positives_path, 'r', encoding='utf-8') as f:
            false_positives = {line.strip() for line in f.readlines() if line.strip()}
        print(f"False positives to remove: {len(false_positives)} entries")
    
    # Filter out false positives
    if false_positives:
        lines = [line for line in lines if line not in false_positives]
        print(f"After filtering: {len(lines)} entries")
    
    # Determine output path
    if output_path is None:
        base, ext = os.path.splitext(source_path)
        output_path = f"{base}_extracted{ext}"
    
    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    
    print(f"Extracted vocabulary saved to: {output_path}")
    return output_path

if __name__ == "__main__":
    # Default paths for this project
    SOURCE_PATH = r"C:\Users\Administrator\Desktop\Vocabulary\合并词库-清理后.txt"
    FALSE_POSITIVES_PATH = r"C:\Users\Administrator\Desktop\Vocabulary\false_positives.txt"
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        SOURCE_PATH = sys.argv[1]
    if len(sys.argv) > 2:
        FALSE_POSITIVES_PATH = sys.argv[2]
    
    # Run extraction
    extract_vocabulary(SOURCE_PATH, false_positives_path=FALSE_POSITIVES_PATH)
```

## Key Files

- Source: `C:\Users\Administrator\Desktop\Vocabulary\合并词库-清理后.txt`
- Output: `合并词库-清理后_extracted.txt` (or custom path)
- False positives: `C:\Users\Administrator\Desktop\Vocabulary\false_positives.txt`

## Notes

- Vocabulary contains 49,599 entries (after previous cleanup)
- False positive categories: common nouns, professional terms, everyday objects
- Must rebuild both Pages AND Worker after vocabulary changes