import re

with open('index.html.bak', 'r', encoding='utf-8') as f:
    content = f.read()

# Find <div id="dashboard-screen"
match_dash = re.search(r'id="dashboard-screen"', content)
if match_dash:
    start_pos = match_dash.start()
    open_divs = list(re.finditer(r'<div\s', content[:start_pos + 10]))
    exact_start = open_divs[-1].start()
    
    # scan for closing tag
    nest = 0
    idx = exact_start
    while idx < len(content):
        if content[idx:idx+4] == '<div':
            if content[idx+4] in [' ', '>', '\n', '\t']:
                nest += 1
        elif content[idx:idx+6] == '</div>':
            nest -= 1
            if nest == 0:
                idx += 6
                break
        idx += 1
    
    line_start = content[:exact_start].count('\n') + 1
    line_end = content[:idx].count('\n') + 1
    print(f"In BACKUP, dashboard-screen starts at line {line_start} and ends at line {line_end}")
else:
    print("dashboard-screen not found in backup")
