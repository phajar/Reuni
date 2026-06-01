import os
import re

files = ['js/app.js', 'js/api-whatsapp.js']
for fn in files:
    if os.path.exists(fn):
        with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"\nSearching '{fn}':")
        for match in re.finditer(r'modal-wa-settings|handleWASettingsSubmit|loadWaApiSettings|openWaSettings', content):
            line_no = content[:match.start()].count('\n') + 1
            print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
