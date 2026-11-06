# ======DRAIN BOT======
### Version -V.01 Beta ======

Bot WhatsApp per gruppi basato su [Baileys](https://github.com/WhiskeySockets/Baileys) (libreria open source che
usa l'API web di WhatsApp — niente a pagamento, login tramite QR code come WhatsApp Web).

Prefisso comandi: **`.`**
Uso riservato: **solo al numero owner configurato**.

## Comandi disponibili

| Comando | Descrizione |
|---|---|
| `.menu` | mostra il menu completo |
| `.ping` | mostra la velocità di risposta del bot |
| `.joke` | invia una barzelletta a caso |
| `.kick @utente` | espelle un utente dal gruppo |
| `.ban @utente` | espelle e blacklista un utente (il bot lo ri-espelle se rientra) |
| `.unban @utente` | rimuove un utente dalla blacklist |
| `.svt` | espelle `svtMax` (default 1) membro/i **a caso** dal gruppo — gli admin sono protetti e non vengono mai estratti |
| `.mute` | solo gli admin possono scrivere nel gruppo |
| `.unmute` | tutti possono tornare a scrivere |
| `.hidetag <testo>` | menziona tutti i membri senza mostrare i tag nel testo |
| `.chat on` / `.chat off` | attiva/disattiva il bot nella chat corrente |

I comandi di moderazione (`kick`, `ban`, `unban`, `mute`, `unmute`, `hidetag`, `svt`) funzionano **solo nei gruppi**
e **solo se il bot è admin** del gruppo: se non lo è, risponde chiedendoti di promuoverlo.

## Protezione automatica

Il bot analizza automaticamente immagini, video e sticker inviati nei gruppi in cui è admin ed elimina i contenuti
rilevati come **NSFW o gore**, segnalandolo in chat. Il rilevamento usa l'API gratuita di
[SightEngine](https://sightengine.com) (hai una quota free, sufficiente per un bot di gruppo): senza API key il
bot parte comunque, ma il controllo resta disattivato finché non le inserisci (vedi sotto).

## Installazione

Richiede **Node.js 18 o superiore**.

```bash
git clone <url-del-tuo-repo>
cd drain-bot
npm install
cp .env.example .env
```

Apri `.env` e imposta:

```
OWNER_NUMBER=393331234567      # il tuo numero, formato internazionale, senza +
SIGHTENGINE_USER=              # opzionale, per l'anti-nsfw/gore reale
SIGHTENGINE_SECRET=            # opzionale
```

Avvia il bot:

```bash
npm start
```

Al primo avvio apparirà un **QR code nel terminale** (e verrà salvato anche come `qr.png` nella cartella del
progetto, utile se stai lanciando il bot su un server senza interfaccia grafica). Scannerizzalo da WhatsApp:

`WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo`

Da quel momento il bot resta connesso; la sessione viene salvata nella cartella `auth_info/` (NON va caricata su
GitHub, è già esclusa dal `.gitignore`).

## Pubblicazione su GitHub

```bash
git init
git add .
git commit -m "Drain Bot v0.1"
git branch -M main
git remote add origin <url-del-tuo-repo-github>
git push -u origin main
```

`.env`, `auth_info/` e `data/db.json` sono esclusi automaticamente: non caricherai mai per sbaglio il tuo numero,
le credenziali di sessione WhatsApp o lo stato interno del bot.

## Note importanti

- Baileys è una libreria **non ufficiale**: automatizzare un account WhatsApp personale non è coperto dai termini
  di servizio ufficiali di WhatsApp. Usalo in modo responsabile, preferibilmente con un numero dedicato al bot
  (non il tuo numero principale), per evitare rischi di blocco dell'account.
- `.svt` espelle membri reali dal gruppo in modo casuale: usalo solo in gruppi dove tu e i partecipanti siete
  d'accordo sulla natura "gioco/prank" del comando.
- Ogni messaggio inviato dal bot include automaticamente la firma:
  `BOT IDEATO DA DRAIN` + link del gruppo di riferimento, come richiesto.

---
BOT IDEATO DA DRAIN
https://chat.whatsapp.com/DxEIVERbKtIKkvsDvFWJpX?s=cl&p=i&mlu=4&ilr=4&iam=2
