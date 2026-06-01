import os
import re

files_to_search = [
    'index.html',
    'js/app.js',
    'js/api-whatsapp.js'
]

keywords = ['gateway', 'nodejs', 'fona', 'fononte', 'whacenter', 'wagateway', 'api_wa', 'wa_api', 'whatsapp_api', 'url_wa', 'wa_url', 'api-whatsapp', 'loadWaApiSettings', 'waApiSettings']

for filename in files_to_search:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"\nSearching in {filename}:")
        for keyword in keywords:
            matches = list(re.finditer(re.escape(keyword), content, re.IGNORECASE))
            if matches:
                print(f"  Keyword '{keyword}' matches: {len(matches)}")
                for m in matches[:5]: # Show first 5
                    pos = m.start()
                    line_no = content[:pos].count('\n') + 1
                    line_content = content.splitlines()[line_no-1].strip()
                    print(f"    Line {line_no}: {line_content[:120]}")
