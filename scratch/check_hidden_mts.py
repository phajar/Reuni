import glob
import re

for fn in glob.glob('*.html') + glob.glob('js/*.js'):
    with open(fn, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple search for "mts" and "hidden" or "display: none"
    for m in re.finditer(r'hidden|display:\s*none', content, re.IGNORECASE):
        start = max(0, m.start() - 50)
        end = min(len(content), m.end() + 50)
        snippet = content[start:end].replace('\n', ' ')
        if 'mts' in snippet.lower() or 'lembaga' in snippet.lower():
            print(f"{fn} matches: {snippet}")
