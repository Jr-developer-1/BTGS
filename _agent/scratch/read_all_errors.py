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
    content = read_file_safely("c:/Users/Usha/Desktop/TGS_LIVE/_agent/scratch/logcat_output.txt")
    lines = content.splitlines()

    print(f"Total lines: {len(lines)}")
    for j in range(min(len(lines), 150)):
        print(lines[j])

if __name__ == "__main__":
    main()
