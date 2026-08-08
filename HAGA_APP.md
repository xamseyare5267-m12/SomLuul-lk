# Hagaha Maamulka iyo Wax-ka-beddelka App-ka SomLuul 🚀

Hagahan wuxuu ku tusi doonaa sida uu app-ku u habaysan yahay, isbeddelladii ugu dambeeyay ee la sameeyay, iyo sida aad adigu mustaqbalka wax uga beddeli karto ama ugu dari karto sifooyin cusub.

---

## 🛠️ Isbeddelladii Ugu Dambeeyay (Saxeexyada Luuqadda)

Macaamiil ahaan, waxaad codsatay in isbeddel lagu sameeyo ereyada gelitaanka ee Ingiriisiga iyo Soomaaliga:
1. **Sign In (Soo Gal)** waxaa loo beddelay **Login (Soo Gal)**.
2. **Create Account (Abuur Akoon)** waxaa loo beddelay **Sign Up (Is-diiwangeli)**.

### Faylasha la beddelay:
- `/public/locales/en.json` (Luuqadda Ingiriisiga)
- `/public/locales/so.json` (Luuqadda Soomaaliga)
- `/src/components/LanguageContext.tsx` (Dictionary-ga gudaha ee loogu talagalay fallback-ga luuqadaha)

---

## 📂 Sida uu App-ku u Qaabaysan Yahay (Folder Structure)

Si aad si fudud u fahamto meesha wax laga beddelayo haddii app-ka daldaloolo ama isbeddel mustaqbalka lagu sameynayo:

```text
├── public/
│   └── locales/                # Halkaan waxaa ku jira luuqadaha (en.json, so.json, ar.json, fr.json, es.json)
├── src/
│   ├── types.ts                # Qeexidda noocyada xogta (Profiles, Files, Stats, iqd)
│   ├── main.tsx                # Meesha laga kiciyo React (barta koowaad ee frontend)
│   ├── App.tsx                 # Koontaroolaha Guud (maareeyaa kalfadhiyada/sessions iyo toast messages)
│   ├── index.css               # Nashqadaynta CSS-ka (Tailwind, xarfo-shubka Inter & JetBrains Mono)
│   └── components/
│       ├── LanguageContext.tsx # Maareeyaha luuqadaha app-ka iyo turjumaadda
│       ├── ThemeContext.tsx    # Maareeyaha iftiinka ama madowga (Dark/Light mode)
│       ├── AuthPages.tsx       # Bogga Soo Gelitaanka (Login, Sign-Up, Erey-sir Beddel)
│       ├── Layout.tsx          # Qaabka dashboard-ka (Sidebar-ka, Menu-ga, iwm)
│       ├── DragDropUpload.tsx  # Meesha faylasha lagu soo upload-gareeyo (jiid oo ku tuur)
│       ├── FilePreviewModal.tsx# Daawashada faylasha (Sawirada, PDF, Videos)
│       ├── UserDashboard.tsx   # Dashboard-ka isticmaalaha caadiga ah (faylashooda, kaydkooda)
│       └── AdminDashboard.tsx  # Dashboard-ka Admin-ka (maamulidda isticmaalayaasha iyo xogaha)
├── server.ts                   # Backend-ka (Express.js) oo maareeya faylasha iyo authentication-ka
├── supabase_schema.sql         # Shaxda Database-ka (Profiles & Files) ee aad ku shubayso Supabase
└── package.json                # Maktabadaha uu app-ku ku shaqeeyo iyo amarrada (scripts)
```

---

## 🔑 Sida loo xiro Database-ka iyo Key-ga (Supabase Setup)

App-kan wuxuu u isticmaalaa **Supabase** kaydinta isticmaalayaasha (Authentication) iyo faylasha (Storage).

### 1. Samee Akoon Supabase:
- Tag [Supabase](https://supabase.com) oo ka sameeyo mashruuc cusub (New Project).
- Tag **SQL Editor** ee Supabase, ku koobiyeey (copy) dhammaan waxa ku qoran faylka `supabase_schema.sql` ee app-ka ku jira, ka dibna guji **Run** si database-kii u dhismo.

### 2. Deji Secrets / Environment Variables:
Deji furayaashan (Keys) gudaha faylka `.env` ee deegaankaaga ama ka rari settings-ka meesha aad ku martigelinayso (sida Vercel ama Netlify):

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-public-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```
*Xusuusnoow: Furayaasha waxaad ka helaysaa Supabase dashboard-kaaga adoo aadaya **Project Settings** -> **API**.*

---

## 💻 Sida loo dhex orodsiiyo App-ka kombuyuutarkaaga (Locally)

Haddii aad rabto inaad kombuyuutarkaaga ku tijaabiso ama ku beddesho waxyaabo dheeraad ah:

1. **Soo deji Node.js**: Hubi in kombuyuutarkaaga uu ku rakiban yahay Node.js v18+.
2. **Ku shub dependencies-ka**:
   ```bash
   npm install
   ```
3. **Kici server-ka tijaabada**:
   ```bash
   npm run dev
   ```
4. Fur barowsarkaaga (Browser) oo qor: `http://localhost:3000`

---

## 🚀 Sidee loo badbaadiyaa ama loogu diraa GitHub?

Sida ka muuqata sawirka aad soo dirtay (**Sync to GitHub**):
1. Sanduuqa **New repository name** ku qor magaca aad rabto (tusaale, `somluul-app` ama magac kasta oo aad doorato).
2. Dooro inuu noqdo **Private** (adigoo kaliya arki kara) ama **Public** (qof walba arki karo).
3. Guji badhanka **Create GitHub repository** ee hoose ku yaalla (badhanku wuxuu noqonayaa mid la gujin karo marka magacu sax yahay oo aad ku xidho akoonkaaga GitHub).
4. Marka uu GitHub ku shubmo, waxaad heli doontaa nuqul ammaan ah oo aad mar walba wax ka beddeli karto!

---

*Haddii aad u baahato caawinaad kale oo ku saabsan sifooyinka app-ka ama aad rabto inaan wax kale kuu habayno, mar walba nala soo xiriir!*
