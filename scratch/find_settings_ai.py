import sys
sys.stdout.reconfigure(encoding='utf-8')

# Check current settings tab in index.html to find where to add Cloudinary settings
with open(r"c:\Users\Ahmad\Downloads\alumni web\index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=== PENGATURAN AI CONFIG DI index.html ===")
for i, line in enumerate(lines, 1):
    if "ai_config" in line or "gemini_key" in line or "groq_key" in line or "ai-config" in line or "ai_provider" in line:
        if len(line.strip()) < 150:
            print(f"  {i}: {line.strip()[:120]}")

print("\n=== SECTION SETTINGS (tab-settings) ===")
in_settings = False
count = 0
for i, line in enumerate(lines, 1):
    if 'id="tab-settings"' in line or "subbtn-settings-ai" in line:
        in_settings = True
    if in_settings:
        if "card" in line.lower() and "premium" in line.lower():
            print(f"  {i}: {line.strip()[:100]}")
            count += 1
        if count > 20:
            break
