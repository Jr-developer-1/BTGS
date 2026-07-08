def main():
    with open("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\logcat_full.txt", "r", encoding="utf-8", errors="ignore") as f:
        for i in range(20):
            line = f.readline()
            if not line:
                break
            print(repr(line))

if __name__ == "__main__":
    main()
