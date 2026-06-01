with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'location.search' in line or 'URLSearchParams' in line:
            print(f"Line {idx}: {line.strip()}")
            # Print context
            start = max(0, idx - 5)
            end = idx + 20
            print("--- Context ---")
            with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f2:
                lines = f2.readlines()
                for i in range(start, min(len(lines), end)):
                    print(f"{i+1}: {lines[i]}", end="")
            print("\n" + "="*50)
