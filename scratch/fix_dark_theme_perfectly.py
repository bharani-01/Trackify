import os
import re

mobile_dir = r"d:\Trackify\mobile\lib\screens"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content

    # 1. Remove "const" keyword preceding TextStyle, BorderSide, Border, or EdgeInsets when they will contain Theme.of
    lines = new_content.splitlines()
    for idx, line in enumerate(lines):
        if 'Color(0xFF0F172A)' in line or 'Color(0xFFF1F5F9)' in line or 'Color(0xFFE2E8F0)' in line or 'Colors.white' in line:
            new_line = line
            new_line = new_line.replace('const TextStyle(', 'TextStyle(')
            new_line = new_line.replace('const BorderSide(', 'BorderSide(')
            new_line = new_line.replace('const Border(', 'Border(')
            new_line = new_line.replace('const Border.all(', 'Border.all(')
            new_line = new_line.replace('const EdgeInsets.', 'EdgeInsets.')
            if new_line != line:
                lines[idx] = new_line
                modified = True

    new_content = '\n'.join(lines)

    # 2. Scaffold backgrounds replacement
    scaffold_bg_patterns = [
        (re.compile(r'backgroundColor:\s*Colors\.white\s*,', re.IGNORECASE),
         'backgroundColor: Theme.of(context).scaffoldBackgroundColor,'),
        (re.compile(r'backgroundColor:\s*const\s+Color\(0xFFF8FAFC\)\s*,', re.IGNORECASE),
         'backgroundColor: Theme.of(context).scaffoldBackgroundColor,'),
        (re.compile(r'backgroundColor:\s*Color\(0xFFF8FAFC\)\s*,', re.IGNORECASE),
         'backgroundColor: Theme.of(context).scaffoldBackgroundColor,'),
    ]
    for pattern, replacement in scaffold_bg_patterns:
        if pattern.search(new_content):
            new_content = pattern.sub(replacement, new_content)
            modified = True

    # 3. Card/Container backgrounds (white -> pure black in dark mode)
    # Using unique tokens to prevent duplicate nesting
    if 'color: Colors.white' in new_content:
        new_content = re.sub(
            r'color:\s*Colors\.white\s*,(\s*//\s*card\b|\s*//\s*container\b|\s*shape:\s*BoxShape\.rectangle|\s*borderRadius:)',
            r'color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,\1',
            new_content,
            flags=re.IGNORECASE
        )
        new_content = re.sub(
            r'color:\s*Colors\.white\s*,(\s*border:\s*Border\.all)',
            r'color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,\1',
            new_content,
            flags=re.IGNORECASE
        )
        modified = True

    # 4. Border colors (0xFFE2E8F0 -> 0xFF334155 in dark mode)
    border_patterns = [
        (re.compile(r'border:\s*Border\.all\(\s*color:\s*const\s+Color\(0xFFE2E8F0\)\s*\)\s*,', re.IGNORECASE),
         'border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),'),
        (re.compile(r'border:\s*Border\.all\(\s*color:\s*Color\(0xFFE2E8F0\)\s*\)\s*,', re.IGNORECASE),
         'border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),'),
        (re.compile(r'border:\s*Border\.all\(\s*color:\s*const\s+Color\(0xFFE2E8F0\)\s*,\s*width:\s*([^)]+)\)\s*,', re.IGNORECASE),
         'border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),'),
    ]
    for pattern, replacement in border_patterns:
        if pattern.search(new_content):
            new_content = pattern.sub(replacement, new_content)
            modified = True

    # 5. Text colors (0xFF0F172A -> white/light-grey in dark mode)
    dark_text_pattern = re.compile(r'(color|foregroundColor):\s*(const\s+)?Color\(0xFF0F172A\)', re.IGNORECASE)
    if dark_text_pattern.search(new_content):
        new_content = dark_text_pattern.sub(
            r'\1: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A)',
            new_content
        )
        modified = True

    # 6. Dividers (0xFFF1F5F9 -> 0xFF000000 in dark mode)
    # Using Token-Swapping to avoid nested replacing
    if 'Color(0xFFF1F5F9)' in new_content:
        # Check if already replaced
        if 'TEMP_DIVIDER' not in new_content and 'brightness == Brightness.dark' not in new_content:
            new_content = new_content.replace('const Color(0xFFF1F5F9)', 'TEMP_CONST_DIVIDER')
            new_content = new_content.replace('Color(0xFFF1F5F9)', 'TEMP_DIVIDER')
            
            new_content = new_content.replace('TEMP_CONST_DIVIDER', 'Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : const Color(0xFFF1F5F9)')
            new_content = new_content.replace('TEMP_DIVIDER', 'Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : const Color(0xFFF1F5F9)')
            modified = True

    # Custom tweaks for settings_screen
    if 'settings_screen.dart' in filepath:
        old_section_block = """        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.zero,
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),"""
        new_section_block = """        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,
            borderRadius: BorderRadius.zero,
            border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
          ),"""
        if old_section_block in new_content:
            new_content = new_content.replace(old_section_block, new_section_block)
            modified = True

        old_text_style = "const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))"
        new_text_style = "TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFFE2E8F0) : const Color(0xFF374151))"
        if old_text_style in new_content:
            new_content = new_content.replace(old_text_style, new_text_style)
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Refined pure-black variables in: {filepath}")

def main():
    for root, dirs, files in os.walk(mobile_dir):
        for file in files:
            if file.endswith('.dart'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
