with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'import {' in line or '<script type="module">' in line:
            print(f"Line {idx}: {line.strip()}")
            # Print next few lines
            start = idx - 1
            end = idx + 10
            print("--- Context ---")
            with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f2:
                lines = f2.readlines()
                for i in range(start, min(len(lines), end)):
                    print(f"{i+1}: {lines[i]}", end="")
            print("\n" + "="*50)
