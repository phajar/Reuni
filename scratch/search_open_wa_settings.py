import os
import re

for fn in ['index.html', 'js/app.js', 'js/api-whatsapp.js']:
    if os.path.exists(fn):
        with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"\nSearching '{fn}' for 'openWASettings' or 'openWASettingsTab':")
        for match in re.finditer(r'openWASettings', content, re.IGNORECASE):
            line_no = content[:match.start()].count('\n') + 1
            print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
