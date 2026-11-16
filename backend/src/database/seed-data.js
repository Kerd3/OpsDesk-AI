// ---------------------------------------------------------------------------
// FICTIONAL DEMONSTRATION DATA — every person, device, network name and
// procedure below is invented for local development of OpsDesk AI.
// "Harborview Logistics" is a fictional company.
// ---------------------------------------------------------------------------

export const DEMO_USERS = [
  { key: 'admin', email: 'admin@opsdesk.local', fullName: 'Morgan Ellis', role: 'admin', department: 'IT', jobTitle: 'IT Manager' },
  { key: 'support', email: 'support@opsdesk.local', fullName: 'Jordan Reyes', role: 'it_support', department: 'IT', jobTitle: 'IT Support Specialist' },
  { key: 'support2', email: 'support2@opsdesk.local', fullName: 'Priya Nair', role: 'it_support', department: 'IT', jobTitle: 'Systems Technician' },
  { key: 'employee', email: 'employee@opsdesk.local', fullName: 'Sam Carter', role: 'employee', department: 'Finance', jobTitle: 'Accounts Analyst' },
  { key: 'employee2', email: 'employee2@opsdesk.local', fullName: 'Taylor Brooks', role: 'employee', department: 'Operations', jobTitle: 'Dispatch Coordinator' },
  { key: 'employee3', email: 'lee.santos@opsdesk.local', fullName: 'Lee Santos', role: 'employee', department: 'Sales', jobTitle: 'Account Executive' },
  { key: 'employee4', email: 'casey.kim@opsdesk.local', fullName: 'Casey Kim', role: 'employee', department: 'Human Resources', jobTitle: 'HR Generalist' },
  { key: 'employee5', email: 'drew.patel@opsdesk.local', fullName: 'Drew Patel', role: 'employee', department: 'Operations', jobTitle: 'Warehouse Lead' },
  { key: 'inactive', email: 'former.employee@opsdesk.local', fullName: 'Robin Hale', role: 'employee', department: 'Sales', jobTitle: 'Sales Associate', isActive: false },
];

