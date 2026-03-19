# Design Brief — Persistent Memory Chat
*For use with AI design generation tools (v0, Galileo, Framer AI, etc.)*

---

## 1. Product Summary

A single-user AI chat web application with persistent memory. The user chats with an AI assistant that remembers everything across all past conversations. The app has two main screens: a landing page (chat list) and a chat view with a memory/context sidebar.

---

## 2. Visual Direction

### Feel
- **Light, airy, ultra-minimal** — like a premium notes app or a luxury editorial website
- Not clinical, not corporate — warm, calm, focused
- Think: Arc Browser meets Notion meets a high-end editorial magazine
- The interface disappears — only the conversation matters
- Fancy but restrained: every element earns its place

### References
- Arc Browser (light, soft, refined)
- Notion (whitespace, quiet typography)
- iA Writer (focus on the text, nothing else)
- Linear (clean interactions, subtle animations)

### Color Palette
- **Background**: Very light warm off-white, not pure white — `#f9f9f7` or `#fafaf8`
- **Surface**: Slightly lighter for elevated cards — `#ffffff`
- **Border**: Barely visible, whisper-thin — `#e8e8e4` — used sparingly
- **Primary accent**: One single muted accent — soft warm black or a refined dark tone for key interactive elements — `#1a1a1a`
- **Text primary**: Near-black — `#1a1a1a`
- **Text secondary**: Soft mid-gray — `#9a9a94`
- **User message**: Clean white card with a very subtle shadow, black text
- **Claude message**: No bubble — plain text, left-aligned directly on the background
- No color for decorative purposes — color only for function

### Typography
- **Font**: Inter, Geist, or a refined serif like Lora for headings — light weights preferred
- **Chat text**: 16px, light or regular weight, generous line height (1.7)
- **Timestamps**: 11px, muted gray, no caps
- **Headings on landing**: Large, thin weight (300), generous tracking
- **Everything feels like it breathes**

### Shape & Spacing
- Extreme whitespace — the page should feel almost empty
- No borders unless absolutely necessary
- No shadows except the most subtle (`box-shadow: 0 1px 4px rgba(0,0,0,0.04)`)
- Input field: no visible border, no background — just a blinking cursor on the page
- Rounded corners only where natural: `8px` max, never pill-shaped buttons

---

## 3. Landing Page

### Layout
Full-screen, vertically centered. Light off-white background. Nothing decorative.

**Top — Header**
- A small logo or wordmark, top-left or centered — very light, refined
- Optional: a very faint large background image or watermark — abstract, almost invisible, adds texture without noise

**Center — Hero**
- One warm, human greeting headline: *"Hey, what do you want to chat about today?"*
- Thin font weight, large size (48–64px), no bold
- Below it: the input field — **auto-focused on page load**
  - No visible border, no box, no background
  - Just a blinking cursor and placeholder text: *"Type something..."*
  - The user can start typing immediately without clicking anything
- Send button to the right of the input — minimal, text or small arrow icon, not prominent

**Below — Recent Chats**
- Heading: *"Recent"* — small, muted, light caps, left-aligned
- List of past chats, sorted chronologically with most recent at top
- Each item:
  - Chat title — regular weight, dark
  - Last message preview — 1 line, truncated, muted gray
  - Timestamp — right-aligned, small, muted (e.g. *"Today · 10:32"* or *"Mar 15"*)
  - No border, no card background — just clean rows with generous padding
  - Subtle hover: a barely-there background tint `#f3f3f0`
- Clicking any item navigates to that chat

### Mood
Feels like opening a beautiful empty notebook. The page invites you to type, not to click around. The past chats are present but quiet — they don't compete with the input.

---

## 4. Chat View

### Overall Layout
Two panels — chat on the left (70%), context sidebar on the right (30%). No visible divider between them, just whitespace.

```
┌─────────────────────────────────┬──────────────────────┐
│         CHAT PANEL (70%)        │   SIDEBAR (30%)      │
│         off-white bg            │   same bg, quieter   │
└─────────────────────────────────┴──────────────────────┘
```

### Chat Panel

**Top-left — Menu Button**
- A single small icon button (hamburger or grid) in the top-left corner
- Opens navigation: back to landing page, recent chats list
- No header bar, no title bar — just this one small button floating in the corner
- It fades slightly when not hovered — very unobtrusive

