# GPTCheap

Premium brutalist access portal for student-priced AI accounts.

## Features
- Supabase Auth (email + password)
- Order tracking linked to user_id
- e-Transfer payment ID generation
- Admin dashboard with search/filter and actions
- Gmail automation worker for payment detection
- Credential inventory assignment

## Local Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Supabase schema
Run `supabase_schema.sql` in the Supabase SQL editor to create:
- `orders`
- `credentials_inventory`
- `admin_actions`
- Indexes and RLS policies

### 3) Environment variables
Create a `.env` file with these keys:
```
PORT
SUPABASE_URL
SUPABASE_SERVICE_KEY
SUPABASE_ANON_KEY
ADMIN_PASSWORD
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REDIRECT_URI
GMAIL_REFRESH_TOKEN
GMAIL_LABEL_PROCESSED
```

### 4) Start backend
```bash
npm start
```

### 5) Start frontend
Serve the repository with any static server (for example `python -m http.server 8000`) and open:
- `/index.html`
- `/signup.html`
- `/login.html`
- `/checkout.html`
- `/dashboard.html`
- `/admin_login.html`

## Gmail Worker
Run the worker manually:
```bash
npm run gmail:worker
```

Schedule via cron or PM2 to run continuously. The worker reads Interac e-Transfer emails, extracts Payment IDs, validates the amount, and marks orders as PAID.

## Deployment (DigitalOcean)

### 1) Droplet setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2) Clone project
Clone the repository to `/home/ubuntu/gptcheap`, then run:
```bash
cd /home/ubuntu/gptcheap
npm install
```

### 3) Configure environment
Create `/home/ubuntu/gptcheap/.env` with the variables listed above.

### 4) Start API with PM2
```bash
pm2 start server.js --name gptcheap-api
pm2 save
pm2 startup
```

### 5) Run Gmail worker with PM2
```bash
pm2 start gmail_worker.js --name gptcheap-gmail
pm2 save
```

### 6) Nginx reverse proxy
Create `/etc/nginx/sites-available/gptcheap`:
```
server {
  listen 80;
  server_name gptcheap.ca www.gptcheap.ca;

  location / {
    root /home/ubuntu/gptcheap;
    index index.html;
    try_files $uri $uri/ =404;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```
Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/gptcheap /etc/nginx/sites-enabled/gptcheap
sudo nginx -t
sudo systemctl restart nginx
```

### 7) SSL (Let’s Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d gptcheap.ca -d www.gptcheap.ca
```

## Testing checklist
- Sign up and login
- Create an order (payment ID generated)
- Admin marks paid and credentials appear
- Gmail worker processes a real e-Transfer email
- Locked account hides credentials and shows lock reason
