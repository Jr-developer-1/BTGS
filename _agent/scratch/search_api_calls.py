import sys

def read_file_safely(path):
    with open(path, "rb") as f:
        data = f.read()
    if data.startswith(b'\xff\xfe') or data.startswith(b'\xfe\xff'):
        return data.decode("utf-16", errors="ignore")
    try:
        return data.decode("utf-8")
    except Exception:
        return data.decode("latin1", errors="ignore")

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    content = read_file_safely("c:/Users/Usha/Desktop/TGS_LIVE/_agent/scratch/logcat_full.txt")
    lines = content.splitlines()

    print(f"Total lines: {len(lines)}")
    
    matches = []
    for idx, line in enumerate(lines):
        line_lower = line.lower()
        if "api" in line_lower or "http" in line_lower or "trip" in line_lower or "fetch" in line_lower:
            matches.append((idx, line))
            
    print(f"Found {len(matches)} matching lines:")
    for idx, line in matches[-100:]:  # Print the last 100 matches
        print(f"Line {idx}: {line.strip()}")

if __name__ == "__main__":
    main()