**Message Thread**
- Scrollable, newest messages at the bottom
- Scroll up to see older messages — infinite history, no pagination
- Extreme whitespace between messages
- Date separators: minimal centered text, muted, e.g. *Mar 15* — no lines, just the text
- **User messages**: a clean white card, very subtle shadow, right-aligned, appears with a fast upward animation from the bottom (spring or ease-out, ~200ms)
- **Claude messages**: no bubble, no card — plain prose text, left-aligned directly on the background, slightly indented. Streams in character by character with a soft blinking cursor
- Timestamps: appear on hover only, small, muted — not always visible to avoid clutter
- **File attachments**: inline pill `design-spec.pdf ↓` — minimal, no icon clutter, click to download

**Message Appear Animation (user messages)**
- When user sends a message, it enters from the bottom
- Fast spring animation: slides up ~20px and fades in simultaneously
- Duration: ~180ms — feels snappy, not floaty
- Claude's response begins streaming immediately after

**Input Area — Bottom**
- Fixed to the bottom of the chat panel
- No border, no background change — seamlessly part of the page
- Input field: borderless, no background — a blinking cursor tells the user it's active
- Auto-focused when chat opens
- Placeholder: *"Ask anything..."* in muted gray
- **+ button** on the left — opens file picker (small, quiet, `+` character or paperclip)
- **Send button** on the right — minimal arrow `→` or the word *"Send"* in small muted text, activates on Enter or click
- When a file is attached before sending: a small pill appears above the input showing the filename with an `×` to remove it

### Sidebar Panel

**Always visible** — no toggle, no collapse.

Same background as the rest of the page. No visible border separating it from the chat. The visual separation comes only from content alignment.

**State 1 — Memory Overview (default)**

No header label needed — the content speaks for itself.

- **What I know** — small muted label, then 3–5 entity tags as minimal text pills
  e.g. `TypeScript` · `Payment API` · `JWT`
  Pills: no fill, just a thin border `#e8e8e4`, small font, rounded

- **Files** — small muted label, then a list of uploaded files
  Filename + date, download on click, no icons

- **Sessions** — one line of muted stats
  *12 conversations · Since Mar 10*

**State 2 — Context View (Claude message clicked)**

Triggered by clicking any Claude message.

- Small muted label: *"Based on"*
- Sources listed cleanly, no heavy visual decoration:
  - *From your memory* — 2–3 facts as plain readable sentences
  - *From design-spec.pdf* — 1-line excerpt
  - *From Mar 10 conversation* — short quote
- A thin left accent line per source (very subtle color: muted violet, amber, blue)
- Click anywhere else → fades back to memory overview

Transition: a gentle crossfade, 150ms.

---

## 5. Micro-interactions & Details

- **Streaming cursor**: a soft blinking `|` at the end of Claude's response while it streams
- **Memory updated**: after Claude responds, a tiny floating text fades in at the bottom of the sidebar — *"Memory updated"* — disappears after 2 seconds, no animation excess
- **File pill before send**: attached file shows as `design-spec.pdf ×` above the input, disappears when message is sent
- **Empty new chat**: no text, no placeholder instructions — just the input field, cursor blinking, waiting. The silence is intentional.
- **Menu button**: fades to near-invisible when idle, comes to full opacity on hover

---

## 6. Empty States

- **No past chats yet**: Landing page shows only the headline + input. No recent section. Clean and inviting.
- **New chat**: Completely empty except for the menu button and input. The cursor blinks. Nothing else.
- **Sidebar with no memory**: No label, no placeholder — just empty space. Memory populates over time.

---

## 7. What to Avoid

- No dark mode
- No heavy color usage — near-monochrome throughout
- No card grids, no dashboard feel
- No avatars, profile pictures, or icons beyond the minimal functional ones
- No notification badges, status dots, or colored alerts
- No heavy animations — everything is fast and subtle (150–200ms max)
- No visible borders unless absolutely required for clarity
- No emojis in the UI chrome
- No sidebars that collapse or toggle
- No bottom navigation bars
- No modals or overlays if avoidable

---

## 8. Screen Sizes

- Design for **desktop only** (v1) — minimum width 1280px
- Two-panel layout (chat + sidebar) requires sufficient horizontal space
- No mobile breakpoints needed for v1
