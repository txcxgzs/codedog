#!/usr/bin/env sh
# `$0` is /usr/local/bin/codedogim when invoked through the global symlink.
# Resolve it first so the toolbox is always loaded from the real IM directory.
script_path="$0"
if command -v readlink >/dev/null 2>&1; then
  resolved_path="$(readlink -f "$script_path" 2>/dev/null || true)"
  [ -z "$resolved_path" ] || script_path="$resolved_path"
fi
script_dir="$(CDPATH= cd "$(dirname "$script_path")" && pwd)" || exit 1
cd "$script_dir" || exit 1
exec node scripts/toolbox.js
