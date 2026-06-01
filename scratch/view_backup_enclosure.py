with open('index.html.bak', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2260, 2320):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end='')
