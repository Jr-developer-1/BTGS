import subprocess

def main():
    print("Dumping logcat directly from adb...")
    res = subprocess.run(["adb", "logcat", "-d"], capture_output=True)
    if res.returncode == 0:
        # Decode using utf-8 or latin1 with ignore to keep it safe
        text = res.stdout.decode("utf-8", errors="ignore")
        # Normalize line endings to LF
        text = text.replace("\r\n", "\n")
        with open("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\logcat_utf8.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Logcat successfully written to logcat_utf8.txt")
    else:
        print("Failed to dump logcat:", res.stderr)

if __name__ == "__main__":
    main()
