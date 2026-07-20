import os

def update_touch_icon(directory):
    target = 'href="/assets/images/favicon.png"'
    replacement = 'href="/assets/images/favicon-192.png"'
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if target in content:
                    new_content = content.replace(target, replacement)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated apple-touch-icon in: {file_path}")

if __name__ == '__main__':
    target_dir = r"d:\Trackify\frontend"
    update_touch_icon(target_dir)
