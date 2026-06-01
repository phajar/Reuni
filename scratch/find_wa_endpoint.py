import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]
for file in html_files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Search for URL endpoints (like localhost, render, huggingface, 7860, 3000)
    urls = re.findall(r'https?://[a-zA-Z0-9.-]+(?::\d+)?/[a-zA-Z0-9/.-]*', content)
    wa_mentions = [url for url in urls if '7860' in url or 'send' in url or 'localhost' in url]
    
    if wa_mentions:
        print(f"\n--- {file} ---")
        for wm in wa_mentions:
            print(f"  {wm}")
