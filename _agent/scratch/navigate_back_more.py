import subprocess
import time
import os

def main():
    dest_dir = r"C:\Users\Usha\AppData\Local\Temp"
    os.makedirs(dest_dir, exist_ok=True)
    
    for i in range(2, 5):
        print(f"Navigating back {i}...")
        subprocess.run(["adb", "shell", "input", "keyevent", "4"])
        time.sleep(2)
        
        subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/screen.png"])
        time.sleep(1)
        
        dest_file = os.path.join(dest_dir, f"screen_back{i}.png")
        subprocess.run(["adb", "pull", "/sdcard/screen.png", dest_file])
        print(f"Back {i} pulled to {dest_file}")
    
if __name__ == "__main__":
    main()
