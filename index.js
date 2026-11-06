const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const jokes = require("./lib/jokes");
const nsfw = require("./lib/nsfw");
const db = require("./lib/db");

if (!config.ownerNumber) {
  console.log(
    "❌  Devi impostare OWNER_NUMBER nel file .env (il tuo numero con prefisso internazionale, senza +)."
  );
  process.exit(1);
}

const ownerJid = config.ownerNumber + "@s.whatsapp.net";

// ---------- util ----------

function withFooter(text) {
  return `${text}${config.footer}`;
}

async function reply(sock, jid, text, quoted) {
  await sock.sendMessage(jid, { text: withFooter(text) }, { quoted });
}

function isOwner(senderJid) {
  const num = senderJid.replace(/[^0-9]/g, "");
  return num === config.ownerNumber;
}

async function isBotAdmin(sock, groupId) {
  const metadata = await sock.groupMetadata(groupId);
  const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
  const botParticipant = metadata.participants.find((p) => p.id === botId);
  return botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";
}

function getMessageText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ""
  );
}

// ---------- menu ----------

function buildMenu() {
  return (
    `${config.menuHeader}\n\n` +
    `Prefisso comandi: *${config.prefix}*\n\n` +
    `📋 *MENU COMANDI*\n\n` +
    `▸ ${config.prefix}menu — mostra questo menu\n` +
    `▸ ${config.prefix}ping — mostra la velocità di risposta del bot\n` +
    `▸ ${config.prefix}joke — invia una barzelletta a caso\n\n` +
    `🛡️ *MODERAZIONE* (richiede bot admin + solo owner)\n` +
    `▸ ${config.prefix}kick @utente — espelle un utente\n` +
    `▸ ${config.prefix}ban @utente — espelle e blocca il rientro dell'utente\n` +
    `▸ ${config.prefix}unban @utente — rimuove un utente dalla blacklist\n` +
    `▸ ${config.prefix}svt — espelle ${config.svtMax} membro/i a caso dal gruppo\n` +
    `▸ ${config.prefix}mute — solo gli admin possono scrivere nel gruppo\n` +
    `▸ ${config.prefix}unmute — tutti possono tornare a scrivere\n` +
    `▸ ${config.prefix}hidetag <testo> — menziona tutti senza mostrare i tag\n\n` +
    `⚙️ *GESTIONE BOT*\n` +
    `▸ ${config.prefix}chat on — riattiva il bot in questa chat\n` +
    `▸ ${config.prefix}chat off — disattiva il bot in questa chat\n\n` +
    `🚫 *PROTEZIONE AUTOMATICA*\n` +
    `▸ Anti-gore e anti-NSFW attivi su immagini/video/sticker inviati nel gruppo\n`
  );
}

// ---------- avvio bot ----------

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Drain Bot", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 Scansiona questo QR code con WhatsApp (Dispositivi collegati):\n");
      qrcodeTerminal.generate(qr, { small: true });
      // Salva anche come immagine, utile se lavori da remoto / server senza terminale grafico
      try {
        await QRCode.toFile(path.join(__dirname, "qr.png"), qr);
        console.log("🖼️  QR salvato anche come qr.png nella cartella del progetto.");
      } catch (e) {
        console.log("Impossibile salvare qr.png:", e.message);
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connessione chiusa.", shouldReconnect ? "Riconnessione..." : "Logout effettuato.");
      if (shouldReconnect) start();
    } else if (connection === "open") {
      console.log(`✅ ${config.botName} connesso correttamente!`);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");
    const sender = isGroup ? msg.key.participant : chatId;

    // --- Protezione anti-gore / anti-nsfw (gira su ogni media del gruppo, non solo comandi) ---
    if (isGroup && config.nsfw.enabled) {
      const mtype = Object.keys(msg.message)[0];
      if (["imageMessage", "videoMessage", "stickerMessage"].includes(mtype)) {
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {});
          const result = await nsfw.checkMediaBuffer(buffer);
          if (result.flagged) {
            await sock.sendMessage(chatId, { delete: msg.key });
            await reply(
              sock,
              chatId,
              `🚫 Messaggio rimosso: ${result.reason} non consentito in questo gruppo.`
            );
          }
        } catch (e) {
          console.log("[anti-nsfw] errore analisi media:", e.message);
        }
      }
    }

    const text = getMessageText(msg).trim();
    if (!text.startsWith(config.prefix)) return;

    const args = text.slice(config.prefix.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();

    // Bot usabile SOLO dall'owner, come richiesto
    if (!isOwner(sender)) {
      return; // ignora silenziosamente chiunque non sia l'owner
    }

    // .chat on/off funziona anche se la chat è disattivata, le altre no
    if (command !== "chat" && isGroup && !db.isChatActive(chatId)) return;

    try {
      switch (command) {
        case "menu": {
          await reply(sock, chatId, buildMenu(), msg);
          break;
        }

        case "ping": {
          const start = Date.now();
          const sent = await sock.sendMessage(chatId, { text: "🏓 Pong..." }, { quoted: msg });
          const ms = Date.now() - start;
          await sock.sendMessage(
            chatId,
            { text: withFooter(`🏓 *Pong!*\nVelocità di risposta: ${ms} ms`), edit: sent.key },
            {}
          );
          break;
        }

        case "joke": {
          const joke = jokes[Math.floor(Math.random() * jokes.length)];
          await reply(sock, chatId, `😂 ${joke}`, msg);
          break;
        }

        case "chat": {
          const sub = (args[0] || "").toLowerCase();
          if (!["on", "off"].includes(sub)) {
            await reply(sock, chatId, `Uso corretto: ${config.prefix}chat on | ${config.prefix}chat off`, msg);
            break;
          }
          db.setChatActive(chatId, sub === "on");
          await reply(sock, chatId, `✅ Bot ${sub === "on" ? "attivato" : "disattivato"} in questa chat.`, msg);
          break;
        }

        // ---- comandi che richiedono gruppo + bot admin ----
        case "kick":
        case "ban":
        case "unban":
        case "mute":
        case "unmute":
        case "hidetag":
        case "svt": {
          if (!isGroup) {
            await reply(sock, chatId, "⚠️ Questo comando funziona solo nei gruppi.", msg);
            break;
          }
          if (!(await isBotAdmin(sock, chatId))) {
            await reply(
              sock,
              chatId,
              "⚠️ Devo essere *admin* del gruppo per eseguire questo comando. Promuovimi e riprova.",
              msg
            );
            break;
          }
          await handleGroupCommand(sock, chatId, msg, command, args);
          break;
        }

        default:
          // comando sconosciuto: ignora silenziosamente per non spammare il gruppo
          break;
      }
    } catch (err) {
      console.log("Errore gestendo comando:", command, err);
      await reply(sock, chatId, "❌ Si è verificato un errore eseguendo il comando.", msg);
    }
  });
}

