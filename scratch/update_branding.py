import os
import re

frontend_dir = r"d:\Trackify\frontend"

theme_script = """  <script>
    (function() {
      const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      if (localStorage.getItem('sidebar-collapsed') === 'true') {
        document.documentElement.classList.add('sidebar-collapsed');
      }
    })();
  </script>"""

# Regex to find any existing theme script version to replace it cleanly
existing_script_pattern = re.compile(
    r'<\s*script\s*>\s*\(function\(\)\s*\{\s*const\s+theme\s*=\s*localStorage\.getItem\(\'theme\'\).*?\}\)\(\);\s*</\s*script\s*>',
    re.IGNORECASE | re.DOTALL
)

logo_patterns = [
    # Pattern 1: fs-3 with logo ID
    (re.compile(r'<span class="fs-3 fw-bold gradient-accent-text" id="logo">Trackify</span>', re.IGNORECASE), 
     '<img src="/assets/images/logo_light.webp" alt="Trackify Logo" style="height: 32px; width: auto;">'),
    
    # Pattern 2: fs-3 without logo ID
    (re.compile(r'<span class="fs-3 fw-bold gradient-accent-text">Trackify</span>', re.IGNORECASE), 
     '<img src="/assets/images/logo_light.webp" alt="Trackify Logo" style="height: 32px; width: auto;">'),
     
    # Pattern 3: fs-4 white text with letter spacing
    (re.compile(r'<span class="fs-4 fw-bold" style="letter-spacing: -0.03em; color: #ffffff;">Trackify</span>', re.IGNORECASE), 
     '<img src="/assets/images/logo_light.webp" alt="Trackify Logo" style="height: 32px; width: auto;">'),
     
    # Pattern 4: fs-4 simple
    (re.compile(r'<span class="fs-4 fw-bold">Trackify</span>', re.IGNORECASE), 
     '<img src="/assets/images/logo_light.webp" alt="Trackify Logo" style="height: 32px; width: auto;">'),

    # Pattern 5: existing Logo.png text link from previous run
    (re.compile(r'/assets/images/Logo\.png', re.IGNORECASE),
     '/assets/images/logo_light.webp'),

    # Pattern 6: existing Logo.webp text link from previous run
    (re.compile(r'/assets/images/Logo\.webp', re.IGNORECASE),
     '/assets/images/logo_light.webp'),

    # Pattern 7: existing favicon.jpeg text link from previous run
    (re.compile(r'/assets/images/favicon\.jpeg', re.IGNORECASE),
     '/assets/images/favicon.webp'),

    # Pattern 8: type="image/jpeg" to type="image/webp"
    (re.compile(r'type="image/jpeg"', re.IGNORECASE),
     'type="image/webp"')
]

favicon_tag = '<link rel="icon" type="image/webp" href="/assets/images/favicon.webp">'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content
    
    # 1. Apply logo and previous run replacements
    for pattern, replacement in logo_patterns:
        if pattern.search(new_content):
            new_content = pattern.sub(replacement, new_content)
            modified = True
            
    # 2. Add favicon if not present at all
    if '</head>' in new_content and 'favicon.webp' not in new_content:
        new_content = new_content.replace('</head>', f'  {favicon_tag}\n</head>')
        modified = True

    # 3. Replace or inject theme script
    if existing_script_pattern.search(new_content):
        new_content = existing_script_pattern.sub(theme_script, new_content)
        modified = True
    elif '</head>' in new_content and 'data-theme' not in new_content:
        new_content = new_content.replace('</head>', f'{theme_script}\n</head>')
        modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

def main():
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
