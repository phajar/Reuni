import os
import re

for root, dirs, files in os.walk('.'):
    for fn in files:
        if fn.endswith('.js') or fn.endswith('.html'):
            filepath = os.path.join(root, fn)
            if 'node_modules' in filepath or '.git' in filepath:
                continue
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            matches = list(re.finditer(r'initWhatsAppEngine', content))
            if matches:
                print(f"Found initWhatsAppEngine in {filepath}:")
                for m in matches:
                    line_no = content[:m.start()].count('\n') + 1
                    print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
