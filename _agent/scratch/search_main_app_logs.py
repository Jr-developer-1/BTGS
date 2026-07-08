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
    content = read_file_safely("c:/Users/Usha/Desktop/TGS_LIVE/_agent/scratch/logcat_latest.txt")
    lines = content.splitlines()

    print("Searching logs for main app process (PID 20902)...")
    matches = []
    for idx, line in enumerate(lines):
        if "20902" in line:
            matches.append((idx, line))

    print(f"Found {len(matches)} matching lines.")
    for idx, line in matches[-100:]:
        print(f"Line {idx}: {line.strip()}")

if __name__ == "__main__":
    main()
