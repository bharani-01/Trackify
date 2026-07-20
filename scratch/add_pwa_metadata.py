import os

PWA_TAGS = """  <!-- PWA Support -->
  <link rel="manifest" href="/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Trackify">
  <link rel="apple-touch-icon" href="/assets/images/favicon.png">
"""

def add_pwa_tags(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                print(f"Processing: {file_path}")
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if 'rel="manifest"' in content or 'href="/manifest.json"' in content:
                    print(f"  Already has manifest, skipping.")
                    continue
                
                # We can insert before </head>
                if '</head>' in content:
                    new_content = content.replace('</head>', PWA_TAGS + '</head>')
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"  Successfully added PWA tags.")
                else:
                    print(f"  WARNING: No </head> tag found in {file_path}")

if __name__ == '__main__':
    target_dir = r"d:\Trackify\frontend"
    add_pwa_tags(target_dir)
