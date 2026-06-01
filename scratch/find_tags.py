import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]
for file in html_files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    head_close = content.lower().find('</head>')
    body_close = content.lower().find('</body>')
    
    print(f"{file:20} | </head> found: {head_close >= 0:<5} | </body> found: {body_close >= 0}")
