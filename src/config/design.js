/* ═══════════════════════════════════════════════════════════
   DESIGN — הגדרת עיצוב פר-לקוחה.
   זה הקובץ היחיד שמעדכנים כשמשכפלים template ללקוחה חדשה.

   הערכים נכנסים ל-CSS variables בזמן ריצה דרך applyDesign.js.
   ═══════════════════════════════════════════════════════════ */

export const design = {
  colors: {
    primary: '#8e0000',   // כפתורים ראשיים, אקסנטים
    section: '#ffe9e0',   // רקע סקשנים כהים (Hero arch, גלריה)
    bg:      '#ffe5dd',   // רקע הדף הראשי
    menu:    '#8e0000',   // צבע menu — כשmenuColorExtend=true מוחל על קלפים/CTAs/sheets/map
  },

  materials: {
    primary: 'stripes',   // flat | matte | glass | metallic | wood | stripes | marble
    section: 'flat',
    bg:      'flat',
    menu:    'matte',     // חומר ה-menu — מוחל יחד עם הצבע כשmenuColorExtend=true
  },

  headingFont: 'Comfortaa',  // Cormorant Garamond | Playfair Display | Pacifico | Comfortaa | Parisienne
  corners:     'normal',      // sharp | normal | rounded
  shadow:      'soft',        // none | soft | deep | glow
  navbarBg:    'primary',     // transparent | primary | section | bg

  /* כשtrue → קלפים/CTAs/sheets/מסגרת מפת waze מקבלים את צבע + חומר ה-menu
     כשfalse (ברירת מחדל) → הם לבנים (#FDFAF7) בלי חומר.
     משפיע על: Hero CTAs, Stats badges, About card, Reviews carousel,
     Filmstrip, Booking sheets (time picker + payment), Map card (Contact). */
  menuColorExtend: false,
};
