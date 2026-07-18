import os
import re

frontend_dir = r"d:\Trackify\frontend"

pattern = re.compile(
    r'<svg[^>]*class="[^"]*feather-activity[^"]*"[^>]*style="[^"]*width:\s*22px;[^"]*color:\s*#2563eb[^"]*"[^>]*>.*?</svg>\s*', 
    re.IGNORECASE | re.DOTALL
)

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    if pattern.search(content):
        new_content = pattern.sub('', content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Removed SVG logo in: {filepath}")

def main():
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
