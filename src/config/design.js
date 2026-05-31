/* ═══════════════════════════════════════════════════════════
   DESIGN — הגדרת עיצוב פר-לקוחה.
   זה הקובץ היחיד שמעדכנים כשמשכפלים template ללקוחה חדשה.

   הערכים נכנסים ל-CSS variables בזמן ריצה דרך applyDesign.js.
   ═══════════════════════════════════════════════════════════ */

export const design = {
  colors: {
    primary: '#5C3D2E',   // כפתורים ראשיים, אקסנטים
    section: '#7D5A47',   // רקע סקשנים כהים (Hero arch, גלריה)
    bg:      '#F2E8DC',   // רקע הדף הראשי
    menu:    '#7D5A47',   // צבע menu — כשmenuColorExtend=true מוחל על קלפים/CTAs/sheets/map
  },

  materials: {
    primary: 'flat',      // flat | matte | glass | metallic | wood | stripes | marble
    section: 'flat',
    bg:      'flat',
    menu:    'flat',      // חומר ה-menu — מוחל יחד עם הצבע כשmenuColorExtend=true
  },

  headingFont: 'Cormorant Garamond',  // Cormorant Garamond | Playfair Display | Pacifico | Comfortaa | Parisienne
  corners:     'normal',               // sharp | normal | rounded
  shadow:      'soft',                 // none | soft | deep | glow
  navbarBg:    'transparent',          // transparent | primary | section | bg

  /* כשtrue → קלפים/CTAs/sheets/מסגרת מפת waze מקבלים את צבע + חומר ה-menu
     כשfalse (ברירת מחדל) → הם לבנים (#FDFAF7) בלי חומר.
     משפיע על: Hero CTAs, Stats badges, About card, Reviews carousel,
     Filmstrip, Booking sheets (time picker + payment), Map card (Contact). */
  menuColorExtend: false,
};
