const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { disabledChats: [], svtUsage: {}, blacklist: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return { disabledChats: [], svtUsage: {}, blacklist: [] };
  }
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function isChatActive(chatId) {
  const db = load();
  return !db.disabledChats.includes(chatId);
}

function setChatActive(chatId, active) {
  const db = load();
  db.disabledChats = db.disabledChats.filter((id) => id !== chatId);
  if (!active) db.disabledChats.push(chatId);
  save(db);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getSvtUsage(chatId) {
  const db = load();
  const key = `${chatId}_${getTodayKey()}`;
  return db.svtUsage[key] || 0;
}

function incrementSvtUsage(chatId) {
  const db = load();
  const key = `${chatId}_${getTodayKey()}`;
  db.svtUsage[key] = (db.svtUsage[key] || 0) + 1;
  save(db);
  return db.svtUsage[key];
}

function addToBlacklist(jid) {
  const db = load();
  if (!db.blacklist.includes(jid)) db.blacklist.push(jid);
  save(db);
}

function removeFromBlacklist(jid) {
  const db = load();
  db.blacklist = db.blacklist.filter((j) => j !== jid);
  save(db);
}

function isBlacklisted(jid) {
  const db = load();
  return db.blacklist.includes(jid);
}

module.exports = {
  isChatActive,
  setChatActive,
  getSvtUsage,
  incrementSvtUsage,
  addToBlacklist,
  removeFromBlacklist,
  isBlacklisted,
};
