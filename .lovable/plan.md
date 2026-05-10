## מטרה
לאפשר לכל משתמש במערכת להתחבר עם **חשבון Google משלו** ל-Google Sheets, כך שכל משתמש יוכל לסנכרן גיליונות שלו בלי תלות בחשבון יחיד ברמת הפרויקט.

## למה צריך שינוי
ה-Google Sheets connector הנוכחי של Lovable מחבר **חשבון אחד** ברמת הפרויקט (כיום: yigal). כל הקריאות ל-Sheets API משתמשות בחשבון הזה. כדי לתת לכל משתמש להתחבר עם החשבון שלו, חייבים להקים OAuth פר-משתמש עם credentials משלך מ-Google Cloud.

## מה תצטרך להכין מראש (בידיים)
1. ליצור OAuth Client ב-Google Cloud Console (Web application).
2. להפעיל את **Google Sheets API** ו-**Google Drive API** (Drive נדרש כדי להציג רשימת גיליונות).
3. להוסיף את כתובת ה-callback של ה-edge function שניצור: `https://llioeafzlhrjqwkjaepe.supabase.co/functions/v1/google-user-oauth-callback`
4. Scopes נדרשים: `openid email profile`, `https://www.googleapis.com/auth/spreadsheets.readonly`, `https://www.googleapis.com/auth/drive.readonly`
5. אחרי היצירה — לתת לי את ה-**Client ID** וה-**Client Secret**, ואני אבקש לאחסן אותם כ-secrets.

## מה אבנה

### Backend (Lovable Cloud)
- **טבלה חדשה** `user_google_connections`: מאחסנת לכל משתמש את ה-`access_token`, `refresh_token`, `expires_at`, `email` של החשבון, `scope`. עם RLS — כל משתמש רואה רק את החיבור שלו.
- **Edge function `google-user-oauth-start`**: יוצר state מאובטח ומחזיר URL להתחלת OAuth.
- **Edge function `google-user-oauth-callback`**: מחליף code → tokens, שומר בטבלה, סוגר חלון.
- **Edge function `google-user-token`**: מרענן access_token כשפג, ומחזיר אותו ל-functions אחרים. שימוש פנימי בלבד.
- **עדכון `google-sheet-metadata` ו-`sync-clients-from-sheet`**: במקום להשתמש ב-`GOOGLE_SHEETS_API_KEY` של ה-connector, ישתמשו ב-token האישי של המשתמש המבצע את הקריאה.

### Frontend
- ב-`/integrations`, בכרטיס Google Sheets:
  - אם המשתמש לא מחובר → כפתור **"חבר את חשבון Google שלי"** שפותח חלון OAuth.
  - אם מחובר → תצוגת המייל המחובר + כפתור **"התחבר עם חשבון אחר"** + כפתור **"נתק"**.
- שמירת תאימות: אם אין חיבור אישי, fallback אופציונלי ל-connector הקיים (או הודעה ברורה שצריך להתחבר).

## תרשים זרימה
```text
User → "חבר את החשבון שלי" → google-user-oauth-start
   → חלון Google → אישור → google-user-oauth-callback
   → שמירת tokens ב-user_google_connections (RLS)
   → טעינת גיליון: google-sheet-metadata קורא token של המשתמש (refresh אם צריך)
   → קריאה ל-Google Sheets API עם ה-token האישי
```

## אבטחה
- `client_secret` ו-`refresh_token` רק בשרת (edge functions + DB עם RLS).
- `state` חתום (HMAC עם secret) למניעת CSRF.
- RLS על `user_google_connections`: `user_id = auth.uid()`.
- Tokens לא חוזרים אף פעם ל-frontend.

## פתיחת ה-implementation
אחרי שתאשר את התוכנית, השלב הראשון יהיה לבקש ממך את ה-Client ID + Client Secret מ-Google Cloud. בלעדיהם אי אפשר להמשיך.