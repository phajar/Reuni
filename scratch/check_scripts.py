with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = re.findall(r'<script[^>]*src=[\"\']([^\"\']*)[\"\'][^>]*>', content)
print("Scripts in index.html:", matches)

# Also check for inline scripts
inline_scripts = re.findall(r'<script[^>]*>([\s\S]*?)<\/script>', content)
print("Total inline scripts:", len(inline_scripts))