export const DEMO_ARTICLES = [
  {
    slug: 'connect-to-office-wifi',
    title: 'How to connect to the office Wi-Fi',
    description: 'Join the HV-Corp wireless network on a company laptop and fix common connection problems.',
    category: 'network',
    tags: ['wifi', 'wireless', 'network', 'laptop', 'internet'],
    content: `Company laptops connect to the **HV-Corp** wireless network. The **HV-Guest** network is for visitors only and cannot reach internal systems.

## Connect for the first time
1. Click the network icon in the Windows taskbar.
2. Select **HV-Corp** and click **Connect**.
3. When prompted, sign in with your company email address and network password.
4. Accept the certificate prompt named "radius.harborview.local" (fictional demo certificate).

## If the laptop will not connect
1. Make sure airplane mode is off and Wi-Fi is turned on.
2. Turn Wi-Fi off, wait 10 seconds and turn it back on.
3. Select HV-Corp, choose **Forget**, then connect again and re-enter your password.
4. Restart the laptop.
5. Check whether colleagues near you can connect. If nobody can, the access point may be down.

## When to contact IT
Create a support ticket in the **Network** category if the laptop still cannot connect after these steps, if you see a certificate warning with a different name, or if your password is rejected even though it works for email.`,
  },
  {
    slug: 'configure-gmail-company-account',
    title: 'How to configure your company Gmail account',
    description: 'Set up company email in a browser, in the Gmail mobile app, and with 2-Step Verification.',
    category: 'email_accounts',
    tags: ['gmail', 'email', 'google workspace', 'mobile', 'account'],
    content: `Company email is provided through Google Workspace. Your address has the format firstname.lastname@harborview.example.

## Set up in a browser
1. Open Google Chrome and go to mail.google.com.
2. Sign in with your company email address and the temporary password from your welcome letter.
3. Create a new password when prompted. It must be at least 12 characters.
4. Set up 2-Step Verification when asked. This is required for all company accounts.

## Set up on a phone
1. Install the official **Gmail** app from the App Store or Google Play.
2. Open the app, tap **Add another account** and choose **Google**.
3. Sign in with your company address and approve the 2-Step Verification prompt.

## Common problems
- "Couldn't sign you in": check that you are using your company address, not a personal one.
- Not receiving the verification code: make sure your phone has signal, or use a backup code.
- Emails missing: check the **Spam** and **All Mail** folders.

If you are locked out or lost your 2-Step Verification device, create a ticket in the **Email and Accounts** category. IT staff must verify your identity before restoring access.`,
  },
  {
    slug: 'troubleshoot-office-printer',
    title: 'How to troubleshoot an office printer',
    description: 'Fix printers that are offline, not responding, jammed, or printing blank pages.',
    category: 'printer',
    tags: ['printer', 'printing', 'paper jam', 'offline', 'hardware'],
    content: `Shared printers on each floor are named by location, for example **HV-PRN-2F-EAST** (fictional).

## Printer is not responding or shows "Offline"
1. Check the printer's display panel for an error message and that it is powered on.
2. Make sure your laptop is connected to HV-Corp Wi-Fi or the office network, not HV-Guest.
3. On your laptop, open **Settings > Bluetooth & devices > Printers & scanners**, select the printer and choose **Open print queue**.
4. Cancel any stuck documents in the queue, then try printing again.
5. Restart your laptop.

## Paper jam
1. Follow the jam diagram shown on the printer's display.
2. Open only the trays and doors indicated and pull paper out slowly in the direction of the paper path.
3. Never use tools or force to remove paper.

## Blank or faded pages
Check the toner level on the printer display. Replacement toner is requested through a support ticket; do not order supplies directly.

## When to contact IT
Create a ticket in the **Printer** category with the printer name shown on its label if it remains offline for everyone, shows a hardware error code, or makes grinding noises.`,
  },
  {
    slug: 'reset-windows-password-approved-process',
    title: 'How to reset your Windows password (approved process)',
    description: 'Change a password you know, or request a reset through the identity-verified IT process.',
    category: 'access_permissions',
    tags: ['password', 'windows', 'reset', 'account', 'locked out'],
    content: `Your Windows sign-in uses the same company account as email.

## If you know your current password
1. Press **Ctrl + Alt + Delete** and choose **Change a password**.
2. Enter your current password and then your new password twice.
3. New passwords must be at least 12 characters and must not match your last 5 passwords.

## If you forgot your password or are locked out
For security, IT never resets passwords based on an email or chat message alone.
1. Use a colleague's computer or your phone to open the OpsDesk portal, or ask a colleague to raise a ticket for you.
2. Create a ticket in the **Access and Permissions** category with the subject "Password reset".
3. IT staff will call you on the phone number in the HR directory to verify your identity.
4. After verification you will receive a one-time temporary password, which you must change at first sign-in.

## Account locked after failed attempts
Accounts unlock automatically after 15 minutes. Do not keep retrying, because each failed attempt restarts the timer.`,
  },
  {
    slug: 'basic-windows-troubleshooting',
    title: 'Basic Windows troubleshooting for a slow or frozen computer',
    description: 'Simple checks to try before contacting IT when Windows is slow, freezing, or an app stops responding.',
    category: 'software',
    tags: ['windows', 'slow computer', 'performance', 'freeze', 'restart', 'updates'],
    content: `Many slow or frozen computers recover with a few safe steps.

## Steps to try
1. Save your work and **restart** the computer (Start > Power > Restart). Choosing Shut down does not fully clear memory when Fast Startup is on.
2. Close applications you are not using, especially browsers with many tabs.
3. Open **Task Manager** (Ctrl + Shift + Esc) and check the **Processes** tab for apps using high CPU or memory. You may end tasks for your own apps; do not end Windows system processes.
4. Check for updates in **Settings > Windows Update** and install pending updates, then restart.
5. Make sure at least 10% of the disk is free: open File Explorer > This PC. Empty the Recycle Bin and move large personal files to your company Google Drive.

## An application stopped responding
1. Wait 30 seconds, as the app may still be working.
2. Open Task Manager, select the app and click **End task**.
3. Open the app again. If it fails repeatedly, note any error message.

## When to contact IT
Create a ticket in the **Software** category (or **Hardware** if you hear clicking noises, see overheating warnings, or the computer turns off by itself). Include the exact error message and when the problem started.`,
  },
  {
    slug: 'request-software-installation',
    title: 'How to request software installation',
    description: 'Request approved or new software for your company computer through OpsDesk.',
    category: 'software',
    tags: ['software', 'installation', 'license', 'request', 'approval'],
    content: `Employees do not have administrator rights on company computers, so software is installed by IT.

## Approved software
Common approved applications (for example Google Chrome, Zoom, Adobe Acrobat Reader and Slack) are installed by IT on request at no cost to your department.

## How to request software
1. Create a support ticket in the **Software** category.
2. Use the subject "Software request: <application name>".
3. In the description include the application name and version, why you need it for your work, and whether it requires a paid license.
4. Paid or new software requires approval from your manager. IT will add your manager to the ticket.
5. IT staff will schedule the installation and contact you when it is complete.

## Please do not
- Download installers from the internet or install software from USB drives.
- Use personal accounts or trial versions for company work.`,
  },
  {
    slug: 'basic-network-troubleshooting',
    title: 'Basic network troubleshooting',
    description: 'Check cables, adapters and connectivity when websites or internal systems will not load.',
    category: 'network',
    tags: ['network', 'internet', 'ethernet', 'dns', 'connectivity', 'wifi'],
    content: `Use these checks when web pages, email or internal systems will not load.

## Steps to try
1. Check whether the problem affects one website or everything. Try opening a different site.
2. If you use a network cable, make sure it is firmly connected at both ends and the port light is on.
3. Restart your computer.
4. Open **Settings > Network & internet** and confirm you are connected to HV-Corp or the wired office network.
5. Run the Windows network troubleshooter: **Settings > System > Troubleshoot > Other troubleshooters > Network and Internet**.
6. Ask a colleague whether their connection works. If several people are affected, report it as one ticket and mention who else is affected.

## When working from home
Restart your home router, and confirm other devices at home can reach the internet before contacting IT.

## When to contact IT
Create a ticket in the **Network** category and include your location, whether you are wired or on Wi-Fi, and any error messages. Mark it **Urgent** only if a whole team or site cannot work.`,
  },
  {
    slug: 'access-shared-drive-and-internal-systems',
    title: 'How to request access to shared drives and internal systems',
    description: 'Request access to shared folders, the finance system, or other internal applications.',
    category: 'access_permissions',
    tags: ['access', 'permissions', 'shared drive', 'internal systems', 'request', 'folder'],
    content: `Access to shared company resources is granted based on your role and requires approval from the resource owner.

## If you cannot open a shared folder you used before
1. Confirm you are connected to the office network or company VPN.
2. Restart your computer so your group memberships refresh.
3. Check with your manager whether your team's folder was moved or renamed.

## How to request new access
1. Create a ticket in the **Access and Permissions** category.
2. Include the exact name of the folder or system, the level of access needed (view or edit), and the business reason.
3. IT staff will ask the resource owner or your manager to approve the request in the ticket.
4. Access is granted after approval and usually takes effect after you sign out and back in.

IT staff cannot grant access based on a chat request, and access is never shared by using another person's account.`,
  },
  {
    slug: 'connect-to-company-vpn',
    title: 'How to connect to the company VPN when working remotely',
    description: 'Use the HV Secure Connect VPN client to reach internal systems from home.',
    category: 'network',
    tags: ['vpn', 'remote work', 'network', 'internal systems', 'home'],
    content: `Internal systems such as shared drives and the finance system are only available on the office network or through the company VPN client **HV Secure Connect** (fictional).

## Connect
1. Make sure you are connected to the internet.
2. Open **HV Secure Connect** from the Start menu.
3. Sign in with your company email and approve the 2-Step Verification prompt on your phone.
4. Wait until the status shows **Connected**.

## If the VPN will not connect
1. Disconnect and reconnect your home Wi-Fi.
2. Quit HV Secure Connect completely (right-click the tray icon > Exit) and open it again.
3. Restart the computer.
4. Check that the date and time on your computer are correct.

Create a ticket in the **Network** category if the VPN still fails, and include the error message shown by the client.`,
  },
  {
    slug: 'laptop-imaging-procedure-draft',
    title: 'New laptop imaging procedure (internal draft)',
    description: 'Internal IT draft — not yet approved for employees.',
    category: 'hardware',
    tags: ['laptop', 'imaging', 'internal'],
    status: 'draft',
    content: 'DRAFT — internal IT procedure for imaging new laptops with the standard build. Not yet reviewed. Employees should not see this content and the AI assistant must never use it.',
  },
  {
    slug: 'legacy-fax-server-instructions',
    title: 'Legacy fax server instructions',
    description: 'Retired — the fax server was decommissioned.',
    category: 'other',
    tags: ['fax', 'legacy'],
    status: 'archived',
    content: 'This article described the decommissioned fax server and is kept only for historical reference.',
  },
];

