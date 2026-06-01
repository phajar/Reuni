import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]
for file in html_files:
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Extract script src attributes
    scripts = re.findall(r'<script[^>]*src=["\'](.*?)["\']', content, re.IGNORECASE)
    # Extract link stylesheet href attributes
    stylesheets = re.findall(r'<link[^>]*rel=["\']stylesheet["\'][^>]*href=["\'](.*?)["\']', content, re.IGNORECASE)
    stylesheets += re.findall(r'<link[^>]*href=["\'](.*?)["\'][^>]*rel=["\']stylesheet["\']', content, re.IGNORECASE)
    
    print(f"\n=== {file} ===")
    if scripts:
        print("  Scripts:")
        for script in scripts:
            print(f"    - {script}")
    if stylesheets:
        print("  Stylesheets:")
        for sheet in stylesheets:
            print(f"    - {sheet}")
