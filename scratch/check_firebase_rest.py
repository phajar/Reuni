import urllib.request
import json

def check_collection(name):
    url = f"https://firestore.googleapis.com/v1/projects/reuniakbar/databases/(default)/documents/{name}"
    print(f"Fetching {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"Success! Found {len(data.get('documents', []))} documents.")
            for doc in data.get('documents', [])[:3]:
                print(" - Document ID:", doc['name'].split('/')[-1])
                print("   Fields:", list(doc['fields'].keys()))
    except Exception as e:
        print("Error fetching:", e)

check_collection("payment_accounts")
check_collection("finance")
