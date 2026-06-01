import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find handleAiSettingsSubmit and loadAiSettings to understand the pattern
print("=== handleAiSettingsSubmit ===")
for i, line in enumerate(lines, 1):
    if "handleAiSettingsSubmit" in line or "loadAiSettings" in line or "ai_config" in line:
        if len(line.strip()) < 150:
            print(f"  {i}: {line.strip()}")

# Find the exact function body
print("\n=== BODY handleAiSettingsSubmit ===")
in_func = False
brace = 0
for i, line in enumerate(lines, 1):
    if "handleAiSettingsSubmit" in line and "=" in line:
        in_func = True
    if in_func:
        print(f"  {i}: {line.rstrip()}")
        brace += line.count('{') - line.count('}')
        if in_func and brace <= 0 and i > 5:
            break
    if i > 500:
        break
