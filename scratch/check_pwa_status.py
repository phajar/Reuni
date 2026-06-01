import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]
print(f"Found {len(html_files)} HTML files:")

for file in html_files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    has_manifest = 'manifest' in content.lower()
    has_sw = 'sw.js' in content or 'serviceWorker' in content
    
    print(f"\n--- {file} ---")
    print(f"Has 'manifest': {has_manifest}")
    print(f"Has service worker registration: {has_sw}")
    
    # Print manifest related lines
    manifest_lines = [line.strip() for line in content.split('\n') if 'manifest' in line.lower()]
    if manifest_lines:
        print("  Manifest lines:")
        for ml in manifest_lines[:3]:
            print(f"    {ml}")
            
    # Print service worker lines
    sw_lines = [line.strip() for line in content.split('\n') if 'sw.js' in line or 'serviceWorker' in line]
    if sw_lines:
        print("  Service worker lines:")
        for sl in sw_lines[:3]:
            print(f"    {sl}")
