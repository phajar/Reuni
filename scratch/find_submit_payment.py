with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'submitManualPayment' in line or 'submitPayment' in line or 'payment-form' in line:
            print(f"Line {idx}: {line.strip()}")
            # Print context
            start = max(0, idx - 10)
            end = idx + 40
            print(f"--- Context Line {idx} ---")
            with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f2:
                lines = f2.readlines()
                for i in range(start, min(len(lines), end)):
                    print(f"{i+1}: {lines[i]}", end="")
            print("\n" + "="*50)
