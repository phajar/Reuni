import os
import json
import urllib.request
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api'
OUTPUT_DIR = 'api-wilayah'
PROV_ID = '35' # Jawa Timur

def fetch_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            if i == retries - 1:
                print(f"Failed to fetch {url}: {e}")
                raise e
            time.sleep(1)

def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def download_file(url, local_path):
    if os.path.exists(local_path):
        return True
    try:
        data = fetch_json(url)
        save_json(local_path, data)
        return True
    except Exception as e:
        print(f"Error downloading {url} to {local_path}: {e}")
        return False

def main():
    print("Mulai mengunduh data wilayah Jawa Timur (35)...")
    
    # 1. Download regencies Jawa Timur
    reg_url = f"{BASE_URL}/regencies/{PROV_ID}.json"
    reg_path = os.path.join(OUTPUT_DIR, "regencies", f"{PROV_ID}.json")
    print(f"Mengunduh Kabupaten/Kota ke {reg_path}...")
    try:
        regencies = fetch_json(reg_url)
        save_json(reg_path, regencies)
        regency_ids = [r['id'] for r in regencies]
    except Exception as e:
        print(f"Gagal mengunduh kabupaten: {e}")
        return

    print(f"Total Kabupaten/Kota: {len(regency_ids)}")

    # 2. Download districts (Kecamatan)
    district_ids = []
    print("Mengunduh Kecamatan secara pararel...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {}
        for reg_id in regency_ids:
            url = f"{BASE_URL}/districts/{reg_id}.json"
            path = os.path.join(OUTPUT_DIR, "districts", f"{reg_id}.json")
            futures[executor.submit(fetch_json, url)] = (reg_id, path)
            
        for future in as_completed(futures):
            reg_id, path = futures[future]
            try:
                districts = future.result()
                save_json(path, districts)
                for d in districts:
                    district_ids.append(d['id'])
            except Exception as e:
                print(f"Gagal mengunduh kecamatan untuk kabupaten {reg_id}: {e}")

    print(f"Total Kecamatan: {len(district_ids)}")

    # 3. Download villages (Desa)
    print("Mengunduh Desa secara pararel...")
    downloaded_count = 0
    failed_count = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {}
        for dist_id in district_ids:
            url = f"{BASE_URL}/villages/{dist_id}.json"
            path = os.path.join(OUTPUT_DIR, "villages", f"{dist_id}.json")
            futures[executor.submit(download_file, url, path)] = dist_id
            
        for future in as_completed(futures):
            dist_id = futures[future]
            if future.result():
                downloaded_count += 1
            else:
                failed_count += 1
                
            if (downloaded_count + failed_count) % 50 == 0:
                print(f"Progres: {downloaded_count + failed_count}/{len(district_ids)} kecamatan selesai...")

    print(f"Selesai! Berhasil: {downloaded_count}, Gagal: {failed_count}")

if __name__ == '__main__':
    main()