/** Tickets are listed oldest first. `daysAgo` controls the created date. */
export const DEMO_TICKETS = [
  { daysAgo: 54, requester: 'employee', assignee: 'support', subject: 'Laptop cannot connect to HV-Corp Wi-Fi', category: 'network', priority: 'high', status: 'closed', resolvedAfterHours: 3,
    description: 'Since this morning my laptop shows "Can\'t connect to this network" for HV-Corp. Other people in Finance are connected fine.',
    comments: [
      { author: 'support', body: 'Thanks Sam. Could you try forgetting the network and reconnecting, as described in the Wi-Fi article?' },
      { author: 'support', body: 'Saved network profile was corrupted after the certificate rotation. Removed the profile remotely.', internal: true },
      { author: 'employee', body: 'That worked, I am connected now. Thank you!' },
    ] },
  { daysAgo: 47, requester: 'employee2', assignee: 'support2', subject: 'Printer on 2nd floor east shows offline', category: 'printer', priority: 'medium', status: 'closed', resolvedAfterHours: 26,
    description: 'HV-PRN-2F-EAST shows as offline for the whole dispatch team. The display says "Network error 49".',
    comments: [{ author: 'support2', body: 'Network module replaced by the vendor technician. Printer is back online.' }] },
  { daysAgo: 40, requester: 'employee3', assignee: 'support', subject: 'Request Zoom installation', category: 'software', priority: 'low', status: 'resolved', resolvedAfterHours: 20,
    description: 'I need Zoom installed for calls with a client who does not use Google Meet.',
    comments: [{ author: 'support', body: 'Zoom has been installed. Please confirm it opens correctly and we will close the ticket.' }] },
  { daysAgo: 33, requester: 'employee4', assignee: 'support2', subject: 'Locked out of Gmail after changing phone', category: 'email_accounts', priority: 'high', status: 'closed', resolvedAfterHours: 5,
    description: 'I got a new phone and can no longer receive the 2-Step Verification prompt, so I cannot sign in to email.',
    comments: [
      { author: 'support2', body: 'Identity verified by phone call using the HR directory number.', internal: true },
      { author: 'support2', body: 'I have issued backup codes. Please sign in and register your new phone.' },
    ] },
  { daysAgo: 27, requester: 'employee5', assignee: 'support', subject: 'Warehouse scanner laptop very slow', category: 'hardware', priority: 'medium', status: 'resolved', resolvedAfterHours: 50,
    description: 'The laptop at the loading dock takes several minutes to open the inventory system and freezes often.',
    comments: [{ author: 'support', body: 'Disk was almost full and the battery is swelling. Replaced the laptop with AST-0009.' }] },
  { daysAgo: 21, requester: 'employee', assignee: 'support2', subject: 'Need access to Finance shared drive "Budget 2027"', category: 'access_permissions', priority: 'medium', status: 'waiting_for_employee',
    description: 'My manager asked me to help with next year\'s budget. I need edit access to the Budget 2027 folder.',
    comments: [{ author: 'support2', body: 'Could you ask your manager to reply on this ticket to approve the edit access?' }] },
  { daysAgo: 16, requester: 'employee2', assignee: 'support', subject: 'Outlook-style signature not showing in Gmail', category: 'email_accounts', priority: 'low', status: 'in_progress',
    description: 'My email signature with the company logo disappeared after I signed in on a new computer.',
    comments: [{ author: 'support', body: 'Looking into this. Signatures are stored per account so it should sync — checking settings.' }] },
  { daysAgo: 12, requester: 'employee3', assignee: null, subject: 'VPN disconnects every 10 minutes at home', category: 'network', priority: 'medium', status: 'open',
    description: 'HV Secure Connect drops the connection roughly every 10 minutes when I work from home. I already restarted my router.' },
  { daysAgo: 8, requester: 'employee4', assignee: 'support', subject: 'Monitor flickering', category: 'hardware', priority: 'low', status: 'in_progress',
    description: 'My second monitor flickers every few seconds. I tried a different cable and it still happens.',
    comments: [{ author: 'support', body: 'Spare monitor AST-0005 reserved for a swap on Thursday.', internal: true }] },
  { daysAgo: 5, requester: 'employee5', assignee: null, subject: 'Whole warehouse lost network connection', category: 'network', priority: 'urgent', status: 'open',
    description: 'None of the warehouse computers or scanners can reach the inventory system. Office staff seem unaffected.' },
  { daysAgo: 3, requester: 'employee', assignee: null, subject: 'Excel crashes when opening large reports', category: 'software', priority: 'medium', status: 'open',
    description: 'Excel closes without any error when I open the monthly ledger export (about 80 MB).' },
  { daysAgo: 2, requester: 'employee2', assignee: 'support2', subject: 'Request new keyboard', category: 'hardware', priority: 'low', status: 'resolved', resolvedAfterHours: 4,
    description: 'Several keys on my keyboard stick. Could I get a replacement?',
    comments: [{ author: 'support2', body: 'New keyboard AST-0011 assigned and delivered to your desk.' }] },
  { daysAgo: 1, requester: 'employee3', assignee: null, subject: 'Cannot print to color printer', category: 'printer', priority: 'low', status: 'open',
    description: 'Color print jobs stay in the queue forever. Black and white printing works.' },
  { daysAgo: 0, requester: 'employee4', assignee: 'support', subject: 'Access to recruiting system for new hire onboarding', category: 'access_permissions', priority: 'high', status: 'open',
    description: 'I start running onboarding next week and need access to the recruiting system. My manager has approved this.' },
];

