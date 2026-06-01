import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]
for file in html_files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
    title = title_match.group(1) if title_match else 'No Title'
    
    # Check if there is already a <head> tag
    head_match = re.search(r'<head>', content, re.IGNORECASE)
    body_close_match = re.search(r'</body>', content, re.IGNORECASE)
    
    print(f"{file:20} | Title: {title:40} | Head: {bool(head_match):<5} | BodyClose: {bool(body_close_match)}")
