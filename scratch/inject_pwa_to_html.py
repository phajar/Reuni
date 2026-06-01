import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

# Service worker registration script
sw_script = """  <!-- PWA Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('[PWA] Registered:', reg.scope))
          .catch((err) => console.error('[PWA] Failed:', err));
      });
    }
  </script>"""

# Manifest and icon links
pwa_links = """  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="img/apple-touch-icon.png">"""

for file in html_files:
    if file == 'index.html.bak':
        continue
        
    print(f"Processing {file}...")
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    # 1. Handle manifest and apple-touch-icon link
    if 'id="manifest-link"' in content or "id='manifest-link'" in content:
        # Replaces existing empty manifest link in index.html
        content = re.sub(r'<link rel="manifest" id="manifest-link">', pwa_links, content)
    else:
        # Insert before </head>
        head_close_idx = content.lower().find('</head>')
        if head_close_idx != -1:
            content = content[:head_close_idx] + pwa_links + "\n" + content[head_close_idx:]
            
    # 2. Handle Service Worker script injection
    # First, strip out any existing duplicate sw registration tags if present (just in case)
    if 'sw.js' not in content:
        body_close_idx = content.lower().find('</body>')
        if body_close_idx != -1:
            content = content[:body_close_idx] + sw_script + "\n" + content[body_close_idx:]
            
    # Save the file
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Successfully processed {file}.")
print("Done!")
