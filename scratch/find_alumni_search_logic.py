with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'alumni-search-input' in line or 'getDocs(collection(db, "alumni"))' in line or 'onSnapshot(collection(db, "alumni"))' in line:
            print(f"Line {idx}: {line.strip()}")
            # Print context
            start = max(0, idx - 10)
            end = idx + 45
            print("--- Context ---")
            with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f2:
                lines = f2.readlines()
                for i in range(start, min(len(lines), end)):
                    print(f"{i+1}: {lines[i]}", end="")
            print("\n" + "="*50)
