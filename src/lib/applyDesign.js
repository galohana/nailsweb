/* ═══════════════════════════════════════════════════════════
   applyDesign — מזריק את האובייקט design ל-:root כ-CSS vars.
   מופעל פעם אחת ב-main.jsx לפני שה-App נטען.

   סנכרון מלא עם bolt-builder/src/preview/designVars.js:
   - כל החומרים: flat, matte, glass, metallic, wood, stripes, marble
   - כל הגדלים: surface, overlay, overlay_sm (tabs/buttons), backdrop, border
   - כל הצבעים: primary, section, bg, menu
   ═══════════════════════════════════════════════════════════ */

const RADIUS_MAP = {
  sharp:   { card: '2px',  pill: '4px'   },
  normal:  { card: '12px', pill: '999px' },
  rounded: { card: '24px', pill: '999px' },
};

const HEBREW_FONT_MAP = {
  'Cormorant Garamond': 'Bellefair',
  'Playfair Display':   'Frank Ruhl Libre',
  'Pacifico':           'Amatic SC',
  'Comfortaa':          'Varela Round',
  'Secular One':        'Secular One',
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadowFor(level, primary) {
  const [r, g, b] = hexToRgb(primary);
  switch (level) {
    case 'none': return 'none';
    case 'soft': return '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)';
    case 'deep': return '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)';
    case 'glow': return `0 0 0 1px rgba(${r},${g},${b},0.16), 0 0 20px rgba(${r},${g},${b},0.22), 0 2px 8px rgba(0,0,0,0.06)`;
    default:     return '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)';
  }
}

/**
 * materialFor — single source of truth for all CSS material patterns.
 * Synced with bolt-builder/src/preview/designVars.js → materialFor().
 *
 * Returns:
 *   surface      — background-image for large areas (bg color via backgroundColor)
 *   overlay      — large overlay for mix-blend-mode: overlay (320px+ period)
 *   overlay_sm   — short period for small elements: tabs, buttons, navbar (~80px period)
 *   surfaceOnLight — dark-band variant (metallic only) for light/white backgrounds
 *   backdrop     — backdrop-filter value (glass blur)
 *   border       — border shorthand matching the material
 */
function materialFor(material, bg) {
  switch (material) {

    case 'matte': {
      const matteUrl = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`;
      return {
        surface:     matteUrl,
        overlay:     matteUrl,
        overlay_sm:  matteUrl,
        overlay_nav: matteUrl,
        backdrop:   'none',
        border:     '1px solid rgba(0,0,0,0.07)',
      };
    }

    case 'glass': {
      const [r, g, b] = hexToRgb(bg);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const dark = lum < 0.35;
      return {
        surface:     dark ? `rgba(${r},${g},${b},0.35)` : 'rgba(255,255,255,0.58)',
        overlay:     dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.28)',
        overlay_sm:  dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.32)',
        overlay_nav: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.28)',
        backdrop:   'blur(24px) saturate(200%)',
        border:     dark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.70)',
      };
    }

    case 'metallic':
      return {
        /* large area (section column, hero) — 320px period, stripe at 175-216px */
        surface:    `repeating-linear-gradient(110deg, transparent 0px, transparent 175px, rgba(255,255,255,0.08) 187px, rgba(255,255,255,0.48) 192px, rgba(255,255,255,0.48) 199px, rgba(255,255,255,0.08) 204px, transparent 216px, transparent 320px)`,
        overlay:    'repeating-linear-gradient(110deg, transparent 0px, transparent 175px, rgba(255,255,255,0.08) 187px, rgba(255,255,255,0.48) 192px, rgba(255,255,255,0.48) 199px, rgba(255,255,255,0.08) 204px, transparent 216px, transparent 320px)',
        /* small elements (nav, admin tabs ~50-110px) — 80px period, stripe at 20-50px */
        overlay_sm: 'repeating-linear-gradient(110deg, transparent 0px, transparent 20px, rgba(255,255,255,0.08) 28px, rgba(255,255,255,0.52) 33px, rgba(255,255,255,0.52) 37px, rgba(255,255,255,0.08) 42px, transparent 50px, transparent 80px)',
        /* navbar — 150px period → 2-3 stripes on full-width mobile navbar */
        overlay_nav: 'repeating-linear-gradient(110deg, transparent 0px, transparent 55px, rgba(255,255,255,0.14) 65px, rgba(255,255,255,0.65) 70px, rgba(255,255,255,0.65) 77px, rgba(255,255,255,0.14) 82px, transparent 95px, transparent 150px)',
        /* dark-band variant for metallic applied on white/light backgrounds */
        surfaceOnLight: `repeating-linear-gradient(110deg, transparent 0px, transparent 175px, rgba(0,0,0,0.02) 187px, rgba(0,0,0,0.10) 192px, rgba(0,0,0,0.10) 199px, rgba(0,0,0,0.02) 204px, transparent 216px, transparent 320px)`,
        backdrop:   'none',
        border:     '1px solid rgba(180,150,90,0.50)',
      };

    case 'wood': {
      const woodUrl = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'><defs><filter id='grain'><feTurbulence type='turbulence' baseFrequency='0.004 0.65' numOctaves='5' seed='7'/><feColorMatrix values='0 0 0 0 0.26  0 0 0 0 0.11  0 0 0 0 0.02  0 0 0 0.38 0'/></filter><filter id='rings'><feTurbulence type='turbulence' baseFrequency='0.022 0.006' numOctaves='3' seed='12'/><feColorMatrix values='0 0 0 0 0.18  0 0 0 0 0.07  0 0 0 0 0.01  0 0 0 0.18 0'/></filter></defs><rect width='320' height='200' filter='url(%23rings)'/><rect width='320' height='200' filter='url(%23grain)' opacity='0.55'/></svg>")`;
      return {
        surface:     woodUrl,
        overlay:     woodUrl,
        overlay_sm:  woodUrl,
        overlay_nav: woodUrl,
        backdrop:   'none',
        border:     '1px solid rgba(80,46,12,0.28)',
      };
    }

    case 'stripes':
      return {
        /* surface: dark lines for light backgrounds */
        surface:     `repeating-linear-gradient(to right, transparent 0px, transparent 9px, rgba(0,0,0,0.07) 9px, rgba(0,0,0,0.07) 10px)`,
        /* overlay: white lines for dark backgrounds (mix-blend-mode: overlay) */
        overlay:     'repeating-linear-gradient(to right, transparent 0px, transparent 9px, rgba(255,255,255,0.18) 9px, rgba(255,255,255,0.18) 10px)',
        overlay_sm:  'repeating-linear-gradient(to right, transparent 0px, transparent 9px, rgba(255,255,255,0.18) 9px, rgba(255,255,255,0.18) 10px)',
        overlay_nav: 'repeating-linear-gradient(to right, transparent 0px, transparent 9px, rgba(255,255,255,0.18) 9px, rgba(255,255,255,0.18) 10px)',
        backdrop:   'none',
        border:     '1px solid rgba(0,0,0,0.09)',
      };

    case 'marble': {
      const marbleGrad = 'repeating-linear-gradient(42deg, transparent 0px, transparent 54px, rgba(120,90,60,0.09) 58px, transparent 62px, transparent 116px), repeating-linear-gradient(-18deg, transparent 0px, transparent 74px, rgba(80,60,40,0.06) 78px, transparent 82px, transparent 152px)';
      return {
        surface:     marbleGrad,
        overlay:     marbleGrad,
        overlay_sm:  marbleGrad,
        overlay_nav: marbleGrad,
        backdrop:   'none',
        border:     '1px solid rgba(120,95,60,0.28)',
      };
    }

    case 'flat':
    default:
      return {
        surface:     'none',
        overlay:     'none',
        overlay_sm:  'none',
        overlay_nav: 'none',
        backdrop:   'none',
        border:     '1px solid rgba(0,0,0,0.06)',
      };
  }
}

function readableOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '#1A1410' : '#FDFAF7';
}