export const DEMO_ASSETS = [
  { name: 'ThinkPad T14 Gen 5', category: 'laptop', manufacturer: 'Lenovo', model: 'T14 Gen 5', serial: 'DEMO-LNV-0001', assignee: 'employee', location: 'HQ 3rd floor, Finance', purchaseDate: '2025-02-10', condition: 'good' },
  { name: 'Latitude 5450', category: 'laptop', manufacturer: 'Dell', model: 'Latitude 5450', serial: 'DEMO-DEL-0002', assignee: 'employee2', location: 'HQ 2nd floor, Dispatch', purchaseDate: '2025-04-22', condition: 'good' },
  { name: 'MacBook Air 13"', category: 'laptop', manufacturer: 'Apple', model: 'MacBook Air M3', serial: 'DEMO-APL-0003', assignee: 'employee3', location: 'Remote', purchaseDate: '2024-11-05', condition: 'good' },
  { name: 'OptiPlex Micro', category: 'desktop', manufacturer: 'Dell', model: 'OptiPlex 7020', serial: 'DEMO-DEL-0004', assignee: 'employee4', location: 'HQ 1st floor, HR', purchaseDate: '2024-06-18', condition: 'fair' },
  { name: '27" Monitor', category: 'monitor', manufacturer: 'Dell', model: 'P2725H', serial: 'DEMO-DEL-0005', assignee: null, location: 'IT storage room', purchaseDate: '2025-01-15', condition: 'new' },
  { name: '24" Monitor', category: 'monitor', manufacturer: 'LG', model: '24MR400', serial: 'DEMO-LG-0006', assignee: 'employee4', location: 'HQ 1st floor, HR', purchaseDate: '2023-09-30', condition: 'poor' },
  { name: 'Floor printer 2F East', category: 'printer', manufacturer: 'HP', model: 'LaserJet M611', serial: 'DEMO-HP-0007', assignee: null, location: 'HQ 2nd floor, east', purchaseDate: '2022-03-12', condition: 'fair', status: 'under_maintenance', notes: 'Network module replaced by vendor. Monitoring for recurrence.' },
  { name: 'Branch router', category: 'router', manufacturer: 'Cisco', model: 'ISR 1100', serial: 'DEMO-CSC-0008', assignee: null, location: 'Warehouse network closet', purchaseDate: '2021-08-01', condition: 'good', status: 'available', notes: 'Spare router for the warehouse site.' },
  { name: 'ThinkPad E16 (warehouse)', category: 'laptop', manufacturer: 'Lenovo', model: 'E16 Gen 2', serial: 'DEMO-LNV-0009', assignee: 'employee5', location: 'Warehouse loading dock', purchaseDate: '2026-10-20', condition: 'new' },
  { name: 'Old warehouse laptop', category: 'laptop', manufacturer: 'HP', model: 'ProBook 450 G6', serial: 'DEMO-HP-0010', assignee: null, location: 'IT storage room', purchaseDate: '2019-05-14', condition: 'damaged', status: 'retired', notes: 'Swollen battery. Retired and awaiting e-waste pickup.' },
  { name: 'Wireless keyboard', category: 'keyboard', manufacturer: 'Logitech', model: 'MX Keys S', serial: 'DEMO-LOG-0011', assignee: 'employee2', location: 'HQ 2nd floor, Dispatch', purchaseDate: '2026-11-01', condition: 'new' },
  { name: 'Wireless mouse', category: 'mouse', manufacturer: 'Logitech', model: 'MX Master 3S', serial: 'DEMO-LOG-0012', assignee: 'employee', location: 'HQ 3rd floor, Finance', purchaseDate: '2025-02-10', condition: 'good' },
  { name: 'Spare docking station', category: 'other', manufacturer: 'Lenovo', model: 'ThinkPad Universal USB-C Dock', serial: 'DEMO-LNV-0013', assignee: null, location: 'IT storage room', purchaseDate: '2025-03-03', condition: 'good' },
];
