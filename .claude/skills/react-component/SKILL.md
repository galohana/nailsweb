# Skill: React Component Rules

## Stack
React 19 + Vite + Tailwind (CDN) + inline styles — no CSS modules.

## Font
Always Heebo from Google Fonts. Already loaded in `index.html`.

```jsx
// body-level (already set globally)
fontFamily: "'Heebo', sans-serif"
```

## RTL — ALWAYS

Every component renders in RTL. Never assume LTR.

### Logical properties only — ZERO physical directional props

| ❌ NEVER use | ✅ Always use instead |
|---|---|
| `marginLeft` | `marginInlineStart` |
| `marginRight` | `marginInlineEnd` |
| `paddingLeft` | `paddingInlineStart` |
| `paddingRight` | `paddingInlineEnd` |
| `left: 0` | `insetInlineStart: 0` |
| `right: 0` | `insetInlineEnd: 0` |
| `textAlign: 'left'` | `textAlign: 'start'` |
| `textAlign: 'right'` | `textAlign: 'end'` |
| `borderLeft` | `borderInlineStart` |
| `borderRight` | `borderInlineEnd` |
| `ml-` / `mr-` (Tailwind) | `ms-` / `me-` |
| `pl-` / `pr-` (Tailwind) | `ps-` / `pe-` |

## Touch targets

Every interactive element: minimum **48×48px** tap area.  
Use `padding` to expand small icons rather than increasing the icon itself.

## Primary buttons

Fixed at the **bottom of the screen** on mobile (position: fixed, bottom: 0, full width).  
Secondary actions: inline, `height: 44px` minimum.

## Feminine Hebrew language

All user-facing text uses feminine form (לשון נקבה):
- "ברוכה הבאה" not "ברוך הבא"
- "קבעי תור" not "קבע תור"
- "בחרי" not "בחר"
- "מלאי" not "מלא"
- "אישרי" not "אשר"

## Color palette (gavot-app)

```js
const C = {
  bg:      '#FFF0F3',
  surface: '#FFFFFF',
  accent:  '#C2587A',
  brown:   '#8B5E52',
  text:    '#2D1B1E',
  muted:   '#9E7E82',
  border:  '#F2D5DC',
};
```

## Component skeleton

```jsx
export default function MyComponent({ user, onNavigate }) {
  const C = { bg: '#FFF0F3', accent: '#C2587A', text: '#2D1B1E', muted: '#9E7E82', border: '#F2D5DC' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, fontFamily: "'Heebo', sans-serif" }}>
      {/* content */}
    </div>
  );
}
```
