import os, sys, django, pickle
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from django.core.cache import cache

print("=== Django cache files analysis ===")
cache_dir = os.path.join(os.getcwd(), 'backend', 'django_cache')
if not os.path.exists(cache_dir):
    print("Cache dir not found")
    sys.exit(1)

# Let's inspect the files directly or use django's cache backend to read key values if we can guess them.
# The cache backend uses md5 of keys as filenames!
# Let's check some common keys:
keys_to_check = [
    'GLOBAL_EMPLOYEE_DATA',
    'GLOBAL_EMPLOYEE_DATA_TIMESTAMP',
    'user_position_identifiers',
    ':1:GLOBAL_EMPLOYEE_DATA', # django adds prefix/version sometimes
    ':1:GLOBAL_EMPLOYEE_DATA_TIMESTAMP',
]

for k in keys_to_check:
    val = cache.get(k)
    print(f"Key: {repr(k):35s} | Exists?: {val is not None} | Type: {type(val)} | Length: {len(val) if hasattr(val, '__len__') else 'N/A'}")

# Let's try to load all files in cache_dir and print their contents
import hashlib
for fname in os.listdir(cache_dir):
    fpath = os.path.join(cache_dir, fname)
    if fname.endswith('.djcache'):
        try:
            with open(fpath, 'rb') as f:
                # FileBasedCache stores: exp, pickle_data
                exp = pickle.load(f)
                val = pickle.load(f)
                # Print summary
                val_repr = str(val)[:100]
                val_len = len(val) if hasattr(val, '__len__') else 'N/A'
                print(f"File: {fname} | Size: {os.path.getsize(fpath)} | Type: {type(val)} | Len: {val_len} | Val: {val_repr}")
        except Exception as e:
            print(f"Error reading {fname}: {e}")
