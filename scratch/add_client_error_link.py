import os
import re

frontend_dir = r"d:\Trackify\frontend\admin"

# Target search pattern: audit logs sidebar link
pattern = re.compile(
    r'(<a class="sidebar-link[^"]*" href="/admin/audit-logs">.*?<span>Activity Audit Logs</span></a>)',
    re.IGNORECASE | re.DOTALL
)

# Link to insert right after the audit-logs link
inserted_link = '\\1\n        <a class="sidebar-link" href="/admin/client-errors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-triangle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>App Crash Logs</span></a>'

def process_file(filepath):
    # Skip client-errors.html itself since we already put the link active there
    if filepath.endswith('client-errors.html'):
        return

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content
    
    # Only replace if client-errors link is not already there
    if '/admin/client-errors' not in new_content:
        if pattern.search(new_content):
            new_content = pattern.sub(inserted_link, new_content)
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Added client-errors sidebar link to: {filepath}")

def main():
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