// ---------- comandi di gruppo ----------

async function handleGroupCommand(sock, chatId, msg, command, args) {
  const metadata = await sock.groupMetadata(chatId);
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  switch (command) {
    case "kick": {
      if (!mentioned.length) {
        await reply(sock, chatId, `Uso corretto: ${config.prefix}kick @utente`, msg);
        return;
      }
      await sock.groupParticipantsUpdate(chatId, mentioned, "remove");
      await reply(sock, chatId, `👢 Utente espulso dal gruppo.`, msg);
      break;
    }

    case "ban": {
      if (!mentioned.length) {
        await reply(sock, chatId, `Uso corretto: ${config.prefix}ban @utente`, msg);
        return;
      }
      for (const jid of mentioned) db.addToBlacklist(jid);
      await sock.groupParticipantsUpdate(chatId, mentioned, "remove");
      await reply(sock, chatId, `🔨 Utente espulso e bannato: non potrà essere riaggiunto dal bot.`, msg);
      break;
    }

    case "unban": {
      if (!mentioned.length) {
        await reply(sock, chatId, `Uso corretto: ${config.prefix}unban @utente`, msg);
        return;
      }
      for (const jid of mentioned) db.removeFromBlacklist(jid);
      await reply(sock, chatId, `✅ Utente rimosso dalla blacklist.`, msg);
      break;
    }

    case "mute": {
      await sock.groupSettingUpdate(chatId, "announcement");
      await reply(sock, chatId, "🔇 Gruppo mutato: solo gli admin possono scrivere.", msg);
      break;
    }

    case "unmute": {
      await sock.groupSettingUpdate(chatId, "not_announcement");
      await reply(sock, chatId, "🔊 Gruppo smutato: tutti possono scrivere.", msg);
      break;
    }

    case "hidetag": {
      const text = args.join(" ") || "📢 Attenzione a tutti!";
      const allJids = metadata.participants.map((p) => p.id);
      await sock.sendMessage(chatId, { text: withFooter(text), mentions: allJids });
      break;
    }

    case "svt": {
      const members = metadata.participants.filter(
        (p) => p.id !== sock.user.id.split(":")[0] + "@s.whatsapp.net" && p.admin !== "admin" && p.admin !== "superadmin"
      );
      if (!members.length) {
        await reply(sock, chatId, "⚠️ Nessun membro disponibile da espellere (gli admin sono protetti).", msg);
        return;
      }
      const shuffled = members.sort(() => 0.5 - Math.random());
      const toKick = shuffled.slice(0, Math.min(config.svtMax, shuffled.length));
      await sock.groupParticipantsUpdate(chatId, toKick.map((p) => p.id), "remove");
      const names = toKick.map((p) => "@" + p.id.split("@")[0]).join(", ");
      await sock.sendMessage(chatId, {
        text: withFooter(`🎲 Espulso/i a caso dal gruppo: ${names}`),
        mentions: toKick.map((p) => p.id),
      });
      break;
    }
  }
}

start();
