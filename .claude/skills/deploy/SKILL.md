---
name: deploy
description: Put the agent on a VPS behind TLS so it keeps running after the laptop closes. Use once setup works through a tunnel.
---

# Deploy

Only do this after `/setup` produced a real reply. Deploying something that has
never worked just moves the problem somewhere harder to debug.

They need a VPS and a domain or subdomain pointed at its IP.

## 1. Get the code onto the server

SSH in. Install Docker if it is missing. Clone the repo.

Copy their local `.env` up by hand, or recreate it on the server. Never commit
it. Check `git status` shows nothing before and after.

Copy `knowledge/` up too. It goes into the image at build time, but only if it
is on the server.

## 2. Build and run

    docker build -t sales-agent .
    docker run -d --name sales-agent --env-file .env -p 127.0.0.1:8080:8080 --restart unless-stopped sales-agent

Binding to 127.0.0.1 keeps the app off the public internet. Caddy is what the
world talks to.

Check it stayed up with `docker ps`. A container that is not listed has exited,
and `docker logs sales-agent` will say why in the last few lines.

## 3. TLS

Install Caddy. A Caddyfile this short is the whole configuration:

    agent.example.com {
        reverse_proxy 127.0.0.1:8080
    }

Reload Caddy. Caddy gets the certificate itself, so there is no certbot step.

Open `https://agent.example.com` in a browser and check the status page shows a
green dot.

## 4. Move Meta over

In the Meta app, change the callback URL from the tunnel to
`https://agent.example.com/webhooks/whatsapp`. Same verify token. Verify and
save.

Message the number from a real phone and wait for the reply.

## 5. Check it survives a reboot

    sudo reboot

Wait, then load the status page again. If it does not come back, the container
is missing `--restart unless-stopped`.

## Updating later

    git pull
    docker build -t sales-agent .
    docker rm -f sales-agent
    docker run -d --name sales-agent --env-file .env -p 127.0.0.1:8080:8080 --restart unless-stopped sales-agent

A knowledge change needs the same cycle, because files load at boot.
