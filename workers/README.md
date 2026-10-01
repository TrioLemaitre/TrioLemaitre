# Kontaktformular bereitstellen

Der Worker verarbeitet `POST /api/contact` und versendet die Anfrage über
Cloudflare Email Service. Er speichert die Formulardaten nicht in einer
eigenen Datenbank.

## Einmalige Cloudflare-Konfiguration

1. `trio-lemaitre.de` in Cloudflare Email Service einrichten.
2. `kontakt@trio-lemaitre.de` über Email Routing an das gewünschte Postfach
   weiterleiten und die Zieladresse bestätigen.
3. Die tatsächliche Zieladresse als Worker-Secret hinterlegen:

   ```powershell
   npx wrangler secret put CONTACT_DESTINATION
   ```

4. Den Worker veröffentlichen:

   ```powershell
   npm run deploy:worker
   ```

Die DNS-Einträge für `trio-lemaitre.de` und `www.trio-lemaitre.de` müssen in
Cloudflare auf „Proxied“ stehen, damit die Worker-Routen unter `/api/contact`
ausgeführt werden. Die Website selbst kann weiterhin von GitHub Pages kommen.
