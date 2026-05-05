export type Platform = "google" | "meta" | "tiktok";
export type Mode = "audit" | "prelaunch";

export interface Check {
  id: string;
  platform: Platform;
  category: string;
  title: string;
  why: string;
  how: string;
  critical?: boolean;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  google: "Google Ads",
  meta: "Meta",
  tiktok: "TikTok",
};

export const MODE_LABEL: Record<Mode, string> = {
  audit: "Audit חשבון",
  prelaunch: "Pre-launch QA",
};

export const CHECKS: Record<Mode, Check[]> = {
  audit: [
    { id: "g_perf_roas", platform: "google", category: "ביצועים ותקציב", title: "ROAS / CPA לכל קמפיין מול היעד", why: "קמפיינים שלא עומדים ביעד צורכים תקציב ללא תרומה.", how: "30-90 יום, סנן Cost/Conv ו-Conv Value/Cost; סמן <70% מהיעד." },
    { id: "g_perf_wasted", platform: "google", category: "ביצועים ותקציב", title: "Search Terms — בזבוז על שאילתות לא רלוונטיות", critical: true, why: "מילות מפתח רחבות פולטות שאילתות זבל.", how: "Reports → Search terms → מיין לפי Cost; הוסף ל-Negative list." },
    { id: "g_perf_bid", platform: "google", category: "ביצועים ותקציב", title: "אסטרטגיית הצעות תואמת ליעד", why: "Maximize Clicks לא מתאים ל-ROAS.", how: "Conversions → tCPA/Max Conv. Revenue → tROAS." },
    { id: "g_perf_budget_cap", platform: "google", category: "ביצועים ותקציב", title: "Limited by budget", why: "קמפיינים מצליחים שמוגבלים בתקציב משאירים המרות.", how: "Status = Limited by budget. הגדל אם ROAS חזק." },
    { id: "g_perf_lost_is", platform: "google", category: "ביצועים ותקציב", title: "Search Lost IS (budget) ו-(rank)", why: "מזהה הפסד חשיפות.", how: "הוסף עמודות Lost IS. >20% = הזדמנות." },
    { id: "g_struct_naming", platform: "google", category: "מבנה חשבון", title: "קונבנציית שמות אחידה", why: "שמות מובנים מקלים על דיווח וסינון.", how: "דפוס: Brand_Type_Geo_Audience_Goal." },
    { id: "g_struct_groups", platform: "google", category: "מבנה חשבון", title: "Ad groups ממוקדות (≤15-20 keywords)", why: "משפר Quality Score ורלוונטיות.", how: "פצל קבוצות גדולות; כל מודעה ↔ נושא." },
    { id: "g_struct_geo", platform: "google", category: "מבנה חשבון", title: "פיצול גאוגרפי לפי ביצועים", why: "אזורים שונים = CPL שונה.", how: "Locations report; קמפיינים נפרדים או bid adj." },
    { id: "g_struct_schedule", platform: "google", category: "מבנה חשבון", title: "Ad schedule מותאם ביצועים", why: "שעות חלשות = בזבוז.", how: "Reports → Day & Hour; Schedule בקמפיין." },
    { id: "g_targ_negatives", platform: "google", category: "טירגוט וקהלים", title: "Negative Keywords ברמת חשבון/קמפיין", critical: true, why: "מונע הופעה על שאילתות זבל.", how: "Tools → Shared library → Negative list; עדכן חודשית." },
    { id: "g_targ_audience", platform: "google", category: "טירגוט וקהלים", title: "Audience signals / Observation מוגדרים", why: "מאיץ learning ב-PMax/Search.", how: "PMax: signals; Search: observation layer." },
    { id: "g_targ_location", platform: "google", category: "טירגוט וקהלים", title: "Location targeting = Presence (לא Interest)", critical: true, why: "Interest מציג למי שלא נמצא ביעד.", how: "Settings → Locations → Presence." },
    { id: "g_targ_devices", platform: "google", category: "טירגוט וקהלים", title: "Device bid adjustments לפי ביצועים", why: "ביצועים שונים מובייל/דסקטופ.", how: "Devices report; bid adj." },
    { id: "g_targ_remarketing", platform: "google", category: "טירגוט וקהלים", title: "Remarketing lists עדכניות", why: "רשימות ישנות לא יעילות.", how: "Audience manager; size > 1000." },
    { id: "g_tech_conv", platform: "google", category: "טכני ומעקב", title: "Conversion tracking תקין ומאומת", critical: true, why: "ללא conv → smart bidding לא יעבוד.", how: "Tools → Conversions → Status = Recording; Tag Assistant." },
    { id: "g_tech_enhanced", platform: "google", category: "טכני ומעקב", title: "Enhanced Conversions פעיל", why: "משפר match-rate ב-iOS/ITP.", how: "Conversions → Settings → Enhanced." },
    { id: "g_tech_ga4", platform: "google", category: "טכני ומעקב", title: "קישור GA4 ↔ Google Ads פעיל", why: "ייבוא Audiences ו-Conversions.", how: "Admin → Product links → Google Ads." },
    { id: "g_tech_attr", platform: "google", category: "טכני ומעקב", title: "מודל ייחוס Data-driven (DDA)", why: "DDA מקבל אותות מכל המסע.", how: "Conversions → Attribution → Data-driven." },
    { id: "g_tech_utm", platform: "google", category: "טכני ומעקב", title: "Auto-tagging מופעל + UTMs לא משוכפלים", why: "GCLID חיוני לייבוא מ-CRM.", how: "Account settings → Auto-tagging = ON." },

    { id: "m_perf_roas", platform: "meta", category: "ביצועים ותקציב", title: "ROAS/CPA/CPM ביחס ליעד וטרנד", why: "מזהה דריפט ושינויי ביצועים.", how: "Compare → Previous period; עמודות ROAS, CPA, CPM, Frequency." },
    { id: "m_perf_freq", platform: "meta", category: "ביצועים ותקציב", title: "Frequency < 2.5 (prospecting) / 4-5 (RT)", why: "Frequency גבוה = creative fatigue.", how: "עמודת Frequency; רענן creatives או הרחב קהל." },
    { id: "m_perf_hookrate", platform: "meta", category: "ביצועים ותקציב", title: "Hook rate (3s/imp) ≥ 25-30%", why: "Hook חלש = 3 שניות לא תופסות.", how: "3-second video plays / Impressions." },
    { id: "m_perf_learning", platform: "meta", category: "ביצועים ותקציב", title: "מחוץ ל-Learning Limited", why: "Limited = פחות מ-50 events/שבוע.", how: "עמודת Delivery; אחד ad sets / הגדל תקציב." },
    { id: "m_struct_naming", platform: "meta", category: "מבנה חשבון", title: "קונבנציית שמות (Campaign/Ad set/Ad)", why: "קריטי ל-UTMs דינמיים ודיווח.", how: "Objective_Funnel_Audience_Geo_Date." },
    { id: "m_struct_cbo", platform: "meta", category: "מבנה חשבון", title: "החלטת CBO vs ABO עקבית", why: "ערבוב מבלבל אלגוריתם.", how: "Performance → CBO; Testing → ABO." },
    { id: "m_struct_overlap", platform: "meta", category: "מבנה חשבון", title: "Audience Overlap בין ad sets", why: "Overlap = cannibalization + CPM גבוה.", how: "Audiences → Overlap; >25% = שקול איחוד." },
    { id: "m_struct_objective", platform: "meta", category: "מבנה חשבון", title: "Objective תואם ליעד אמיתי", critical: true, why: "Traffic במקום Conversions = קהל לא רלוונטי.", how: "Sales → Conversions; ודא event optimization." },
    { id: "m_targ_excl", platform: "meta", category: "טירגוט וקהלים", title: "Exclusions: לקוחות / רוכשים", why: "חוסך תקציב, מונע תלונות.", how: "Custom audience מ-Pixel events → Exclude." },
    { id: "m_targ_lal", platform: "meta", category: "טירגוט וקהלים", title: "Lookalikes על seed איכותי וטרי", why: "Seed קטן/ישן = איכות נמוכה.", how: "Seed ≥ 1000 Purchasers; רענון רבעוני." },
    { id: "m_targ_advantage", platform: "meta", category: "טירגוט וקהלים", title: "Advantage+ Audience — החלטה מודעת", why: "טוב Performance, מסוכן ב-niche.", how: "בשל = ON; רגיש = OFF/בקרה." },
    { id: "m_targ_geo", platform: "meta", category: "טירגוט וקהלים", title: "Geo + Age + Language בהתאם לקהל", why: "דליפות = בזבוז.", how: "People living in (לא visiting); age לפי persona." },
    { id: "m_tech_pixel", platform: "meta", category: "טכני ומעקב", title: "Pixel + CAPI מותקנים ופעילים", critical: true, why: "בלי CAPI = איבוד אותות (iOS/ITP).", how: "Events Manager → Test events; match ≥ 6.0." },
    { id: "m_tech_dedupe", platform: "meta", category: "טכני ומעקב", title: "Deduplication בין Pixel ל-CAPI", critical: true, why: "ספירת events כפולה = bidding שגוי.", how: "שלח event_id זהה; אמת ב-Test events." },
    { id: "m_tech_aem", platform: "meta", category: "טכני ומעקב", title: "AEM (iOS) — 8 events לפי עדיפות", why: "iOS 14+: 8 events לדומיין.", how: "Events Manager → AEM; Purchase = #1." },
    { id: "m_tech_domain", platform: "meta", category: "טכני ומעקב", title: "Domain verification מאומת", why: "בלי אימות אין AEM.", how: "Business settings → Brand safety → Domains." },
    { id: "m_tech_utm", platform: "meta", category: "טכני ומעקב", title: "UTMs דינמיים בכל המודעות", why: "ללא UTMs = אין traceability.", how: "URL parameters: facebook/paid_social/{{campaign.name}}/{{ad.name}}." },

    { id: "t_perf_metrics", platform: "tiktok", category: "ביצועים ותקציב", title: "CTR / CVR / CPA / VTR ≥ benchmark", why: "TikTok benchmarks שונים.", how: "CTR ≥ 1%; VTR (6s) ≥ 25%." },
    { id: "t_perf_diversity", platform: "tiktok", category: "ביצועים ותקציב", title: "≥ 3-5 קריאייטיבים לכל ad group", critical: true, why: "אלגוריתם דורש diversity.", how: "3-5 וריאציות hook; סבב 7-14 יום." },
    { id: "t_perf_spark", platform: "tiktok", category: "ביצועים ותקציב", title: "שימוש ב-Spark Ads", why: "Spark מנצח non-Spark ב-CTR/CVR.", how: "Authorization code מ-creator → Spark Ad." },
    { id: "t_struct_budget", platform: "tiktok", category: "מבנה חשבון", title: "Daily/Lifetime לפי אסטרטגיה", why: "Lifetime = end date; Daily = Always-on.", how: "בקמפיין → Budget." },
    { id: "t_struct_naming", platform: "tiktok", category: "מבנה חשבון", title: "קונבנציית שמות + UTM auto-fill", why: "דיווח אוטומטי.", how: "Objective_Audience_Creative_Date; UTM dynamic." },
    { id: "t_struct_dayparting", platform: "tiktok", category: "מבנה חשבון", title: "Dayparting לפי שעות", why: "שעות חלשות = בזבוז.", how: "Reporting → Time; Schedule בקמפיין." },
    { id: "t_targ_audiences", platform: "tiktok", category: "טירגוט וקהלים", title: "Custom + Lookalikes פעילים", why: "חוסך learning, משפר CPA.", how: "Assets → Audiences; LAL 1-3% מ-Purchasers." },
    { id: "t_targ_interest", platform: "tiktok", category: "טירגוט וקהלים", title: "Interest + Behavior layering", why: "רחב/צר מדי = ביצועים גרועים.", how: "Audience size 3M-30M ל-IL." },
    { id: "t_targ_excl", platform: "tiktok", category: "טירגוט וקהלים", title: "Exclusions של רוכשים", why: "מנע פנייה כפולה.", how: "Custom audience → Exclude." },
    { id: "t_tech_pixel", platform: "tiktok", category: "טכני ומעקב", title: "Pixel + Events API פעילים", critical: true, why: "איבוד אותות בלי server-side.", how: "Events Manager → Test events; הפעל Events API." },
    { id: "t_tech_match", platform: "tiktok", category: "טכני ומעקב", title: "EMQ (Identity match score) ≥ 60", why: "EMQ נמוך = bidding לא מדויק.", how: "Diagnostics → EMQ; הוסף email/phone hash." },
    { id: "t_tech_aem", platform: "tiktok", category: "טכני ומעקב", title: "Web Events Manager — 10 events לפי עדיפות", why: "סדר עדיפויות חשוב.", how: "WEM → סדר; Purchase = #1." },
    { id: "t_tech_utm", platform: "tiktok", category: "טכני ומעקב", title: "UTMs קונסיסטנטיים", why: "הפרדה ב-GA4/CRM.", how: "utm_source=tiktok&medium=paid_social." },
  ],
  prelaunch: [
    { id: "pg_tech_conv", platform: "google", category: "טכני (UTM/פיקסל/יעדים)", title: "Conversion goal הנכון מסומן", critical: true, why: "Goal לא נכון = בזבוז.", how: "Campaign → Settings → Conversion goals." },
    { id: "pg_tech_utm", platform: "google", category: "טכני (UTM/פיקסל/יעדים)", title: "Final URL + UTM / Auto-tagging", why: "ללא GCLID/UTM = אין tracing.", how: "Auto-tagging ON; UTMs ידניים ללא כפילות." },
    { id: "pg_tech_landing", platform: "google", category: "טכני (UTM/פיקסל/יעדים)", title: "Landing נטענת + מובייל-ready", why: "איטי = bounce + QS נמוך.", how: "PageSpeed mobile ≥ 70; CTA above fold." },
    { id: "pg_budget_match", platform: "google", category: "תקציב והצעות", title: "תקציב יומי תואם (חודשי / 30.4)", critical: true, why: "טעות ספרה = הוצאה כפולה.", how: "Daily = Monthly / 30.4; Shared budget." },
    { id: "pg_budget_bid", platform: "google", category: "תקציב והצעות", title: "Bid strategy + cap מתאימים", why: "tCPA מוקדם = under-delivery.", how: "Max Conv → tCPA אחרי 30+ conv; Max CPC limit." },
    { id: "pg_creative_assets", platform: "google", category: "קריאייטיב וטקסטים", title: "≥ 5 Headlines + 4 Descriptions", critical: true, why: "RSA דורש עושר.", how: "15 Headlines (מומלץ); Ad strength ≥ Good." },
    { id: "pg_creative_ext", platform: "google", category: "קריאייטיב וטקסטים", title: "Sitelinks/Callouts/Snippets פעילים", why: "מגדילים CTR ו-Ad rank.", how: "≥ 4 Sitelinks/Callouts; Call extension." },
    { id: "pg_targ_geo", platform: "google", category: "טירגוט והגדרות", title: "Locations + Presence + Language", critical: true, why: "ברירת מחדל Interest = מסוכן.", how: "Settings → Locations → Presence." },
    { id: "pg_targ_negs", platform: "google", category: "טירגוט והגדרות", title: "Negative keyword list מוצמדת", why: "חוסך זבל מהיום הראשון.", how: "Apply to campaign." },
    { id: "pg_targ_devices", platform: "google", category: "טירגוט והגדרות", title: "Device adjustments / exclusions", why: "B2C = מובייל; B2B = דסקטופ.", how: "Devices → Bid adjustment." },

    { id: "pm_tech_pixel", platform: "meta", category: "טכני (UTM/פיקסל/יעדים)", title: "Pixel + CAPI יורים על event הנכון", critical: true, why: "ללא event = bidding לא יעבוד.", how: "Test events; Browser + Server." },
    { id: "pm_tech_event", platform: "meta", category: "טכני (UTM/פיקסל/יעדים)", title: "Conversion event תואם ליעד", critical: true, why: "View Content במקום Purchase = קהל זול.", how: "Ad set → Event = Purchase / Lead." },
    { id: "pm_tech_utm", platform: "meta", category: "טכני (UTM/פיקסל/יעדים)", title: "UTMs דינמיים בכל המודעות", why: "ללא UTM = אין הפרדה.", how: "URL parameters: facebook/paid_social/{{campaign.name}}/{{ad.name}}." },
    { id: "pm_tech_landing", platform: "meta", category: "טכני (UTM/פיקסל/יעדים)", title: "Landing נבדקה במובייל + מהירה", why: "~95% תעבורה mobile.", how: "DevTools mobile; <3s; CTA above fold." },
    { id: "pm_budget_caps", platform: "meta", category: "תקציב והצעות", title: "Budget cap (יומי/lifetime) תואם לתוכנית", critical: true, why: "שכחת 0 / x10 = ספאם להנהלה.", how: "Spending limit ברמת חשבון." },
    { id: "pm_budget_bid", platform: "meta", category: "תקציב והצעות", title: "Bid: Highest volume / Cost cap לפי שלב", why: "Cost cap מוקדם = under-delivery.", how: "Launch → Highest volume; אחרי data → Cost cap." },
    { id: "pm_creative_specs", platform: "meta", category: "קריאייטיב וטקסטים", title: "מידות + פורמטים + שפה לפי placement", critical: true, why: "מודעה מרובעת ב-Reels = כיעור.", how: "Reels: 9:16 (1080×1920); Feed: 1:1 / 4:5." },
    { id: "pm_creative_copy", platform: "meta", category: "קריאייטיב וטקסטים", title: "Primary text/Headline/Description באורך", why: "חיתוך אוטומטי = מסר אבוד.", how: "Primary ≤ 125; Headline ≤ 27; Description ≤ 27." },
    { id: "pm_creative_brand", platform: "meta", category: "קריאייטיב וטקסטים", title: "Logo + branding מוקדם בויז'ואל", why: "3 שניות ראשונות = מותג נתפס.", how: "Logo bug ב-1-2s; צבעי מותג." },
    { id: "pm_targ_excl", platform: "meta", category: "טירגוט והגדרות", title: "Exclude לקוחות קיימים מ-prospecting", why: "הימנע מ-CPA כפול.", how: "Custom audience: Purchasers (180d)." },
    { id: "pm_targ_placements", platform: "meta", category: "טירגוט והגדרות", title: "Placements: Advantage+ או manual", why: "9:16 ב-Feed 1:1 = בעיה.", how: "ודא נכסים לכל placement; אחרת manual." },
    { id: "pm_targ_geoage", platform: "meta", category: "טירגוט והגדרות", title: "Geo + Age + Gender + Language לפי persona", why: "דליפות = CPA רע.", how: "Living in (לא visiting); 18+; שפה לפי שוק." },

    { id: "pt_tech_pixel", platform: "tiktok", category: "טכני (UTM/פיקסל/יעדים)", title: "Pixel / Events API יורים נכון", critical: true, why: "ללא events תקינים = Smart+ לא יעבוד.", how: "Events Manager → Test events." },
    { id: "pt_tech_event", platform: "tiktok", category: "טכני (UTM/פיקסל/יעדים)", title: "Optimization event תואם ליעד", why: "Click במקום Purchase = פחות איכותי.", how: "Ad group → Optimization goal → Event." },
    { id: "pt_tech_utm", platform: "tiktok", category: "טכני (UTM/פיקסל/יעדים)", title: "UTMs קונסיסטנטיים", why: "הפרדה ב-GA4/CRM.", how: "utm_source=tiktok&medium=paid_social." },
    { id: "pt_tech_landing", platform: "tiktok", category: "טכני (UTM/פיקסל/יעדים)", title: "Landing מהירה + מתאימה לקהל", why: "Gen-Z סבלנות נמוכה.", how: "PageSpeed mobile ≥ 75; native, ללא pop-ups." },
    { id: "pt_budget_match", platform: "tiktok", category: "תקציב והצעות", title: "תקציב ≥ 20× CPA יעד", critical: true, why: "תקציב נמוך = לא יוצא מ-learning.", how: "Daily ≥ 20× target CPA, או 50 events/שבוע." },
    { id: "pt_budget_bid", platform: "tiktok", category: "תקציב והצעות", title: "Bid: Lowest cost בהתחלה", why: "Cost cap מוקדם = under-delivery.", how: "Lowest cost; אחרי 50+ conv → Cost cap עדין." },
    { id: "pt_creative_specs", platform: "tiktok", category: "קריאייטיב וטקסטים", title: "וידאו 9:16, ≥720p, 9-15s, סאונד", critical: true, why: "ללא סאונד = delivery יורד.", how: "9:16 (1080×1920); MP4/MOV; hook ב-3s." },
    { id: "pt_creative_native", platform: "tiktok", category: "קריאייטיב וטקסטים", title: "קריאייטיב 'Native' (UGC, captions, sound)", why: "TVC לא עובד ב-TikTok.", how: "Creators / UGC; caption גלוי; voiceover." },
    { id: "pt_creative_text", platform: "tiktok", category: "קריאייטיב וטקסטים", title: "Display name + Text caption נבדקו", why: "טקסט נחתך = מסר אבוד.", how: "Caption ≤ 100; Display = brand; CTA." },
    { id: "pt_targ_audience", platform: "tiktok", category: "טירגוט והגדרות", title: "Audience size 3M-30M (IL מצומצם)", why: "רחב/צר מדי = learning קשה.", how: "Estimated audience size; כוונון interests." },
    { id: "pt_targ_excl", platform: "tiktok", category: "טירגוט והגדרות", title: "Exclusions של רוכשים אחרונים", why: "מנע bombardment.", how: "Custom audience מ-Purchase 90d → Exclude." },
    { id: "pt_targ_placement", platform: "tiktok", category: "טירגוט והגדרות", title: "Placement: TikTok בלבד (אלא אם)", why: "Pangle = traffic זול לא איכותי.", how: "Select placement → TikTok בלבד." },
  ],
};