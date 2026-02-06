# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a Next.js 16.1.6 (App Router) project with React 19, TypeScript, Tailwind CSS v4, and Firebase integration. The project is configured for deployment on Firebase App Hosting.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

### Firebase Emulators
```bash
firebase emulators:start   # Start all Firebase emulators
```

Emulator ports:
- Auth: 9099
- Firestore: 8080
- Storage: 9199
- UI: Auto-assigned (check terminal output)

## Project Architecture

### Next.js App Router Structure
- `app/` - Main application directory using Next.js App Router
  - `layout.tsx` - Root layout with font configuration (Geist Sans & Geist Mono)
  - `page.tsx` - Home page component
  - `globals.css` - Global styles (Tailwind CSS v4)
- `public/` - Static assets (SVG files)

### Firebase Configuration
The project uses Firebase with multiple services:
- **Firestore**: Database located in `us-central1` with security rules in `firestore.rules`
- **Storage**: File storage with rules in `storage.rules`
- **App Hosting**: Backend deployed on Cloud Run (config in `apphosting.yaml`)

**IMPORTANT**: Current Firestore and Storage security rules are open (allow all read/write) and expire on 2026-03-08. These are development rules only.

### TypeScript Configuration
- Path alias: `@/*` maps to project root
- Target: ES2017
- JSX: react-jsx mode (not preserve)
- Strict mode enabled

### Build Configuration
- ESLint uses Next.js core-web-vitals and TypeScript presets
- Tailwind CSS v4 with PostCSS
- Firebase project name: `nextands`

## Key Patterns

### Styling
The project uses Tailwind CSS v4 with a dark mode variant. Components should follow the established pattern:
- Use utility classes with responsive variants (sm:, md:, etc.)
- Support dark mode with `dark:` prefix
- Fonts available: `font-sans` (Geist), `font-mono` (Geist Mono)

### Components
- All components are React Server Components by default (App Router)
- Use `"use client"` directive only when needed for client-side interactivity
- Image optimization via `next/image` is configured

## Firebase Development

### Security Rules
When modifying `firestore.rules` or `storage.rules`:
1. Test with emulators first: `firebase emulators:start`
2. Rules use Firebase Security Rules v2 syntax
3. Update expiration timestamps when developing

### Deployment
The project is configured for Firebase App Hosting. Deployment config:
- Region: us-central1
- Backend ID: nextands
- Cloud Run with min 0 instances (scales to zero)
