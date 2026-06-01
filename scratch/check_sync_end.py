with open('js/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i in range(1080, 1180):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end="")
