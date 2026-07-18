import os

mobile_dir = r"d:\Trackify\mobile\lib\screens"

replacements = [
    ('const TextStyle(', 'TextStyle('),
    ('const BorderSide(', 'BorderSide('),
    ('const Border(', 'Border('),
    ('const Border.all(', 'Border.all('),
    ('const Icon(', 'Icon('),
    ('const EdgeInsets.', 'EdgeInsets.'),
    ('const Text(', 'Text('),
    ('const Padding(', 'Padding('),
    ('const Align(', 'Align('),
    ('const Center(', 'Center('),
    ('const Row(', 'Row('),
    ('const Column(', 'Column('),
    ('const Container(', 'Container('),
    ('const SizedBox(', 'SizedBox('),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content

    for old, new in replacements:
        if old in new_content:
            new_content = new_content.replace(old, new)
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Stripped widget const: {filepath}")

def main():
    for root, dirs, files in os.walk(mobile_dir):
        for file in files:
            if file.endswith('.dart'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
