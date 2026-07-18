import os

mobile_dir = r"d:\Trackify\mobile\lib"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content

    # Replace old dark card color 0xFF1E293B with pure black 0xFF000000
    if '0xFF1E293B' in new_content:
        new_content = new_content.replace('const Color(0xFF1E293B)', 'const Color(0xFF000000)')
        new_content = new_content.replace('Color(0xFF1E293B)', 'const Color(0xFF000000)')
        modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied pure black theme styling: {filepath}")

def main():
    for root, dirs, files in os.walk(mobile_dir):
        for file in files:
            if file.endswith('.dart'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
