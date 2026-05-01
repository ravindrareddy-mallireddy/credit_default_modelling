# Design System — Credit Risk Intelligence Platform

## Vibe
Dark fintech. Authoritative. Data-dense but readable. Think Bloomberg terminal meets modern SaaS.

## Colors
- Background: `#050d1a` (deep navy black)
- Surface: `#0a1628` (card background)
- Surface elevated: `#0f1e35` (hover/active)
- Border: `#1a2d4a` (subtle dividers)
- Primary accent: `#00d4ff` (electric cyan)
- Secondary accent: `#3b82f6` (blue)
- Success: `#10b981` (green — PASS badges)
- Warning: `#f59e0b` (amber)
- Danger: `#ef4444` (red)
- Text primary: `#e2e8f0`
- Text muted: `#64748b`
- Text dim: `#334155`

## Typography
- Display/Headings: `Syne` (Google Fonts) — bold, geometric
- Body/UI: `DM Sans` — clean, readable
- Numbers/Code: `DM Mono` — monospace for metric values

## Layout
- Sidebar navigation: fixed left, 240px wide
- Main content: full height scroll
- Stat cards: tight grid, no excessive rounding
- Sharp 2px borders with glow on hover

## Components
- Stat card: dark surface, cyan accent top border, metric in DM Mono
- Badge PASS: green bg/text
- Badge FAIL: red bg/text  
- Charts: use actual PNG plots from /plots/ — display in styled containers
- Tables: dark striped, monospace numbers

## Motion
- Page transition: fade in 200ms
- Card hover: subtle border glow
- No bouncing, no excessive animation
