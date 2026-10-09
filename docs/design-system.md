# Loane design system

One rule, enforced by the linter:

> **No raw colours or font sizes anywhere except `shared/src/tokens.ts`.**

Everything below explains how to work within that.

## Why two layers

A colour has two different names: what it **is**, and what it's **for**.

```
palette.ink900  = '#111111'        ← what it IS
  ↓
color.text.primary = palette.ink900   ← what it's FOR
```

Screens only ever touch the second layer:

```ts
// Yes
<Text style={{ color: color.text.primary }}>

// No — reaches past the semantic layer
<Text style={{ color: palette.ink900 }}>

// No — the linter will reject this
<Text style={{ color: '#111111' }}>
```

**Why bother.** "Make the borders a little softer" becomes one edit in
`tokens.ts` instead of forty across the app. A rebrand changes `palette`
alone and every screen follows. And when a screen says
`color.border.default`, the next person knows what it's doing — `#E5E5E5`
tells them nothing.

**If you find yourself wanting `palette.x` inside a screen, the token you
need is missing.** Add it to `color` rather than reaching past it.

## The tokens

All in [`shared/src/tokens.ts`](../shared/src/tokens.ts).

| Group | Examples | For |
|---|---|---|
| `color.text` | `primary` `secondary` `muted` `inverse` `disabled` `error` | Type |
| `color.surface` | `page` `raised` `muted` `inverse` `disabled` | Backgrounds |
| `color.border` | `default` `strong` `focus` `inverse` `error` | Hairlines |
| `color.icon` | `default` `muted` `inverse` | Glyphs |
| `color.button` | `primary.background` `outline.border` `disabled.label` | Buttons |
| `color.status` | `success` `warning` `error` | State |
| `color.brand` | `cream` `merlot` `cherry` `butter` `ballet` `denim` | Brand palette |
| `color.accent` | `background` `border` `label` | Butter highlight: price tags, selected chips |
| `color.attention` | `background` `border` `label` | Cherry: unread badges, "Your turn" |
| `type` | `h1` `h2` `h3` `body` `bodySmall` `label` `caption` `button` | Text roles |
| `spacing` | `xs` … `xxxl`, `screenPadding` | Gaps and padding |
| `radius` | `none` `sm` `md` `lg` `pill` | Corners |
| `iconSize` | `sm` (18) `md` (26) `lg` (28) | Icons |
| `controls` | `minTapTarget` `buttonHeight` `inputHeight` `chipHeight` … | Control sizing |

### The type scale

| Role | Size | Used for |
|---|---|---|
| `h1` | 32 | Screen titles on onboarding |
| `h2` | 26 | Page headings |
| `h3` | 20 | Section headings, names |
| `body` | 17 | Default copy |
| `bodySmall` | 15 | Secondary copy, list rows |
| `label` | 12 | Small uppercase letter-spaced labels |
| `caption` | 11 | **The floor.** Tab labels, stat captions |

Nothing is smaller than `caption`. If something needs to be smaller, it
needs to be shorter instead.

### Tap targets

`controls.minTapTarget` is 44pt — Apple's recommended minimum. **Every
button and icon must meet it.** Where the glyph is smaller, reserve the
target around it; `IconButton` does this for you.

## The components

In `mobile/src/components/`. Prefer these over raw React Native views —
each one already speaks tokens.

| Component | What it is |
|---|---|
| `Text` | All text. Pick a `variant` (`body`, `label`, `h2`…) and a `tone`. |
| `Button` | `primary`, `outline`, `text`. Handles loading and disabled. |
| `Input` | The underlined field from the mockups, with label, hint and error. |
| `Chip` | Small single-line rounded filter pill, fixed height. |
| `Card` | Hairline-bordered block, optionally tappable. |
| `Avatar` | Round photo with an initial fallback. |
| `Header` | Centred uppercase screen title with a back chevron. |
| `IconButton` | A glyph inside a guaranteed 44pt target. |
| `PhotoGrid` | Photo picker. First photo is the cover; tap for options. |
| `EmptyState` | Title, body, optional action. |
| `Screen` | Page shell: safe area, background, side padding. |

### `<Text>` rather than React Native's

```tsx
<Text variant="label" tone="muted">Browse & borrow</Text>
```

`label` and `caption` uppercase themselves. This is the main reason a screen
can't accidentally invent a font size.

### Horizontal chip rows — one gotcha

A horizontal `ScrollView` inside a flex column **stretches its children to
full height** unless you stop it. Chips turn into tall pills. Always:

```tsx
<ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} …>
```

`Chip` also pins its own height, so you'd have to work at it to break this
now — but the ScrollView style is still required.

## The lint rule

In `.eslintrc.json`, as two `no-restricted-syntax` selectors:

- any string literal that looks like a hex colour
- any numeric literal assigned to `fontSize`

```bash
npm run lint
```

**Exemptions, and why each exists:**

| Path | Why |
|---|---|
| `shared/src/tokens.ts` | The one place raw values belong |
| `backend/functions/scripts/**` | Seed data carries real colours as *data* — a campus's brand colour is not styling |
| `admin/**` | **Temporary.** Being rebuilt in a separate worktree. Delete this exemption when that branch merges. |

## Deprecated names

`shared/src/brand.ts` still exports `colors`, `typography`, `radii`,
`borders` and `icons` as aliases. They exist **only** so `admin/` keeps
compiling while it is rebuilt elsewhere. Values are identical; names are
older.

**Do not use them in new code.** The file is deleted when admin merges.

## Fonts

The brand faces are Tenorite Bold (headings) and Telegraf (body). Tenorite
is a Microsoft font not licensed for app embedding; Telegraf is a paid
licence. We ship free stand-ins behind the token names `LoaneHeading` and
`LoaneBody`, so swapping in the licensed files later touches one file.

## Colour

The canvas is **Cream `#F6EFE4`**, not white. Cards and sheets are white so
they lift off it.

**Merlot `#5E1A2E`** is the voice — headings, icons, the mark, 11.0:1 on
cream. **Cherry `#C8213F`** is the wink — primary buttons, the + that
creates something, unread badges, "Your turn" pills, 4.9:1 on cream and
5.6:1 under white text.

**Butter, Ballet and Denim are backgrounds only.** On cream they measure
1.19:1, 1.59:1 and 2.69:1 — invisible as text or a glyph, fine behind
near-black. There is deliberately no `color.text.accent` token, and adding
one would be a bug.

Cherry and Butter are not interchangeable. Cherry interrupts; Butter marks.
If a price tag shouts as loudly as "Request to rent", neither is the primary
action any more.

Body text is `#231619`, a warm near-black leaning toward merlot. The whole
neutral ramp is warmed to match, because a true grey beside cream reads as
dirty.

Midnight `#1A2D4D` appears in the deck marked campaign only and is
deliberately not in the app.

Nothing here is provisional. The October 2026 deck superseded the September
one and settled the three colours that had been marked `TODO-CONFIRM`.
