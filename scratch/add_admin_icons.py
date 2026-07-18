import os
import re

frontend_dir = r"d:\Trackify\frontend\admin"

# SVG mappings for admin sidebar
svgs = {
    "dashboard": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-grid"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>',
    "users": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-users"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    "departments": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-layers"><polyline points="12 2 2 7 12 12 22 7 12 2"></polyline><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    "timetable": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-calendar"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    "adjustments": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    "holidays": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></svg>',
    "announcements": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-bell"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    "audit-logs": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-shield"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    "subject-hours": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    "settings": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sliders"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>',
    "logout": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
}

replacements = [
    (re.compile(r'href="/admin/dashboard"[^>]*>\s*(?:Admin Overview|Overview)\s*</a>', re.IGNORECASE),
     f'href="/admin/dashboard">{svgs["dashboard"]}<span>Admin Overview</span></a>'),
     
    (re.compile(r'href="/admin/users"[^>]*>\s*Manage Users\s*</a>', re.IGNORECASE),
     f'href="/admin/users">{svgs["users"]}<span>Manage Users</span></a>'),
     
    (re.compile(r'href="/admin/departments"[^>]*>\s*Departments\s*</a>', re.IGNORECASE),
     f'href="/admin/departments">{svgs["departments"]}<span>Departments</span></a>'),
     
    (re.compile(r'href="/admin/timetable"[^>]*>\s*Timetable Builder\s*</a>', re.IGNORECASE),
     f'href="/admin/timetable">{svgs["timetable"]}<span>Timetable Builder</span></a>'),
     
    (re.compile(r'href="/admin/adjustments"[^>]*>\s*Schedule Adjustments\s*</a>', re.IGNORECASE),
     f'href="/admin/adjustments">{svgs["adjustments"]}<span>Schedule Adjustments</span></a>'),
     
    (re.compile(r'href="/admin/holidays"[^>]*>\s*Holidays Manager\s*</a>', re.IGNORECASE),
     f'href="/admin/holidays">{svgs["holidays"]}<span>Holidays Manager</span></a>'),
     
    (re.compile(r'href="/admin/announcements"[^>]*>\s*Announcements\s*</a>', re.IGNORECASE),
     f'href="/admin/announcements">{svgs["announcements"]}<span>Announcements</span></a>'),
     
    (re.compile(r'href="/admin/audit-logs"[^>]*>\s*Activity Audit Logs\s*</a>', re.IGNORECASE),
     f'href="/admin/audit-logs">{svgs["audit-logs"]}<span>Activity Audit Logs</span></a>'),
     
    (re.compile(r'href="/admin/subject-hours"[^>]*>\s*Subject Hours\s*</a>', re.IGNORECASE),
     f'href="/admin/subject-hours">{svgs["subject-hours"]}<span>Subject Hours</span></a>'),
     
    (re.compile(r'href="/admin/settings"[^>]*>\s*System Settings\s*</a>', re.IGNORECASE),
     f'href="/admin/settings">{svgs["settings"]}<span>System Settings</span></a>'),
     
    (re.compile(r'onclick="handleLogout\(\)"[^>]*>\s*Log Out\s*</a>', re.IGNORECASE),
     f'onclick="handleLogout()">{svgs["logout"]}<span>Log Out</span></a>')
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    modified = False
    new_content = content
    
    # Only replace if they don't already have <svg in them
    for pattern, replacement in replacements:
        # Check if the search area matches and does not already have an SVG icon inside the element
        match = pattern.search(new_content)
        if match and "<svg" not in match.group(0):
            new_content = pattern.sub(replacement, new_content)
            modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Added sidebar SVG icons to: {filepath}")

def main():
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == "__main__":
    main()
