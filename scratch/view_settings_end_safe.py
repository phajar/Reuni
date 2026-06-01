with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2505, min(len(lines), 2535)):
    line = lines[i].encode('ascii', 'ignore').decode('ascii')
    print(f"{i+1}: {line}", end='')
