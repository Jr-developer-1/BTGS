import requests
import time
from concurrent.futures import ThreadPoolExecutor

api_url = "http://103.174.161.68:8001/api/employees"
api_key = "sk_12fbc7b72b804e4eaad0a2bd896d4575" # I can get this from DB usually
headers = {"X-Api-Key": api_key}

def fetch_page(page):
    try:
        resp = requests.get(api_url, params={'page': page}, headers=headers, timeout=10)
        return resp.json().get('results', [])
    except:
        return []

start = time.time()
first_page = requests.get(api_url, headers=headers, timeout=10).json()
count = first_page.get('count', 0)
results = first_page.get('results', [])

num_pages = (count + 9) // 10
print(f"Total count: {count}, Pages: {num_pages}")

with ThreadPoolExecutor(max_workers=20) as executor:
    pages_to_fetch = range(2, num_pages + 1)
    page_results = list(executor.map(fetch_page, pages_to_fetch))

for pr in page_results:
    results.extend(pr)

end = time.time()
print(f"Fetched {len(results)} items in {end - start:.2f} seconds")
