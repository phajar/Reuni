with open('pembayaran.html', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

payment_keywords = ['rekening', 'bukti', 'upload', 'kirim', 'submit', 'bank', 'transfer', 'metode', 'bayar']
for idx, line in enumerate(lines, 1):
    if any(k in line.lower() for k in payment_keywords):
        if any(term in line for term in ['id=', 'class=', 'function', 'const', 'let', 'var']):
            print(f"Line {idx}: {line.strip()}")
            # If it's a script or button, print context
            if 'script' in line or 'btn' in line or 'submit' in line:
                print("--- Context ---")
                start = max(0, idx - 5)
                end = min(len(lines), idx + 10)
                for i in range(start, end):
                    print(f"{i+1}: {lines[i]}", end="")
                print("="*40)
