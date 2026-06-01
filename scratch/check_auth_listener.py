import glob
import re

for fn in glob.glob('*.html') + glob.glob('js/*.js'):
    with open(fn, 'r', encoding='utf-8') as f:
        content = f.read()
    
    matches = list(re.finditer(r'onAuthStateChanged', content))
    for m in matches:
        start = max(0, m.start() - 50)
        end = min(len(content), m.end() + 250)
        snippet = content[start:end].replace('\n', ' ')
        print(f"{fn}: {snippet[:200]}")
