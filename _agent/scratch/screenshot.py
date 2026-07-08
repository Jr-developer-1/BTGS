import subprocess

def main():
    print("Taking screenshot...")
    # exec-out is faster and avoids line ending conversion issues on Windows
    with open("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\screen.png", "wb") as f:
        res = subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=f)
    if res.returncode == 0:
        print("Screenshot saved to c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\screen.png")
    else:
        print("Failed to take screenshot")

if __name__ == "__main__":
    main()
