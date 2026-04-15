# deploy.py - 一键部署 remind-app 到 Spark2
import paramiko, os

HOST, PORT = '150.158.146.192', 6002
USER, PASSWD = 'wq', '152535'
REMOTE_DIR = '/home/wq/remind-app'
LOCAL_DIR = r'C:\Users\19051\Desktop\ai_deploy\remind app\remind-app'

def upload(sftp, local_path, remote_path):
    if os.path.isdir(local_path):
        try: sftp.mkdir(remote_path)
        except: pass
        for item in os.listdir(local_path):
            upload(sftp, os.path.join(local_path, item), remote_path + '/' + item)
    else:
        sftp.put(local_path, remote_path)
        print(f'  uploaded: {remote_path}')

print('Connecting to Spark2...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASSWD)

# Create remote directory
print('Creating remote directory...')
ssh.exec_command(f'mkdir -p {REMOTE_DIR}')

# Upload source files
sftp = ssh.open_sftp()
print('Uploading files...')

items = [
    ('package.json', 'package.json'),
    ('vite.config.ts', 'vite.config.ts'),
    ('index.html', 'index.html'),
    ('tsconfig.json', 'tsconfig.json'),
    ('src', 'src'),
    ('server', 'server'),
    ('dist', 'dist'),
]
for local_name, remote_name in items:
    local_path = os.path.join(LOCAL_DIR, local_name)
    if os.path.exists(local_path):
        upload(sftp, local_path, os.path.join(REMOTE_DIR, remote_name))
        print(f'  uploaded: {remote_name}')
    else:
        print(f'  skip: {local_name} (not found)')

sftp.close()

# Install server dependencies on server
print('\nInstalling server dependencies...')
stdin, stdout, stderr = ssh.exec_command(f'cd {REMOTE_DIR}/server && npm install 2>&1')
for line in stdout:
    print(line.strip())

# Start container (using volumes - no build needed)
print('\nStarting container...')
stdin, stdout, stderr = ssh.exec_command(
    f'cd {REMOTE_DIR} && docker compose down 2>/dev/null; docker compose up -d 2>&1'
)
for line in stdout:
    print(line.strip())

ssh.close()
print('\n[OK] Deploy done!')
print('Visit: http://150.158.146.192:3001')