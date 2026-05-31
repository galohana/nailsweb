# Skill: RTL Hebrew

## Document root

```html
<html dir="rtl" lang="he">
```

Already set in `index.html`. Never override with `dir="ltr"` on a container — use `dir="auto"` for mixed content instead.

## Logical properties — no exceptions

Physical properties break RTL. Always use logical equivalents:

```css
/* ❌ WRONG */
margin-left: 8px;
padding-right: 16px;
text-align: left;
border-left: 2px solid;
left: 0;

/* ✅ CORRECT */
margin-inline-start: 8px;
padding-inline-end: 16px;
text-align: start;
border-inline-start: 2px solid;
inset-inline-start: 0;
```

In Tailwind (CDN with RTL variant enabled):
- `ms-2` = `margin-inline-start: 0.5rem`
- `me-4` = `margin-inline-end: 1rem`
- `ps-3` = `padding-inline-start: 0.75rem`
- `pe-6` = `padding-inline-end: 1.5rem`
- `start-0` = `inset-inline-start: 0`
- `end-0` = `inset-inline-end: 0`
- `text-start` = `text-align: start`
- `text-end` = `text-align: end`

## Arrows and chevrons

In RTL, forward-pointing arrows flip:

```jsx
// ← in LTR becomes → in RTL (the "next" direction flips)
<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>→</span>

// Tailwind
<ChevronRight className="rtl:-scale-x-100" />
```

Do NOT flip:
- Logos and brand icons
- Photographs and illustrations
- Phone numbers (`dir="ltr"` on the number span)
- Dates and times
- URLs and email addresses
- Mathematical/currency expressions

## Font

Heebo is optimized for Hebrew. Use it everywhere:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

```css
body { font-family: 'Heebo', sans-serif; }
```

## Hebrew text sizing

Hebrew glyphs are visually smaller than Latin at the same `font-size`.  
Increase Hebrew body text by **10–15%** vs. equivalent English:

- English body: 14px → Hebrew body: 15–16px
- English button: 15px → Hebrew button: 16px

## Mixed-direction content

Use `bdi` (bidirectional isolate) around dynamic text that might be LTR:

```html
<!-- phone numbers, usernames, IDs -->
<bdi dir="ltr">+972501234567</bdi>

<!-- unknown direction (user input) -->
<span dir="auto">{userInputText}</span>
```

## Flex row direction

Flexbox respects `dir` automatically — `flex-row` in RTL flows right-to-left.  
Never override with `flex-row-reverse` to compensate — use logical properties instead.

## Testing RTL

Verify layout with browser DevTools: Elements → toggle `dir` attribute between `rtl`/`ltr`.  
Watch for: overflow leaks, icon flips, scroll position, animation start direction.
