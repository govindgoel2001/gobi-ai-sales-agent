# Deploy to a VPS

Do this once the agent already replies to you through a tunnel. Deploying
something that has never worked moves the problem somewhere harder to debug.

You need a VPS and a domain or subdomain with an A record pointed at its IP.

## Get the code up

SSH in, install Docker if it is not there, clone the repo.

Copy your `.env` up by hand. It is gitignored and it must stay that way, so
`scp` it or recreate it on the server with an editor.

Copy `knowledge/` up too. It goes into the image at build time, so it has to
exist on the server before you build.

## Build and run

```
docker build -t sales-agent .
docker run -d --name sales-agent \
  --env-file .env \
  -p 127.0.0.1:8080:8080 \
  --restart unless-stopped \
  sales-agent
```

Binding to `127.0.0.1` keeps the app off the public internet. Caddy is the only
thing the world talks to.

Check it stayed up with `docker ps`. If the container is not listed it has
exited, and `docker logs sales-agent` says why in the last few lines. A missing
environment variable is named exactly. An empty `knowledge/` folder is the other
common one.

## TLS

Install Caddy. The whole configuration is this:

```
agent.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Reload Caddy. It gets the certificate itself, so there is no certbot step and
nothing to renew.

Open `https://agent.example.com` in a browser. You should get the status page
with a green dot. A red dot means the app is running but cannot reach Supabase.

## Move Meta over

In the Meta app, under WhatsApp, Configuration, change the callback URL from the
tunnel to `https://agent.example.com/webhooks/whatsapp`. The verify token stays
the same. Verify and save.

Message the number from a real phone and wait for the reply.

## Check it survives a reboot

```
sudo reboot
```

Wait, then load the status page again. If it does not come back, the container
was started without `--restart unless-stopped`.

## Updating

```
git pull
docker build -t sales-agent .
docker rm -f sales-agent
docker run -d --name sales-agent --env-file .env -p 127.0.0.1:8080:8080 --restart unless-stopped sales-agent
```

Changing anything in `knowledge/` needs the same cycle, because the files are
read once at boot.
