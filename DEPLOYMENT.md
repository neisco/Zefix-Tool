# Deployment Guide für Vercel

Dieses Projekt ist eine Next.js Web-Anwendung und kann mit wenigen Klicks kostenlos auf [Vercel](https://vercel.com) gehostet werden. Es ist so strukturiert, dass es in der Cloud läuft, ohne dass eine externe Datenbank konfiguriert werden muss.

## Schritt-für-Schritt Anleitung (Online-Hosting)

### 1. Code auf GitHub hochladen
1. Erstelle einen kostenlosen Account auf [GitHub](https://github.com/).
2. Lade den Ordner `Zefix Programm` auf ein neues privates Repository auf GitHub hoch. 
   *(Tipp: Du kannst GitHub Desktop nutzen oder den Code über das Terminal pushen)*

### 2. Mit Vercel verbinden
1. Erstelle einen kostenlosen Account auf [Vercel](https://vercel.com/) (am besten direkt mit GitHub anmelden).
2. Klicke im Vercel Dashboard auf **"Add New"** -> **"Project"**.
3. Verbinde deinen GitHub-Account und wähle das hochgeladene Repository aus.
4. Klicke auf **"Import"**.

### 3. Vercel Projekt konfigurieren
1. **Project Name**: Beliebig wählbar (z.B. `zefix-tool`).
2. **Framework Preset**: Vercel erkennt automatisch, dass es sich um ein `Next.js` Projekt handelt.
3. **Environment Variables**: Aktuell werden **keine** Variablen benötigt, da das Tool die öffentliche Zefix-Schnittstelle nutzt.
4. Klicke auf **"Deploy"**.

### 4. Fertig!
Vercel baut nun dein Projekt (das dauert ca. 1-2 Minuten). Danach erhältst du einen Live-Link (z.B. `https://zefix-tool.vercel.app`), den du überall in deinem Browser öffnen kannst.

---

## Lokale Entwicklung (Localhost)

Falls du das Tool vor dem Hochladen lokal auf deinem Computer im Browser testen möchtest:

1. Öffne das Terminal in diesem Ordner.
2. Führe den Befehl aus:
   ```bash
   npm run dev
   ```
3. Öffne deinen Browser und gehe auf `http://localhost:3000`.

Um den finalen Build auf deinem lokalen PC zu testen (so wie Vercel ihn auch bauen wird):
```bash
npm run build
npm run start
```

## Weiterentwicklung (Accounts & Login)
Das Projekt ist bereits so aufgebaut, dass Features wie Benutzerkonten, Login oder eine Datenbank einfach hinzugefügt werden können. Da die Zefix-Logik über eine Serverless-Route (`src/app/api/zefix/route.ts`) gesichert ist, können dort künftig auch Authentifizierungs-Prüfungen (z.B. mit NextAuth.js oder Clerk) eingebaut werden, bevor Zefix abgefragt wird.
