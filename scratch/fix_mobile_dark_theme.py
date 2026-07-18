import os
import re

screens_dir = r"d:\Trackify\mobile\lib\screens"

replacements = [
    # Scaffold backgrounds
    (re.compile(r'backgroundColor:\s*Colors\.white\s*,', re.IGNORECASE),
     'backgroundColor: Theme.of(context).scaffoldBackgroundColor,'),
    (re.compile(r'backgroundColor:\s*const\s+Color\(0xFFF8FAFC\)\s*,', re.IGNORECASE),
     'backgroundColor: Theme.of(context).scaffoldBackgroundColor,'),
    (re.compile(r'backgroundColor:\s*Color\(0xFFF8FAFC\)\s*,', re.IGNORECASE),
     'backgroundColor: Theme.of(context).scaffoldBackgroundColor,'),

    # Container backgrounds (BoxDecoration and direct colors)
    (re.compile(r'color:\s*Colors\.white\s*,(\s*//\s*card\b|\s*//\s*container\b|\s*shape:\s*BoxShape\.rectangle|\s*borderRadius:)', re.IGNORECASE),
     'color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white,\\1'),
    (re.compile(r'color:\s*Colors\.white\s*,(\s*border:\s*Border\.all)', re.IGNORECASE),
     'color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white,\\1'),

    # Border colors
    (re.compile(r'border:\s*Border\.all\(\s*color:\s*const\s+Color\(0xFFE2E8F0\)\s*\)\s*,', re.IGNORECASE),
     'border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),'),
    (re.compile(r'border:\s*Border\.all\(\s*color:\s*Color\(0xFFE2E8F0\)\s*\)\s*,', re.IGNORECASE),
     'border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),'),
    (re.compile(r'border:\s*Border\.all\(\s*color:\s*const\s+Color\(0xFFE2E8F0\)\s*,\s*width:\s*[^)]+\)\s*,', re.IGNORECASE),
     'border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),'),

    # Specific Container color cases for list cards
    (re.compile(r'color:\s*Colors\.white\s*(,\s*\n\s*borderRadius:\s*BorderRadius\.zero\s*,\s*\n\s*border:\s*Border\.all)', re.IGNORECASE),
     'color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white\\1'),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content

    # Apply general replacements
    for pattern, replacement in replacements:
        if pattern.search(new_content):
            new_content = pattern.sub(replacement, new_content)
            modified = True

    # Custom file-specific tweaks
    if 'settings_screen.dart' in filepath:
        # Update _Section widget container styling
        old_section_block = """        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.zero,
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),"""
        new_section_block = """        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white,
            borderRadius: BorderRadius.zero,
            border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
          ),"""
        if old_section_block in new_content:
            new_content = new_content.replace(old_section_block, new_section_block)
            modified = True

        # Input fields text labels color tweak (Edit Profile Details headers)
        old_text_style = "const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))"
        new_text_style = "TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFFE2E8F0) : const Color(0xFF374151))"
        if old_text_style in new_content:
            new_content = new_content.replace(old_text_style, new_text_style)
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated dark-theme compatibility: {filepath}")

def main():
    for root, dirs, files in os.walk(screens_dir):
        for file in files:
            if file.endswith('.dart'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
