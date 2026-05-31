---
name: block-dangerous-commands
enabled: true
event: bash
pattern: git\s+(push\s+.*--force|push\s+-f\b|reset\s+--hard)|rm\s+-rf|rmdir\s+/s|del\s+/[fsq]|format\s+[a-z]:
action: block
---

🚨 **פקודה מסוכנת חסומה**

הפקודה הבאה חסומה כי היא עלולה לגרום נזק בלתי הפיך:

- `git push --force` / `git push -f` — דורס היסטוריה ב-remote
- `git reset --hard` — מוחק שינויים מקומיים לצמיתות
- `rm -rf` — מחיקה רקורסיבית של קבצים
- `rmdir /s` — מחיקת תיקייה כולל תת-תיקיות (Windows)
- `del /f /s /q` — מחיקה גורפת ב-Windows

**מה מותר:**
- `git push origin master` ✅
- `git push origin <branch>` ✅
- `vercel --prod` ✅
- `git reset HEAD~1` (ללא --hard) ✅

אם הפקודה לגיטימית — בצע אותה ידנית מהטרמינל.