function fontStack(headingFont) {
  const hebrewPartner = HEBREW_FONT_MAP[headingFont] || 'Heebo';
  return `"${headingFont}", "${hebrewPartner}", "Heebo", sans-serif`;
}

export function applyDesign(design) {
  if (!design || typeof document === 'undefined') return;

  const { colors, materials, headingFont, corners, shadow } = design;
  const radius = RADIUS_MAP[corners] || RADIUS_MAP.normal;

  /* menu color — explicit or fallback to section */
  const menuColor = colors.menu || colors.section;

  const matPrimary = materialFor(materials?.primary || 'flat', colors.primary);
  const matSection = materialFor(materials?.section || 'flat', colors.section);
  const matBg      = materialFor(materials?.bg      || 'flat', colors.bg);
  const matMenu    = materialFor(materials?.menu    || materials?.section || 'flat', menuColor);

  const [pr, pg, pb] = hexToRgb(colors.primary);
  const [sr, sg, sb] = hexToRgb(colors.section);
  const [br, bg2, bb] = hexToRgb(colors.bg);
  const [mr, mg, mb] = hexToRgb(menuColor);

  /* ═══════════════════════════════════════════════════════════
     menuColorExtend feature — שולט אם cards/CTAs/sheets/map-frame
     מקבלים את צבע + חומר ה-menu (true) או נשארים לבנים (false).
     ─────────────────────────────────────────────────────────────
     כש-ON  → cardTint = menu color, החומר = menu material overlay
     כש-OFF → cardTint = #FDFAF7 (surface), אין חומר
     הבסיס הזה מזין את המחלקה .demo-tinted ב-design-tokens.css
     ═══════════════════════════════════════════════════════════ */
  const extendOn = design.menuColorExtend === true;
  const cardTint = extendOn ? menuColor : '#FDFAF7';
  const [ctr, ctg, ctb] = hexToRgb(cardTint);
  const onCardTint = readableOn(cardTint);
  const tintMatOverlay = extendOn
    ? (matMenu.overlay_sm || matMenu.overlay || 'none')
    : 'none';
  /* screen blend מבהיר טקסטורה על רקע כהה (menu); overlay על רקע בהיר (surface) */
  const tintBlend   = extendOn ? 'screen' : 'overlay';
  const tintOpacity = extendOn ? '0.55'   : '1';

  /* Navbar */
  const navbarBg = design.navbarBg || 'transparent';
  const navbarBgColor = navbarBg === 'transparent'
    ? `rgba(${br},${bg2},${bb},0.30)`
    : navbarBg === 'section' ? colors.section
    : navbarBg === 'bg'      ? colors.bg
    : colors.primary;
  const navbarBlur = navbarBg === 'transparent' ? 'blur(16px)' : 'none';
  const navbarText = readableOn(navbarBg === 'transparent' ? colors.bg : navbarBgColor);

  /* Navbar material — pick the right material based on which color the navbar uses */
  const navbarMatKey = navbarBg === 'section' ? (materials?.section || 'flat')
    : navbarBg === 'bg'    ? (materials?.bg      || 'flat')
    : navbarBg === 'transparent' ? 'flat'
    : (materials?.primary  || 'flat');
  const navbarMatColor = navbarBg === 'section' ? colors.section
    : navbarBg === 'bg'    ? colors.bg
    : colors.primary;
  const matNavbar = materialFor(navbarMatKey, navbarMatColor);

  const vars = {

    /* ── Core colors ──────────────────────────────────────────────── */
    '--color-primary':    colors.primary,
    '--color-section':    colors.section,
    '--color-section-bg': colors.section,   /* backward compat */
    '--color-bg':         colors.bg,
    '--color-menu':       menuColor,

    /* ── RGB tuples ───────────────────────────────────────────────── */
    '--color-primary-rgb': `${pr}, ${pg}, ${pb}`,
    '--color-section-rgb': `${sr}, ${sg}, ${sb}`,
    '--color-bg-rgb':      `${br}, ${bg2}, ${bb}`,
    '--color-menu-rgb':    `${mr}, ${mg}, ${mb}`,

    /* ── Typography ───────────────────────────────────────────────── */
    '--demo-heading-font': fontStack(headingFont || 'Cormorant Garamond'),
    '--demo-body-font':    '"Heebo", sans-serif',

    /* ── Corners ──────────────────────────────────────────────────── */
    '--demo-radius-card': radius.card,
    '--demo-radius-pill': radius.pill,

    /* ── Shadows ──────────────────────────────────────────────────── */
    '--demo-shadow-card': shadowFor(shadow || 'soft', colors.primary),
    '--demo-shadow-deep': shadowFor(shadow === 'none' ? 'none' : 'deep', colors.primary),

    /* ── Navbar ───────────────────────────────────────────────────── */
    '--demo-navbar-bg':          navbarBgColor,
    '--demo-navbar-blur':        navbarBlur,
    '--demo-navbar-text':        navbarText,
    '--demo-navbar-mat-overlay': matNavbar.overlay_nav || matNavbar.overlay,

    /* ── Primary material (ראשי: כפתורים, טאב פעיל) ──────────────── */
    '--demo-primary-mat-surface':  matPrimary.surface,
    '--demo-primary-mat-overlay':  matPrimary.overlay_sm || matPrimary.overlay,
    '--demo-primary-mat-border':   matPrimary.border,
    '--demo-primary-mat-backdrop': matPrimary.backdrop,

    /* ── Section material (רקע אזורים כהים: hero, gallery) ────────── */
    '--demo-section-mat-surface':    matSection.surface,
    '--demo-section-mat-overlay':    matSection.overlay,
    '--demo-section-mat-overlay-sm': matSection.overlay_sm || matSection.overlay,  /* small elements: FAB, chips */
    '--demo-section-mat-overlay-lg': matSection.overlay,    /* large area — no short-period */
    '--demo-section-mat-on-light':   matSection.surfaceOnLight || matSection.surface,
    '--demo-section-mat-border':     matSection.border,
    '--demo-section-mat-backdrop':   matSection.backdrop,

    /* ── Menu material (טאבים לא פעילים, headers, ניווט) ─────────── */
    '--demo-menu-mat-overlay':  matMenu.overlay_sm || matMenu.overlay,
    '--demo-menu-mat-border':   matMenu.border,
    '--demo-menu-mat-backdrop': matMenu.backdrop,

    /* ── Card-tint (פיצ'ר menuColorExtend) ────────────────────────
       מוזן ע"י .demo-tinted ב-design-tokens.css.
       האלמנטים שמשתמשים: Hero CTAs+Stats, About card, Reviews,
       Filmstrip, Booking sheets, Map card ב-Contact. */
    '--color-card-tint':       cardTint,
    '--color-card-tint-rgb':   `${ctr}, ${ctg}, ${ctb}`,
    '--color-on-card-tint':    onCardTint,
    '--color-tint-mat-overlay': tintMatOverlay,
    '--color-tint-blend':      tintBlend,
    '--color-tint-opacity':    tintOpacity,

    /* ── BG material (רקע הדף, כרטיסים) ──────────────────────────── */
    '--demo-bg-mat-surface':  matBg.surface,
    '--demo-bg-mat-overlay':  matBg.overlay,
    '--demo-bg-mat-border':   matBg.border,
    '--demo-bg-mat-backdrop': matBg.backdrop,

    /* ── Surface aliases — bolt-builder naming (כרטיסים, panels) ──── */
    '--demo-surface':          matBg.surface,
    '--demo-surface-overlay':  matBg.overlay,
    '--demo-surface-border':   matBg.border,
    '--demo-surface-backdrop': matBg.backdrop,

    /* ── Contrast-aware text colors per background ──────────────────
       readableOn() returns '#1A1410' (near-black) on light backgrounds
       and '#FDFAF7' (near-white) on dark backgrounds. */
    '--color-on-section':     readableOn(colors.section),
    '--color-on-primary':     readableOn(colors.primary),
    '--color-on-bg':          readableOn(colors.bg),
    '--color-on-section-rgb': (() => { const [r,g,b] = hexToRgb(readableOn(colors.section)); return `${r},${g},${b}`; })(),
  };

  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}
