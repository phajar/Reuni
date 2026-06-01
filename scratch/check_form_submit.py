with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'document\.getElementById\([\'\"]form-alumni[\'\"]\)\.onsubmit', content)
if match:
    start_idx = match.start()
    idx = start_idx
    while content[idx] != '{':
        idx += 1
    idx += 1
    braces = 1
    while braces > 0 and idx < len(content):
        if content[idx] == '{': braces += 1
        elif content[idx] == '}': braces -= 1
        idx += 1
    
    with open('scratch/submit_body.txt', 'w', encoding='utf-8') as out:
        out.write(content[start_idx:idx])
    print("Successfully wrote submit body to scratch/submit_body.txt")
else:
    print("form-alumni onsubmit not found")
