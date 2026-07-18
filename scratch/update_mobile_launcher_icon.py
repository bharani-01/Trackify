import shutil
import os

src_favicon = r"d:\Trackify\assets\images\favicon.png"
android_res_dir = r"d:\Trackify\mobile\android\app\src\main\res"

mipmap_dirs = [
    "mipmap-hdpi",
    "mipmap-mdpi",
    "mipmap-xhdpi",
    "mipmap-xxhdpi",
    "mipmap-xxxhdpi"
]

def main():
    if not os.path.exists(src_favicon):
        print(f"Source favicon not found at: {src_favicon}")
        return

    for mipmap in mipmap_dirs:
        dest_path = os.path.join(android_res_dir, mipmap, "ic_launcher.png")
        if os.path.exists(os.path.dirname(dest_path)):
            shutil.copy2(src_favicon, dest_path)
            print(f"Updated launcher icon at: {dest_path}")
        else:
            print(f"Directory not found: {os.path.dirname(dest_path)}")

if __name__ == "__main__":
    main()
