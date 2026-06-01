with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'manifest-link' in line:
            print(f"Line {idx}: {line.strip()}")
