import os
import re

frontend_dir = r"d:\Trackify\frontend"

replacements = [
    # 1. rgba white overrides
    (re.compile(r'background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\);?', re.IGNORECASE),
     'background: var(--bg-secondary);'),
    (re.compile(r'background:\s*rgba\(255,\s*255,\s*255,\s*0\.95\);?', re.IGNORECASE),
     'background: var(--bg-secondary);'),
    (re.compile(r'background:\s*rgba\(255,\s*255,\s*255,\s*0\.9\);?', re.IGNORECASE),
     'background: var(--bg-secondary);'),

    # 2. Hardcoded white background in styles/cards
    (re.compile(r'background:\s*#ffffff\s*!important;?', re.IGNORECASE),
     'background: var(--bg-secondary) !important;'),
    (re.compile(r'background-color:\s*#ffffff\s*!important;?', re.IGNORECASE),
     'background-color: var(--bg-secondary) !important;'),
    (re.compile(r'background:\s*#ffffff;?', re.IGNORECASE),
     'background: var(--bg-secondary);'),
    (re.compile(r'background-color:\s*#ffffff;?', re.IGNORECASE),
     'background-color: var(--bg-secondary);'),

    # 3. Hardcoded slate/primary backgrounds
    (re.compile(r'background:\s*#f8fafc;?', re.IGNORECASE),
     'background: var(--bg-primary);'),
    (re.compile(r'background-color:\s*#f8fafc;?', re.IGNORECASE),
     'background-color: var(--bg-primary);'),
    (re.compile(r'background:\s*#f1f5f9;?', re.IGNORECASE),
     'background: var(--bg-primary);'),
    (re.compile(r'background-color:\s*#f1f5f9;?', re.IGNORECASE),
     'background-color: var(--bg-primary);'),

    # 4. Hardcoded text colors inside style overrides
    (re.compile(r'color:\s*#0f172a;?', re.IGNORECASE),
     'color: var(--text-primary);'),
    (re.compile(r'color:\s*#475569;?', re.IGNORECASE),
     'color: var(--text-secondary);'),
    (re.compile(r'color:\s*#334155;?', re.IGNORECASE),
     'color: var(--text-secondary);'),

    # 5. Borders and dividers
    (re.compile(r'border:\s*1px\s*dashed\s*#cbd5e1;?', re.IGNORECASE),
     'border: 1px dashed var(--border-color);'),
    (re.compile(r'border:\s*2px\s*solid\s*#334155;?', re.IGNORECASE),
     'border: 2px solid var(--border-color);'),
    (re.compile(r'border-right:\s*2px\s*solid\s*#334155;?', re.IGNORECASE),
     'border-right: 2px solid var(--border-color);'),
    (re.compile(r'border-bottom:\s*2px\s*solid\s*#334155;?', re.IGNORECASE),
     'border-bottom: 2px solid var(--border-color);'),
    (re.compile(r'border-left:\s*3px\s*solid\s*#2563eb;?', re.IGNORECASE),
     'border-left: 3px solid var(--primary);'),
    (re.compile(r'border-color:\s*rgba\(226,\s*232,\s*240,\s*0\.8\);?', re.IGNORECASE),
     'border-color: var(--border-color);')
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content
    for pattern, replacement in replacements:
        if pattern.search(new_content):
            new_content = pattern.sub(replacement, new_content)
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Cleaned overrides in: {filepath}")

def main():
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
