<div align="center">

# Truxe Website

Developer-focused marketing site for the Truxe authentication & authorization platform.

</div>

## ⚙️ Tech Stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS 3.4 with custom design tokens
- Framer Motion animations
- Lucide icons
- Plausible analytics (optional) & Brevo waitlist integration

## ▶️ Quickstart

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to explore the landing page.

## 📁 Project Structure

```
app/
  layout.tsx           # Global metadata, fonts, Plausible script
  page.tsx             # Landing page composed of sections
  privacy/terms/support# Legal + support pages
  api/waitlist/        # Waitlist POST handler (Brevo)
components/
  sections/            # Hero, Features, Waitlist, etc.
  ui/                  # Button, Card, Input, Badge primitives
  animations/          # Shared Framer Motion helpers
lib/
  constants.ts         # Site config & content data
  utils.ts             # Tailwind class merger
  brevo.ts             # Waitlist subscription helper
public/
  logo.svg             # Placeholder shield logo
  og-image.png         # Placeholder OG image (1200x630)
styles/globals.css     # Tailwind base layers + theme tokens
```

## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and provide values:

```
BREVO_API_KEY=
BREVO_LIST_ID=
NEXT_PUBLIC_SITE_URL=https://gettruxe.dev
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=gettruxe.dev
```

- `BREVO_*` values power the waitlist API (leave empty to test with mocked responses).
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` toggles the Plausible script in `app/layout.tsx`.

## 🧪 Scripts

- `npm run dev` – start local development
- `npm run build` – create a production build
- `npm run start` – run the production server
- `npm run lint` – lint TypeScript/React files with ESLint

## 🛠️ Implementation Notes

- Content is sourced from `docs/HEIMDALL_WEBSITE_SPEC.md` and encoded in `lib/constants.ts`.
- The waitlist form posts to `/api/waitlist` which relays to Brevo using your API key & list ID.
- `window.plausible` analytics events are fired after successful waitlist submissions.
- Placeholder assets (`logo.svg`, `og-image.png`) should be swapped with final branding before launch.

## 🚀 Deployment

- Primary target: Vercel (recommended). Configure environment variables through the dashboard.
- Alternative: self-host via Docker using the build output in `.next/`.

## 📄 Documentation & Spec

Refer to `docs/HEIMDALL_WEBSITE_SPEC.md` for the complete product and content specification that guided this build.
