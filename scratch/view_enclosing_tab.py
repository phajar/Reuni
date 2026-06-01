with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2150, 2220):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end='')
