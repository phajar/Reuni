import os
import re

for fn in ['js/app.js', 'js/api-whatsapp.js']:
    if os.path.exists(fn):
        with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"\nSearching '{fn}' for DOMContentLoaded or load events:")
        for match in re.finditer(r'DOMContentLoaded|window\.onload|\$\(document\)\.ready|initWhatsAppEngine', content):
            line_no = content[:match.start()].count('\n') + 1
            print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
