/* ═══════════════════════════════════════════════════════════
   DESIGN — הגדרת עיצוב פר-לקוחה.
   זה הקובץ היחיד שמעדכנים כשמשכפלים template ללקוחה חדשה.

   הערכים נכנסים ל-CSS variables בזמן ריצה דרך applyDesign.js.
   ═══════════════════════════════════════════════════════════ */

export const design = {
  colors: {
    primary: '#ffeae8',   // כפתורים ראשיים, אקסנטים
    section: '#ffeae8',   // רקע סקשנים כהים (Hero arch, גלריה)
    bg:      '#ffc8c1',   // רקע הדף הראשי
    menu:    '#ffa198',   // צבע menu — כשmenuColorExtend=true מוחל על קלפים/CTAs/sheets/map
  },

  materials: {
    primary: 'stripes',    // flat | matte | glass | metallic | wood | stripes | marble
    section: 'glass',
    bg:      'metallic',
    menu:    'glass',      // חומר ה-menu — מוחל יחד עם הצבע כשmenuColorExtend=true
  },

  headingFont: 'Comfortaa',  // Cormorant Garamond | Playfair Display | Pacifico | Comfortaa | Parisienne
  corners:     'rounded',           // sharp | normal | rounded
  shadow:      'glow',              // none | soft | deep | glow
  navbarBg:    'transparent',       // transparent | primary | section | bg

  /* כשtrue → קלפים/CTAs/sheets/מסגרת מפת waze מקבלים את צבע + חומר ה-menu
     כשfalse (ברירת מחדל) → הם לבנים (#FDFAF7) בלי חומר.
     משפיע על: Hero CTAs, Stats badges, About card, Reviews carousel,
     Filmstrip, Booking sheets (time picker + payment), Map card (Contact). */
  menuColorExtend: true,
};
