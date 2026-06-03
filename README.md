# arowise-site

The published homepage for **AroWise Automation** (arowise.com). Static HTML/CSS, no build step.

- `index.html` + `styles.css` are the whole site.
- Hosted on **Vercel**, custom domain `arowise.com` (the other two domains redirect to it).

## Source of truth
The working source lives in the private vault at `~/AroWise/20-Projects/website/`. To update the
live site: copy the latest `index.html` + `styles.css` here and push to `main` (Vercel auto-deploys).

## Local preview
```
python3 -m http.server 4321   # then open http://localhost:4321
```
