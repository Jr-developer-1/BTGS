def read_file_safely(path):
    with open(path, "rb") as f:
        data = f.read()
    # Check UTF-16 BOM
    if data.startswith(b'\xff\xfe') or data.startswith(b'\xfe\xff'):
        return data.decode("utf-16", errors="ignore")
    try:
        return data.decode("utf-8")
    except Exception:
        return data.decode("latin1", errors="ignore")

def main():
    print("Reading logcat...")
    content = read_file_safely("c:/Users/Usha/Desktop/TGS_LIVE/_agent/scratch/logcat_output.txt")
    lines = content.splitlines()

    flutter_lines = []
    for line in lines:
        if "flutter" in line.lower() or "render" in line.lower() or "exception" in line.lower() or "fail" in line.lower():
            flutter_lines.append(line.strip())

    print(f"Found {len(flutter_lines)} lines:")
    for line in flutter_lines[:150]:
        print(line)

if __name__ == "__main__":
    main()
