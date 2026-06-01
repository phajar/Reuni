import re
import os

keywords = ['tab-settings', 'tab-whatsapp']

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or '.gemini' in root:
        continue
    for file in files:
        if file.endswith('.js'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            for kw in keywords:
                if kw in content:
                    print(f"[{file}] Found '{kw}'")
                    matches = list(re.finditer(rf'{kw}', content))
                    for m in matches:
                        line_no = content[:m.start()].count('\n') + 1
                        line_content = content.split('\n')[line_no-1]
                        print(f"  Line {line_no}: {line_content.strip()}")
