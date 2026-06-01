import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Check auth state listener - what happens if user is not logged in
print("=== AUTH STATE LISTENER ===")
for i, line in enumerate(lines, 1):
    if "onAuthStateChanged" in line or "auth.currentUser" in line or "STATE.user" in line:
        if len(line.strip()) < 120:
            print(f"  {i}: {line.strip()}")

print("\n=== CEK APAKAH HALAMAN ADMIN DILINDUNGI LOGIN ===")
# Check if role is verified before rendering sensitive data
for i, line in enumerate(lines, 1):
    if ("renderAlumni" in line or "renderFinance" in line or "renderUsers" in line) and "window." in line:
        start = max(0, i-5)
        end = min(len(lines), i+1)
        for j in range(start, end):
            marker = ">>>" if j == i-1 else "   "
            if "role" in lines[j] or "auth" in lines[j].lower() or "render" in lines[j] or "STATE.user" in lines[j]:
                print(f"  {marker} {j+1}: {lines[j].strip()[:100]}")
        print()
        break  # just first instance
