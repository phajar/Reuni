import os
import re

search_dir = "c:/Users/Ahmad/Downloads/alumni web"
keywords = ['wa-nodejs-container', 'wa-web-api-container']

for root, dirs, files in os.walk(search_dir):
    if ".git" in root or "node_modules" in root or "scratch" in root:
        continue
    for file in files:
        if file.endswith((".js", ".html")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for kw in keywords:
                    matches = list(re.finditer(re.escape(kw), content))
                    if matches:
                        print(f"File: {os.path.relpath(path, search_dir)} - Keyword: {kw}")
                        for m in matches:
                            line_no = content[:m.start()].count('\n') + 1
                            line_content = content.splitlines()[line_no-1].strip()
                            print(f"  Line {line_no}: {line_content[:140]}")
            except Exception as e:
                print(f"Error reading {path}: {e}")
