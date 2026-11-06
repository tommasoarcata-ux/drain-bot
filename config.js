require("dotenv").config();

module.exports = {
  // Prefisso di TUTTI i comandi, come richiesto: "."
  prefix: ".",

  // Numero dell'owner (unico autorizzato a usare i comandi admin).
  // Formato: internazionale, senza "+" -> es. 393331234567
  ownerNumber: (process.env.OWNER_NUMBER || "").replace(/\D/g, ""),

  botName: "DRAIN BOT",
  version: "V.01 Beta",

  // Firma automatica aggiunta in fondo a OGNI messaggio inviato dal bot
  footer:
    "\n\n──────────────\n*BOT IDEATO DA DRAIN*\nhttps://chat.whatsapp.com/DxEIVERbKtIKkvsDvFWJpX?s=cl&p=i&mlu=4&ilr=4&iam=2",

  // Intestazione fissa richiesta per il comando .menu
  menuHeader: "======DRAIN BOT======\nVersion -V.01 Beta\n======",

  // .svt = espelle membri a caso dal gruppo. svtMax = quante persone a caso
  // vengono espulse ad ogni esecuzione del comando (richiesto: 1)
  svtMax: 1,

  // Config anti nsfw / anti gore sui media del gruppo
  nsfw: {
    enabled: true,
    // Se vuoti, il check gira in modalità "placeholder" (logga soltanto, non blocca)
    sightengineUser: process.env.SIGHTENGINE_USER || "",
    sightengineSecret: process.env.SIGHTENGINE_SECRET || "",
    // soglia 0-1: più alta = più permissivo
    threshold: 0.75,
    // cosa fare quando trova contenuto vietato: "delete" oppure "delete_kick"
    action: "delete_kick",
  },
};
