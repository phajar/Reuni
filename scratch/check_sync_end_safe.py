with open('js/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i in range(1080, 1180):
    if i < len(lines):
        line = lines[i]
        # Remove non-ascii
        line_clean = "".join(c for c in line if ord(c) < 128)
        print(f"{i+1}: {line_clean}", end="")
