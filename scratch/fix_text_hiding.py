import os
import re

mobile_dir = r"d:\Trackify\mobile\lib\screens"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content

    # Replace hardcoded dark text color 0xFF0F172A with theme-aware color check
    # 1. color: const Color(0xFF0F172A)
    # 2. color: Color(0xFF0F172A)
    # 3. foregroundColor: const Color(0xFF0F172A)
    # 4. foregroundColor: Color(0xFF0F172A)
    dark_text_pattern = re.compile(r'(color|foregroundColor):\s*(const\s+)?Color\(0xFF0F172A\)', re.IGNORECASE)
    if dark_text_pattern.search(new_content):
        new_content = dark_text_pattern.sub(
            r'\1: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A)',
            new_content
        )
        modified = True

    # Update light grey divider lines 0xFFF1F5F9 to render as charcoal 0xFF1E293B in dark mode
    if 'Color(0xFFF1F5F9)' in new_content:
        new_content = new_content.replace('const Color(0xFFF1F5F9)', 'Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)')
        new_content = new_content.replace('Color(0xFFF1F5F9)', 'Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)')
        modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed text hiding & dividers in: {filepath}")

def main():
    for root, dirs, files in os.walk(mobile_dir):
        for file in files:
            if file.endswith('.dart'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
