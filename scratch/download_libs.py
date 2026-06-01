import urllib.request
import os

def download_file(url, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    print(f"Downloading {url} to {filepath}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(filepath, 'wb') as f:
                f.write(response.read())
        print("Success!")
    except Exception as e:
        print("Failed:", e)

# 1. Download Tailwind CSS
download_file("https://cdn.tailwindcss.com", "js/lib/tailwindcss.js")

# 2. Download QRCode.js
download_file("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "js/lib/qrcode.min.js")

# 3. Download Font Awesome CSS
download_file("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css", "css/all.min.css")

# 4. Download Font Awesome Webfonts
webfonts = [
    "fa-solid-900.woff2",
    "fa-regular-400.woff2",
    "fa-brands-400.woff2",
    "fa-v4compat.woff2",
    "fa-solid-900.ttf",
    "fa-regular-400.ttf",
    "fa-brands-400.ttf",
    "fa-v4compat.ttf"
]

for font in webfonts:
    url = f"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/{font}"
    download_file(url, f"webfonts/{font}")
