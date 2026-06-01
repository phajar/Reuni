with open('js/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'collection("finance")' in line or 'collection(\'finance\')' in line:
            print(f"Line {idx}: {line.strip()}")
            # Print context
            start = max(0, idx - 10)
            end = idx + 35
            print(f"--- Context Line {idx} ---")
            with open('js/app.js', 'r', encoding='utf-8', errors='ignore') as f2:
                lines = f2.readlines()
                for i in range(start, min(len(lines), end)):
                    print(f"{i+1}: {lines[i]}", end="")
            print("\n" + "="*50)
