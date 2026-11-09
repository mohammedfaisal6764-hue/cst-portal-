# Cloudflare Worker Deploy Guide

## Step 1 — Node.js install করো (না থাকলে)
https://nodejs.org থেকে download করো

## Step 2 — Terminal/CMD খোলো, এই folder এ যাও
```
cd cloudflare-worker
```

## Step 3 — Wrangler install করো
```
npm install -g wrangler
```

## Step 4 — Cloudflare login করো
```
wrangler login
```
Browser এ popup আসবে — Allow করো

## Step 5 — Deploy করো
```
wrangler deploy
```

Deploy হলে এরকম URL দেবে:
```
https://cst-upload.YOUR_NAME.workers.dev
```

## Step 6
ওই URL টা আমাকে দাও — r2.js এ বসিয়ে দেব!
