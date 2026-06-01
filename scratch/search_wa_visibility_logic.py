import os
import re

for fn in ['js/app.js', 'js/api-whatsapp.js']:
    if os.path.exists(fn):
        with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"\nSearching '{fn}' for visibility/hidden toggles on WA elements:")
        for keyword in ['wa-node-status', 'wa-session-select', 'panel-wa-link-qr', 'wa-campaigns-card', 'wa-session-select']:
            for match in re.finditer(re.escape(keyword), content):
                line_no = content[:match.start()].count('\n') + 1
                print(f"  Keyword '{keyword}' at Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
