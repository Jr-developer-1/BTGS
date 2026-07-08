def main():
    with open("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\logcat_utf8.txt", "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    print(f"Total lines: {len(lines)}")
    for line in lines[-30:]:
        print(repr(line))

if __name__ == "__main__":
    main()
