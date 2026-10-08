// ============================================================
//  Cloudflare Worker — Nabz-e Bazaar Bot + GitHub Trigger
//  نسخه: 15.7 Final
//
//  قابلیت‌های کامل:
//    - ۴۷ دارایی (ارز، طلا، سکه، نفت)
//    - Trigger GitHub Action هر ۳۰ دقیقه
//    - نوتیف ساعتی (نوتیف قبلی قبل از جدید پاک می‌شود)
//    - هشدار تغییر ۵٬۰۰۰ تومانی در نوتیف
//    - اشتراک زنده دلار (ویرایش پیام)
//    - هشدار قیمت دلخواه /alert
//    - Rate limiting با "لطفاً صبر کنید"
//    - نمایش قیمت قبلی در تغییرات
//    - UI از GitHub Pages (index.html)
//    - endpoint /admin/stats
//    - Timeout در sendHourlyNotification
//    - cache buster برای چارت‌ها
//    - fallback chain کامل
// ============================================================

// ============================================================
//  بخش ۱: ثابت‌ها
// ============================================================

const CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
});

const NABZ_RAW = "https://raw.githubusercontent.com/NodeOOF/usd/main";
const NABZ_CDN = "https://cdn.jsdelivr.net/gh/NodeOOF/usd@main";

const HISTORY_SOURCES = [
  `${NABZ_RAW}/api/history_usd.json`,
  `${NABZ_CDN}/api/history_usd.json`,
];

const MARKET_SOURCES = [
  `${NABZ_RAW}/market.json`,
  `${NABZ_CDN}/market.json`,
];

const CHART_BASE_URLS = [
  "https://raw.githubusercontent.com/NodeOOF/usd/main",
  "https://cdn.jsdelivr.net/gh/NodeOOF/usd@main",
];

// آدرس GitHub Pages برای UI
const GITHUB_PAGES_URL = "https://NodeOOF.github.io/usd/";

const FOOTER = "\n\n━━━━━━━━━━━━━━━━━━━\n🌐 github.com/NodeOOF\n🤖 @dolarazad\\_bot";

const DEFAULT_CACHE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 10000;

const KV_SUB_PREFIX = "sub:";
const KV_USER_PREFIX = "user:";
const KV_NOTIFY_MSG_PREFIX = "notify:last:";
const KV_LAST_NOTIFY_TIME = "notify:last_time";
const KV_ALERT_PREFIX = "alert:";
const KV_RATE_PREFIX = "rate:";

const KV_SUB_TTL = 60 * 60 * 24 * 7;
const KV_USER_TTL = 60 * 60 * 24 * 30;
const KV_NOTIFY_MSG_TTL = 60 * 60 * 24 * 7;
const KV_ALERT_TTL = 60 * 60 * 24 * 30;

const NOTIFY_INTERVAL_MINUTES = 60;
const NOTIFY_BATCH_SIZE = 20;
const NOTIFY_TIMEOUT_MS = 25000;

const ALERT_CHANGE_THRESHOLD = 5000;

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60;

// ============================================================
//  جدول دارایی‌ها
// ============================================================

const ASSETS = {
  usd: { title: "دلار آمریکا", icon: "🇺🇸", unit: "تومان", category: "major" },
  eur: { title: "یورو اروپا", icon: "🇪🇺", unit: "تومان", category: "major" },
  aed: { title: "درهم امارات", icon: "🇦🇪", unit: "تومان", category: "major" },
  try: { title: "لیر ترکیه", icon: "🇹🇷", unit: "تومان", category: "major" },
  gbp: { title: "پوند انگلیس", icon: "🇬🇧", unit: "تومان", category: "major" },
  cad: { title: "دلار کانادا", icon: "🇨🇦", unit: "تومان", category: "major" },
  aud: { title: "دلار استرالیا", icon: "🇦🇺", unit: "تومان", category: "major" },
  cny: { title: "یوان چین", icon: "🇨🇳", unit: "تومان", category: "major" },
  gold_18k: { title: "طلای ۱۸ عیار", icon: "✨", unit: "تومان", category: "gold" },
  gold_mesghal: { title: "مثقال طلا", icon: "⚖️", unit: "تومان", category: "gold" },
  usd_xau: { title: "انس جهانی طلا", icon: "🌐", unit: "دلار", category: "gold" },
  gold_ounce: { title: "انس جهانی طلا", icon: "🌐", unit: "دلار", category: "gold" },
  coin_emami: { title: "سکه تمام امامی", icon: "🟡", unit: "تومان", category: "coin" },
  coin_bahar: { title: "سکه بهار آزادی", icon: "🟡", unit: "تومان", category: "coin" },
  coin_half: { title: "نیم سکه", icon: "🟡", unit: "تومان", category: "coin" },
  coin_quarter: { title: "ربع سکه", icon: "🟡", unit: "تومان", category: "coin" },
  coin_gram: { title: "سکه گرمی", icon: "🟡", unit: "تومان", category: "coin" },
  rub: { title: "روبل روسیه", icon: "🇷🇺", unit: "تومان", category: "fiat" },
  iqd: { title: "۱۰۰ دینار عراق", icon: "🇮🇶", unit: "تومان", category: "fiat" },
  myr: { title: "رینگیت مالزی", icon: "🇲🇾", unit: "تومان", category: "fiat" },
  gel: { title: "لاری گرجستان", icon: "🇬🇪", unit: "تومان", category: "fiat" },
  azn: { title: "منات آذربایجان", icon: "🇦🇿", unit: "تومان", category: "fiat" },
  amd: { title: "۱۰۰ درام ارمنستان", icon: "🇦🇲", unit: "تومان", category: "fiat" },
  thb: { title: "بات تایلند", icon: "🇹🇭", unit: "تومان", category: "fiat" },
  omr: { title: "ریال عمان", icon: "🇴🇲", unit: "تومان", category: "fiat" },
  jpy: { title: "۱۰۰ ین ژاپن", icon: "🇯🇵", unit: "تومان", category: "fiat" },
  sar: { title: "ریال عربستان", icon: "🇸🇦", unit: "تومان", category: "fiat" },
  inr: { title: "روپیه هند", icon: "🇮🇳", unit: "تومان", category: "fiat" },
  afn: { title: "افغانی", icon: "🇦🇫", unit: "تومان", category: "fiat" },
  nok: { title: "کرون نروژ", icon: "🇳🇴", unit: "تومان", category: "fiat" },
  chf: { title: "فرانک سوئیس", icon: "🇨🇭", unit: "تومان", category: "fiat" },
  qar: { title: "ریال قطر", icon: "🇶🇦", unit: "تومان", category: "fiat" },
  krw: { title: "۱۰۰ وون کره", icon: "🇰🇷", unit: "تومان", category: "fiat" },
  sek: { title: "کرون سوئد", icon: "🇸🇪", unit: "تومان", category: "fiat" },
  nzd: { title: "دلار نیوزیلند", icon: "🇳🇿", unit: "تومان", category: "fiat" },
  sgd: { title: "دلار سنگاپور", icon: "🇸🇬", unit: "تومان", category: "fiat" },
  kwd: { title: "دینار کویت", icon: "🇰🇼", unit: "تومان", category: "fiat" },
  hkd: { title: "دلار هنگ‌کنگ", icon: "🇭🇰", unit: "تومان", category: "fiat" },
  dkk: { title: "کرون دانمارک", icon: "🇩🇰", unit: "تومان", category: "fiat" },
  kgs: { title: "سام قرقیزستان", icon: "🇰🇬", unit: "تومان", category: "fiat" },
  tjs: { title: "سامانی تاجیکستان", icon: "🇹🇯", unit: "تومان", category: "fiat" },
  tmt: { title: "منات ترکمنستان", icon: "🇹🇲", unit: "تومان", category: "fiat" },
  bhd: { title: "دینار بحرین", icon: "🇧🇭", unit: "تومان", category: "fiat" },
  syp: { title: "۱۰۰ لیر سوریه", icon: "🇸🇾", unit: "تومان", category: "fiat" },
  ars: { title: "پزو آرژانتین", icon: "🇦🇷", unit: "تومان", category: "fiat" },
  brl: { title: "رئال برزیل", icon: "🇧🇷", unit: "تومان", category: "fiat" },
  pkr: { title: "روپیه پاکستان", icon: "🇵🇰", unit: "تومان", category: "fiat" },
  oil: { title: "نفت خام", icon: "🛢", unit: "دلار", category: "energy" },
};

const BOT_COMMANDS = [
  { command: "start", description: "🏠 شروع و منوی اصلی" },
  { command: "all", description: "📊 همه قیمت‌ها" },
  { command: "price", description: "💵 دلار + نمودار" },
  { command: "eur", description: "💶 یورو + نمودار" },
  { command: "gold", description: "🥇 طلا + نمودار" },
  { command: "coins", description: "🪙 سکه + نمودار" },
  { command: "currencies", description: "💱 ارزها" },
  { command: "oil", description: "🛢 نفت" },
  { command: "history", description: "📊 تاریخچه دلار" },
  { command: "stats", description: "📈 آمار" },
  { command: "compare", description: "📉 مقایسه" },
  { command: "convert", description: "🔄 تبدیل" },
  { command: "alert", description: "🔔 هشدار قیمت دلخواه" },
  { command: "alert_off", description: "🔕 لغو هشدار قیمت" },
  { command: "subscribe", description: "🔔 اشتراک زنده دلار" },
  { command: "unsubscribe", description: "🔕 لغو اشتراک زنده" },
  { command: "notify_off", description: "🔕 لغو نوتیف ساعتی" },
  { command: "notify_on", description: "🔔 فعال‌سازی نوتیف ساعتی" },
  { command: "help", description: "📖 راهنما" },
];

// ============================================================
//  cache
// ============================================================

const _cache = new Map();
const CACHE_TTL_MS = 30 * 1000;

function cacheGet(k) {
  const e = _cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { _cache.delete(k); return null; }
  return e.value;
}
function cacheSet(k, v) { _cache.set(k, { value: v, ts: Date.now() }); }

// ============================================================
//  ابزارها
// ============================================================

function jsonResponse(body, status = 200, cacheSeconds = DEFAULT_CACHE_SECONDS) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}`,
      "X-Powered-By": "Cloudflare Workers",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(msg, status = 500, detail = null) {
  return jsonResponse({ success: false, error: msg, detail, timestamp: new Date().toISOString() }, status);
}

function safeNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function toPersianNumber(num, fallback = "نامشخص") {
  const n = safeNumber(num);
  if (n === null) return fallback;
  try { return n.toLocaleString("fa-IR"); }
  catch { return String(n); }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function formatTime(u) {
  if (!u) return "—";
  const p = String(u).match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return p ? `${p[4]}:${p[5]}` : String(u);
}

function formatDate(u) {
  if (!u) return "—";
  const p = String(u).match(/(\d{4})-(\d{2})-(\d{2})/);
  return p ? `${p[1]}/${p[2]}/${p[3]}` : String(u);
}

function safeStr(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  try { return String(v); } catch { return fallback; }
}

// ============================================================
//  Rate Limiting
// ============================================================

async function isRateLimited(chatId, env) {
  if (!chatId) return false;
  const key = `${KV_RATE_PREFIX}${chatId}`;
  try {
    const count = parseInt((await env.RATE_KV.get(key)) || "0", 10);
    if (count >= RATE_LIMIT_MAX) return true;
    await env.RATE_KV.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
    return false;
  } catch { return false; }
}

// ============================================================
//  لایه داده
// ============================================================

async function fetchJsonSafe(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const bust = `_t=${Math.floor(Date.now() / 60000)}`;
    const urlWithBust = url + (url.includes("?") ? "&" : "?") + bust;

    const resp = await fetch(urlWithBust, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Nabz-Worker/15.7",
        "Accept": "application/json",
        "Cache-Control": "no-cache",
      },
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    const text = await resp.text();
    const trimmed = text.trimStart();

    if (trimmed.startsWith("<")) throw new Error(`HTML (${resp.status})`);
    if (trimmed.toLowerCase().startsWith("error")) throw new Error("Upstream error");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    try { return JSON.parse(text); } catch { throw new Error("Invalid JSON"); }
  } finally { clearTimeout(timer); }
}

async function fetchWithFallback(sources, validator, label) {
  const unique = [...new Set(sources.filter(Boolean))];
  const errors = [];
  for (const url of unique) {
    try {
      const data = await fetchJsonSafe(url);
      if (!validator(data)) throw new Error("Invalid structure");
      return { data, source: url };
    } catch (err) {
      errors.push(`${url.split("/")[2]}: ${err.message}`);
    }
  }
  throw new Error(`${label}: ${errors.join(" | ")}`);
}

async function fetchHistory(env) {
  const cached = cacheGet("history");
  if (cached) return cached;
  const result = await fetchWithFallback(
    [env.GITHUB_HISTORY_URL, ...HISTORY_SOURCES],
    (d) => d && d.latest && Array.isArray(d.history),
    "History"
  );
  const latest = result.data.latest;
  if (!latest.price && !latest.price_toman) throw new Error("No price");
  cacheSet("history", result);
  return result;
}

async function fetchMarket(env) {
  const cached = cacheGet("market");
  if (cached) return cached;
  const result = await fetchWithFallback(
    [env.GITHUB_MARKET_URL, ...MARKET_SOURCES],
    (d) => d && (d.usd || d.gold_18k),
    "Market"
  );
  cacheSet("market", result);
  return result;
}

function chartUrlFor(key) {
  const bust = Math.floor(Date.now() / 600000);
  return `${CHART_BASE_URLS[0]}/charts/${key}.png?v=${bust}`;
}

// ============================================================
//  GitHub Trigger
// ============================================================

async function triggerWorkflow(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const workflow = env.GITHUB_WORKFLOW;
  const branch = env.GITHUB_BRANCH || "main";

  if (!owner || !repo || !workflow) throw new Error("GITHUB config missing");

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
  console.log(`[trigger] ${owner}/${repo}/${workflow}@${branch}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "nabz-trigger-worker",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: branch }),
  });

  if (res.status !== 204 && res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 150)}`);
  }
  return { status: res.status, workflow, branch };
}

// ============================================================
//  پردازش داده
// ============================================================

function computeStats(history) {
  if (!history || history.length === 0) return null;
  const prices = history.map((x) => safeNumber(x.price || x.price_toman)).filter((p) => p !== null);
  if (prices.length === 0) return null;
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    total_days: history.length,
    first_date: history[0].date,
    last_date: history[history.length - 1].date,
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    avg_price: Math.round(sum / prices.length),
  };
}

function computeChange(history, daysAgo) {
  if (!history || history.length < daysAgo + 1) return null;
  const current = history[history.length - 1];
  const past = history[history.length - 1 - daysAgo];
  const cur = safeNumber(current.price || current.price_toman);
  const pst = safeNumber(past.price || past.price_toman);
  if (cur === null || pst === null || pst === 0) return null;
  const diff = cur - pst;
  const percent = ((diff / pst) * 100).toFixed(2);
  return {
    current: cur, past: pst, past_date: past.date,
    change: diff, change_percent: parseFloat(percent),
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

// ============================================================
//  مدیریت کاربران
// ============================================================

async function registerUser(chatId, env) {
  if (!chatId) return;
  const key = `${KV_USER_PREFIX}${chatId}`;
  try {
    const existing = await env.RATE_KV.get(key, "json");
    if (!existing) {
      await env.RATE_KV.put(key, JSON.stringify({
        chat_id: chatId, registered_at: Date.now(), notify_off: false,
      }), { expirationTtl: KV_USER_TTL });
      return;
    }
    await env.RATE_KV.put(key, JSON.stringify({ ...existing, last_seen: Date.now() }), { expirationTtl: KV_USER_TTL });
  } catch (err) { console.error(`[user] ${err.message}`); }
}

async function setNotifyOff(chatId, env) {
  if (!chatId) return;
  const key = `${KV_USER_PREFIX}${chatId}`;
  try {
    const user = (await env.RATE_KV.get(key, "json")) || { chat_id: chatId, registered_at: Date.now() };
    user.notify_off = true;
    user.notify_off_at = Date.now();
    await env.RATE_KV.put(key, JSON.stringify(user), { expirationTtl: KV_USER_TTL });
  } catch (err) { console.error(`[user] ${err.message}`); }
}

async function setNotifyOn(chatId, env) {
  if (!chatId) return;
  const key = `${KV_USER_PREFIX}${chatId}`;
  try {
    const user = (await env.RATE_KV.get(key, "json")) || { chat_id: chatId, registered_at: Date.now() };
    user.notify_off = false;
    user.notify_on_at = Date.now();
    await env.RATE_KV.put(key, JSON.stringify(user), { expirationTtl: KV_USER_TTL });
  } catch (err) { console.error(`[user] ${err.message}`); }
}

async function isNotifyEnabled(chatId, env) {
  if (!chatId) return false;
  try {
    const user = await env.RATE_KV.get(`${KV_USER_PREFIX}${chatId}`, "json");
    return user !== null && user.notify_off !== true;
  } catch { return false; }
}

async function getActiveUsers(env) {
  const users = [];
  let cursor = undefined;
  try {
    do {
      const list = await env.RATE_KV.list({ prefix: KV_USER_PREFIX, cursor });
      for (const key of list.keys) {
        const user = await env.RATE_KV.get(key.name, "json");
        if (user && user.chat_id && user.notify_off !== true) users.push(user.chat_id);
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
  } catch (err) { console.error(`[users] ${err.message}`); }
  return users;
}

// ============================================================
//  اشتراک زنده
// ============================================================

async function subscribeUser(chatId, messageId, price, env) {
  if (!chatId || !messageId) return;
  await env.RATE_KV.put(`${KV_SUB_PREFIX}${chatId}`,
    JSON.stringify({ chat_id: chatId, message_id: messageId, last_price: price, last_updated: Date.now() }),
    { expirationTtl: KV_SUB_TTL });
}

async function unsubscribeUser(chatId, env) {
  if (!chatId) return;
  await env.RATE_KV.delete(`${KV_SUB_PREFIX}${chatId}`);
}

async function isSubscribed(chatId, env) {
  if (!chatId) return false;
  try {
    const d = await env.RATE_KV.get(`${KV_SUB_PREFIX}${chatId}`, "json");
    return d !== null;
  } catch { return false; }
}

// ============================================================
//  هشدار قیمت
// ============================================================

async function setAlert(chatId, targetPrice, currentPrice, env) {
  if (!chatId || !targetPrice) return;
  await env.RATE_KV.put(`${KV_ALERT_PREFIX}${chatId}`, JSON.stringify({
    chat_id: chatId, target: targetPrice, created_price: currentPrice,
    created_at: Date.now(), triggered: false,
  }), { expirationTtl: KV_ALERT_TTL });
}

async function getAlert(chatId, env) {
  if (!chatId) return null;
  try { return await env.RATE_KV.get(`${KV_ALERT_PREFIX}${chatId}`, "json"); }
  catch { return null; }
}

async function removeAlert(chatId, env) {
  if (!chatId) return;
  await env.RATE_KV.delete(`${KV_ALERT_PREFIX}${chatId}`);
}

async function checkAlerts(env, currentPrice) {
  if (!currentPrice) return;
  let cursor = undefined;
  let checked = 0, triggered = 0;

  try {
    do {
      const list = await env.RATE_KV.list({ prefix: KV_ALERT_PREFIX, cursor });
      for (const key of list.keys) {
        const alert = await env.RATE_KV.get(key.name, "json");
        if (!alert || alert.triggered) continue;
        checked++;

        const crossed =
          (alert.target > alert.created_price && currentPrice >= alert.target) ||
          (alert.target < alert.created_price && currentPrice <= alert.target);

        if (crossed) {
          try {
            await sendMessage(alert.chat_id,
              `🚨 *هشدار قیمت دلار*\n━━━━━━━━━━━━━━━━━━━\n\n` +
              `💰 قیمت فعلی: *${toPersianNumber(currentPrice)}* تومان\n` +
              `🎯 هدف: *${toPersianNumber(alert.target)}* تومان\n\n` +
              `✅ به هدف رسید!\n⏱ ${new Date().toLocaleString("fa-IR")}${FOOTER}`,
              env);
            alert.triggered = true;
            alert.triggered_at = Date.now();
            await env.RATE_KV.put(key.name, JSON.stringify(alert), { expirationTtl: 60 * 60 * 24 * 7 });
            triggered++;
          } catch (err) { console.error(`[alert] ${err.message}`); }
        }
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    if (checked > 0) console.log(`[alert] Checked: ${checked}, Triggered: ${triggered}`);
  } catch (err) { console.error(`[alert] ${err.message}`); }
}

// ============================================================
//  Telegram API
// ============================================================

async function telegramAPI(method, body, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await resp.json();
    if (!result.ok) console.error(`[telegram] ${method}: ${result.description}`);
    return result;
  } catch (err) {
    console.error(`[telegram] ${method}: ${err.message}`);
    return { ok: false, description: err.message };
  }
}

async function sendMessage(chatId, text, env, options = {}) {
  if (!chatId) return { ok: false };
  return telegramAPI("sendMessage", {
    chat_id: chatId, text: safeStr(text, "—"),
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: true,
  }, env);
}

async function editMessage(chatId, messageId, text, env, options = {}) {
  if (!chatId || !messageId) return { ok: false };
  return telegramAPI("editMessageText", {
    chat_id: chatId, message_id: messageId, text: safeStr(text, "—"),
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: true,
  }, env);
}

async function editMessageMedia(chatId, messageId, photoUrl, caption, env, options = {}) {
  if (!chatId || !messageId || !photoUrl) return { ok: false };
  return telegramAPI("editMessageMedia", {
    chat_id: chatId, message_id: messageId,
    media: {
      type: "photo", media: photoUrl,
      caption: safeStr(caption, "—"),
      parse_mode: options.parseMode || "Markdown",
    },
    reply_markup: options.replyMarkup,
  }, env);
}

async function deleteMessage(chatId, messageId, env) {
  if (!chatId || !messageId) return { ok: false };
  return telegramAPI("deleteMessage", { chat_id: chatId, message_id: messageId }, env);
}

async function answerCallbackQuery(id, env, text = null) {
  if (!id) return { ok: false };
  return telegramAPI("answerCallbackQuery", {
    callback_query_id: id, text: text, show_alert: false,
  }, env);
}

async function sendPhoto(chatId, photoUrl, caption, env, options = {}) {
  if (!chatId) return { ok: false };

  const urlResult = await telegramAPI("sendPhoto", {
    chat_id: chatId, photo: photoUrl,
    caption: safeStr(caption, "—"),
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
  }, env);

  if (urlResult.ok) return urlResult;

  console.warn(`[sendPhoto] fallback to upload`);
  try {
    const imgResp = await fetch(photoUrl, {
      headers: { "User-Agent": "Nabz-Worker/15.7" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status}`);

    const imgBlob = await imgResp.blob();
    const filename = photoUrl.split("/").pop().split("?")[0] || "chart.png";

    const form = new FormData();
    form.append("chat_id", chatId.toString());
    form.append("photo", imgBlob, filename);
    if (caption) form.append("caption", safeStr(caption));
    form.append("parse_mode", options.parseMode || "Markdown");
    if (options.replyMarkup) form.append("reply_markup", JSON.stringify(options.replyMarkup));

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const resp = await fetch(url, { method: "POST", body: form });
    return await resp.json();
  } catch (err) {
    console.error(`[sendPhoto] ${err.message}`);
    return urlResult;
  }
}

// ============================================================
//  Keyboards
// ============================================================

const MAIN_MENU_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📊 همه قیمت‌ها", callback_data: "cmd:all" }],
    [
      { text: "💵 دلار + نمودار", callback_data: "cmd:price" },
      { text: "💶 یورو + نمودار", callback_data: "cmd:eur" },
    ],
    [
      { text: "🥇 طلا + نمودار", callback_data: "cmd:gold" },
      { text: "🪙 سکه + نمودار", callback_data: "cmd:coins" },
    ],
    [
      { text: "💱 ارزها", callback_data: "cmd:currencies" },
      { text: "🛢 نفت", callback_data: "cmd:oil" },
    ],
    [
      { text: "📊 تاریخچه", callback_data: "cmd:history" },
      { text: "📈 آمار", callback_data: "cmd:stats" },
    ],
    [
      { text: "📉 مقایسه", callback_data: "cmd:compare" },
      { text: "🔄 تبدیل", callback_data: "cmd:convert" },
    ],
    [
      { text: "🔔 هشدار قیمت", callback_data: "cmd:alert" },
      { text: "🔔 اشتراک زنده", callback_data: "cmd:subscribe" },
    ],
    [{ text: "🔕 لغو نوتیف ساعتی", callback_data: "cmd:notify_off" }],
  ],
};

const PRICE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "🔄 به‌روزرسانی", callback_data: "cmd:price" },
      { text: "📊 همه", callback_data: "cmd:all" },
    ],
    [
      { text: "🥇 طلا + نمودار", callback_data: "cmd:gold" },
      { text: "🪙 سکه + نمودار", callback_data: "cmd:coins" },
    ],
    [
      { text: "💶 یورو + نمودار", callback_data: "cmd:eur" },
      { text: "🛢 نفت", callback_data: "cmd:oil" },
    ],
    [
      { text: "🔔 هشدار", callback_data: "cmd:alert" },
      { text: "🔔 اشتراک زنده", callback_data: "cmd:subscribe" },
    ],
    [{ text: "🏠 منو", callback_data: "cmd:menu" }],
  ],
};

const BACK_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "💵 دلار", callback_data: "cmd:price" },
      { text: "🥇 طلا", callback_data: "cmd:gold" },
      { text: "🪙 سکه", callback_data: "cmd:coins" },
    ],
    [
      { text: "💶 یورو", callback_data: "cmd:eur" },
      { text: "📊 همه", callback_data: "cmd:all" },
    ],
    [{ text: "🏠 منوی اصلی", callback_data: "cmd:menu" }],
  ],
};

const NOTIFY_KEYBOARD = {
  inline_keyboard: [
    [{ text: "🔕 لغو نوتیف ساعتی", callback_data: "cmd:notify_off" }],
    [
      { text: "💵 دلار", callback_data: "cmd:price" },
      { text: "📊 همه", callback_data: "cmd:all" },
    ],
    [{ text: "🏠 منو", callback_data: "cmd:menu" }],
  ],
};

const NOTIFY_OFF_KEYBOARD = {
  inline_keyboard: [
    [{ text: "🔔 فعال‌سازی نوتیف ساعتی", callback_data: "cmd:notify_on" }],
    [
      { text: "💵 دلار", callback_data: "cmd:price" },
      { text: "📊 همه", callback_data: "cmd:all" },
    ],
    [{ text: "🏠 منوی اصلی", callback_data: "cmd:menu" }],
  ],
};

// ============================================================
//  Message Builders
// ============================================================

function changeWithHistory(ch) {
  if (!ch) return "_داده کافی نیست_\n";
  const arrow = ch.direction === "up" ? "🔺" : ch.direction === "down" ? "🔻" : "▪️";
  const sign = ch.change > 0 ? "+" : ch.change < 0 ? "−" : "";
  let line = `${arrow} \`${sign}${toPersianNumber(Math.abs(ch.change))}\` (${ch.change_percent}%)\n`;
  line += `     از \`${toPersianNumber(ch.past)}\` به \`${toPersianNumber(ch.current)}\`\n`;
  return line;
}

function buildPriceCaption(data, isNotify = false) {
  const ch24 = computeChange(data.history, 1);
  const ch7 = computeChange(data.history, 7);
  const ch30 = computeChange(data.history, 30);
  const price = data.latest?.price || data.latest?.price_toman;

  let msg = "";

  if (isNotify && ch24 && Math.abs(ch24.change) >= ALERT_CHANGE_THRESHOLD) {
    if (ch24.direction === "up") msg += `🚨 *افزایش شدید قیمت!*\n\n`;
    else if (ch24.direction === "down") msg += `⚠️ *کاهش شدید قیمت!*\n\n`;
  }

  msg += `💵 *دلار آمریکا*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `💰 *${toPersianNumber(price)}* تومان\n\n`;
  msg += `📊 *تغییرات*\n`;
  msg += `• ۲۴ ساعت: ${changeWithHistory(ch24)}`;
  msg += `• ۷ روز: ${changeWithHistory(ch7)}`;
  msg += `• ۳۰ روز: ${changeWithHistory(ch30)}\n`;
  msg += `⏱ ${formatTime(data.updated_at)}  •  📅 ${formatDate(data.updated_at)}`;
  msg += FOOTER;
  return msg;
}

function buildAllCaption(m) {
  const categories = {
    major: { title: "💵 ارزهای شاخص", keys: ["usd","eur","aed","try","gbp","cad","aud","cny"] },
    gold: { title: "🥇 طلا و سکه", keys: ["gold_18k","gold_mesghal","usd_xau","coin_emami","coin_bahar","coin_half","coin_quarter","coin_gram"] },
    energy: { title: "🛢 انرژی", keys: ["oil"] },
  };

  let msg = `📊 *نبض بازار*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const cat of Object.values(categories)) {
    msg += `*${cat.title}*\n`;
    for (const key of cat.keys) {
      const info = ASSETS[key];
      if (!info) continue;
      const val = m[key];
      if (val === null || val === undefined) continue;
      const unit = info.unit === "دلار" ? "دلار" : "تومان";
      msg += `• ${info.title}: *${toPersianNumber(val)}* ${unit}\n`;
    }
    msg += `\n`;
  }
  msg += `⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `  •  📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildAssetCaption(key, m) {
  const info = ASSETS[key];
  if (!info) return `قیمت: —` + FOOTER;
  const val = m[key];
  const unit = info.unit === "دلار" ? "دلار" : "تومان";

  let msg = `${info.icon} *${info.title}*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `💰 *${toPersianNumber(val)}* ${unit}\n\n`;
  msg += `⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `\n📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildCoinsCaption(m) {
  let msg = `🪙 *سکه‌ها*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  const keys = ["coin_emami","coin_bahar","coin_half","coin_quarter","coin_gram"];
  for (const key of keys) {
    const info = ASSETS[key];
    if (!info) continue;
    const v = m[key];
    if (v === null || v === undefined) continue;
    msg += `• ${info.title}: *${toPersianNumber(v)}* تومان\n`;
  }
  msg += `\n⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `\n📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildGoldCaption(m) {
  let msg = `🥇 *طلا*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  if (m.gold_18k) msg += `• طلای ۱۸ عیار: *${toPersianNumber(m.gold_18k)}* تومان\n`;
  if (m.gold_mesghal) msg += `• مثقال: *${toPersianNumber(m.gold_mesghal)}* تومان\n`;
  if (m.usd_xau) msg += `• انس جهانی: *${m.usd_xau}* دلار\n`;
  msg += `\n⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `\n📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildCurrenciesCaption(m) {
  let msg = `💱 *همه ارزها*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  const keys = ["usd","eur","aed","try","gbp","cad","aud","cny","rub","iqd","jpy","sar","kwd","omr","chf","sek","nok","dkk","sgd","hkd"];
  for (const key of keys) {
    const info = ASSETS[key];
    if (!info) continue;
    const v = m[key];
    if (v === null || v === undefined) continue;
    msg += `• ${info.title}: *${toPersianNumber(v)}*\n`;
  }
  msg += `\n⏱ ${m.updated_at || "—"}`;
  msg += FOOTER;
  return msg;
}

function buildOilCaption(m) {
  let msg = `🛢 *نفت خام*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `💰 *${m.oil || "—"}* دلار\n\n⏱ ${m.updated_at || "—"}`;
  msg += FOOTER;
  return msg;
}

function buildHistoryMessage(data, days = 7) {
  const history = data.history.slice(-days);
  const prices = history.map((h) => safeNumber(h.price || h.price_toman)).filter((p) => p !== null);
  if (prices.length === 0) return `📊 *تاریخچه*\n\n_داده‌ای موجود نیست._` + FOOTER;

  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  let msg = `📊 *تاریخچه ${toPersianNumber(days)} روز دلار*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  history.forEach((item) => {
    const v = safeNumber(item.price || item.price_toman);
    if (v === null) return;
    const ratio = (v - minP) / range;
    const bars = Math.round(ratio * 8);
    const visual = "▰".repeat(bars + 1) + "▱".repeat(Math.max(0, 8 - bars));
    msg += `\`${item.date.slice(5)}\` ${visual} *${toPersianNumber(v)}*\n`;
  });
  msg += `\n⏱ ${data.updated_at}`;
  msg += FOOTER;
  return msg;
}

function buildStatsMessage(data) {
  const stats = computeStats(data.history);
  if (!stats) return `📈 *آمار*\n\n_داده‌ای موجود نیست._` + FOOTER;

  let msg = `📈 *آمار کلی دلار*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `• 🔻 کمینه: *${toPersianNumber(stats.min_price)}*\n`;
  msg += `• 🔺 بیشینه: *${toPersianNumber(stats.max_price)}*\n`;
  msg += `• 📊 میانگین: *${toPersianNumber(stats.avg_price)}*\n\n`;
  msg += `📅 تعداد روز: *${toPersianNumber(stats.total_days)}*\n`;
  msg += `🗓 از \`${stats.first_date}\` تا \`${stats.last_date}\``;
  msg += FOOTER;
  return msg;
}

function buildCompareMessage(data, days = 30) {
  const comparison = computeChange(data.history, days);
  if (!comparison) return `📊 *مقایسه*\n\n_داده کافی نیست._` + FOOTER;
  const arrow = comparison.direction === "up" ? "🔺" : comparison.direction === "down" ? "🔻" : "▪️";
  const sign = comparison.change > 0 ? "+" : comparison.change < 0 ? "−" : "";

  let msg = `📊 *مقایسه ${toPersianNumber(days)} روزه دلار*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `• امروز: *${toPersianNumber(comparison.current)}*\n`;
  msg += `• ${comparison.past_date}: *${toPersianNumber(comparison.past)}*\n\n`;
  msg += `${arrow} تغییر: *${sign}${toPersianNumber(Math.abs(comparison.change))}* (${comparison.change_percent}%)`;
  msg += FOOTER;
  return msg;
}

function buildMenuMessage(subscribed, notifyEnabled, alertInfo) {
  let msg = `🏠 *منوی اصلی*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `سلام! 👋\nمن بات *نبض بازار* هستم.\n\n`;
  msg += `📋 *قابلیت‌ها*\n`;
  msg += `• 📊 همه قیمت‌ها\n• 💵 دلار + نمودار\n• 🥇 طلا + نمودار\n`;
  msg += `• 🪙 سکه + نمودار\n• 💱 همه ارزها\n• 🔔 هشدار قیمت\n\n`;
  msg += `🔔 *وضعیت‌ها:*\n`;
  msg += `• نوتیف ساعتی: ${notifyEnabled ? "✅ فعال" : "🔕 غیرفعال"}\n`;
  msg += `• اشتراک زنده دلار: ${subscribed ? "✅ فعال" : "❌ غیرفعال"}\n`;
  if (alertInfo && !alertInfo.triggered) {
    msg += `• هشدار قیمت: *${toPersianNumber(alertInfo.target)}* تومان 🎯\n`;
  } else {
    msg += `• هشدار قیمت: تنظیم نشده\n`;
  }
  msg += FOOTER;
  return msg;
}

// ============================================================
//  توابع کمکی
// ============================================================

async function updateMessage(chatId, env, options, assetKey, caption) {
  const photoUrl = chartUrlFor(assetKey);
  const replyMarkup = options.replyMarkup;

  if (options.editMessageId) {
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }

  const photoResult = await sendPhoto(chatId, photoUrl, caption, env, { replyMarkup });
  if (photoResult.ok) return photoResult;

  return sendMessage(chatId, caption, env, { replyMarkup });
}

async function updateTextMessage(chatId, env, options, text, replyMarkup) {
  if (options.editMessageId) {
    if (!options.wasPhoto) {
      const r = await editMessage(chatId, options.editMessageId, text, env, { replyMarkup });
      if (r.ok) return r;
    }
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }
  return sendMessage(chatId, text, env, { replyMarkup });
}

// ============================================================
//  Handlers
// ============================================================

async function respondWithRate(chatId, env, options = {}) {
  try {
    const { data } = await fetchHistory(env);
    const caption = buildPriceCaption(data, false);
    const price = data.latest?.price || data.latest?.price_toman;
    const replyMarkup = options.replyMarkup || PRICE_KEYBOARD;
    const result = await updateMessage(chatId, env, { ...options, replyMarkup }, "usd", caption);
    if (options.subscribe && result.ok && result.result?.message_id) {
      await subscribeUser(chatId, result.result.message_id, price, env);
    }
    return result;
  } catch (err) {
    console.error(`[rate] ${err.message}`);
    return sendMessage(chatId, `❌ خطا در دریافت قیمت دلار.${FOOTER}`, env);
  }
}

async function respondWithAsset(chatId, env, assetKey, options = {}) {
  try {
    const { data } = await fetchMarket(env);
    const caption = buildAssetCaption(assetKey, data);
    return updateMessage(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, assetKey, caption);
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithAll(chatId, env, options = {}) {
  try {
    const { data } = await fetchMarket(env);
    return updateMessage(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "usd", buildAllCaption(data));
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithCoins(chatId, env, options = {}) {
  try {
    const { data } = await fetchMarket(env);
    return updateMessage(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "coin_emami", buildCoinsCaption(data));
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithGold(chatId, env, options = {}) {
  try {
    const { data } = await fetchMarket(env);
    return updateMessage(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "gold_18k", buildGoldCaption(data));
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithCurrencies(chatId, env, options = {}) {
  try {
    const { data } = await fetchMarket(env);
    return updateMessage(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "eur", buildCurrenciesCaption(data));
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithOil(chatId, env, options = {}) {
  try {
    const { data } = await fetchMarket(env);
    return updateTextMessage(chatId, env, options, buildOilCaption(data), BACK_KEYBOARD);
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithHistory(chatId, env, days = 7, options = {}) {
  try {
    const { data } = await fetchHistory(env);
    return updateTextMessage(chatId, env, options, buildHistoryMessage(data, days), BACK_KEYBOARD);
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithStats(chatId, env, options = {}) {
  try {
    const { data } = await fetchHistory(env);
    return updateTextMessage(chatId, env, options, buildStatsMessage(data), BACK_KEYBOARD);
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithCompare(chatId, env, days = 30, options = {}) {
  try {
    const { data } = await fetchHistory(env);
    return updateTextMessage(chatId, env, options, buildCompareMessage(data, days), BACK_KEYBOARD);
  } catch (err) {
    return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
  }
}

async function respondWithMenu(chatId, env, options = {}) {
  try {
    const subscribed = await isSubscribed(chatId, env);
    const notifyEnabled = await isNotifyEnabled(chatId, env);
    const alertInfo = await getAlert(chatId, env);
    return updateTextMessage(chatId, env, options, buildMenuMessage(subscribed, notifyEnabled, alertInfo), MAIN_MENU_KEYBOARD);
  } catch (err) {
    return sendMessage(chatId, `🏠 منو\n\n/price /gold /coins /all${FOOTER}`, env, { replyMarkup: MAIN_MENU_KEYBOARD });
  }
}

async function respondWithAlertHelp(chatId, env, options = {}) {
  const alertInfo = await getAlert(chatId, env);
  let msg = `🔔 *هشدار قیمت دلخواه*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  if (alertInfo && !alertInfo.triggered) {
    msg += `✅ *هشدار فعال*\n🎯 هدف: *${toPersianNumber(alertInfo.target)}* تومان\n\n💡 لغو: \`/alert_off\``;
  } else {
    msg += `هنوز هشداری تنظیم نکردی.\n\n📝 *نحوه استفاده:*\n\`/alert 300000\`\n\nیعنی وقتی دلار به *۳۰۰٬۰۰۰* تومان رسید، خبرت می‌کنم.`;
  }
  msg += FOOTER;
  return updateTextMessage(chatId, env, options, msg, BACK_KEYBOARD);
}

// ============================================================
//  پردازش دستورات
// ============================================================

async function handleBotCommand(message, env, ctx) {
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;
  const text = safeStr(message?.text, "").trim();

  if (!chatId) return;

  console.log(`[bot] "${text}" from ${chatId}`);

  if (messageId) {
    ctx.waitUntil((async () => {
      await sleep(2000);
      await deleteMessage(chatId, messageId, env).catch(() => {});
    })());
  }

  if (text !== "/subscribe" && text !== "/unsubscribe") {
    const limited = await isRateLimited(chatId, env);
    if (limited) {
      ctx.waitUntil((async () => {
        const r = await sendMessage(chatId, `⏳ *لطفاً صبر کنید*\n\nتعداد درخواست‌های شما زیاد است.${FOOTER}`, env);
        if (r.ok && r.result?.message_id) {
          await sleep(3000);
          await deleteMessage(chatId, r.result.message_id, env).catch(() => {});
        }
      })());
      return;
    }
  }

  try {
    await registerUser(chatId, env);

    if (text === "/start" || text === "/menu") return respondWithMenu(chatId, env);
    if (text === "/help") {
      let msg = `📖 *راهنما*\n━━━━━━━━━━━━━━━━━━━\n\n`;
      BOT_COMMANDS.forEach((c) => { msg += `/${c.command} — ${c.description}\n`; });
      msg += FOOTER;
      return sendMessage(chatId, msg, env, { replyMarkup: MAIN_MENU_KEYBOARD });
    }

    if (text === "/all" || text === "/market") return respondWithAll(chatId, env);
    if (text === "/price" || text === "/usd") return respondWithRate(chatId, env);
    if (text === "/eur") return respondWithAsset(chatId, env, "eur");
    if (text === "/gold") return respondWithGold(chatId, env);
    if (text === "/coins") return respondWithCoins(chatId, env);
    if (text === "/currencies") return respondWithCurrencies(chatId, env);
    if (text === "/oil") return respondWithOil(chatId, env);
    if (text === "/history") return respondWithHistory(chatId, env, 7);
    if (text === "/stats") return respondWithStats(chatId, env);
    if (text === "/compare") return respondWithCompare(chatId, env, 30);
    if (text === "/alert") return respondWithAlertHelp(chatId, env);

    if (text.startsWith("/alert ")) {
      const arg = text.replace("/alert", "").trim();
      const target = parseFloat(arg.replace(/,/g, "").replace(/٬/g, ""));
      if (isNaN(target) || target <= 0) {
        return sendMessage(chatId, `❌ عدد نامعتبر.\n\nمثال: \`/alert 300000\`${FOOTER}`, env, { replyMarkup: BACK_KEYBOARD });
      }
      try {
        const { data } = await fetchHistory(env);
        const currentPrice = data.latest?.price || data.latest?.price_toman;
        if (!currentPrice) throw new Error("no price");
        await setAlert(chatId, target, currentPrice, env);
        const direction = target > currentPrice ? "بالاتر" : "پایین‌تر";
        return sendMessage(chatId,
          `✅ *هشدار قیمت فعال شد*\n━━━━━━━━━━━━━━━━━━━\n\n` +
          `💰 قیمت فعلی: *${toPersianNumber(currentPrice)}* تومان\n` +
          `🎯 هدف: *${toPersianNumber(target)}* تومان (${direction})\n\n` +
          `🔕 لغو: /alert\\_off${FOOTER}`,
          env, { replyMarkup: BACK_KEYBOARD });
      } catch (err) {
        return sendMessage(chatId, `❌ خطا.${FOOTER}`, env);
      }
    }

    if (text === "/alert_off") {
      await removeAlert(chatId, env);
      return sendMessage(chatId, `🔕 *هشدار قیمت لغو شد*.${FOOTER}`, env, { replyMarkup: MAIN_MENU_KEYBOARD });
    }

    if (text === "/subscribe") {
      const msg = await respondWithRate(chatId, env, { subscribe: true });
      if (msg.ok) {
        await sendMessage(chatId,
          `✅ *اشتراک زنده فعال شد*\n\nقیمت دلار هر ۳۰ دقیقه ویرایش می‌شود.\n\n🔕 لغو: /unsubscribe${FOOTER}`,
          env);
      }
      return msg;
    }

    if (text === "/unsubscribe") {
      await unsubscribeUser(chatId, env);
      return sendMessage(chatId, `🔕 *اشتراک غیرفعال شد*.${FOOTER}`, env, { replyMarkup: MAIN_MENU_KEYBOARD });
    }

    if (text === "/notify_off") {
      await setNotifyOff(chatId, env);
      return sendMessage(chatId, `🔕 *نوتیف ساعتی لغو شد*.\n\n💡 فعال‌سازی: /notify\\_on${FOOTER}`, env, { replyMarkup: NOTIFY_OFF_KEYBOARD });
    }

    if (text === "/notify_on") {
      await setNotifyOn(chatId, env);
      return sendMessage(chatId, `🔔 *نوتیف ساعتی فعال شد*.${FOOTER}`, env, { replyMarkup: MAIN_MENU_KEYBOARD });
    }

    if (text.startsWith("/convert")) {
      const arg = text.replace("/convert", "").trim();
      const amount = parseFloat(arg);
      if (isNaN(amount) || amount <= 0) {
        return sendMessage(chatId, `🔄 *تبدیل*\n\nمثال: \`/convert 100\`${FOOTER}`, env, { replyMarkup: BACK_KEYBOARD });
      }
      const { data } = await fetchHistory(env);
      const rate = safeNumber(data.latest?.price || data.latest?.price_toman);
      if (rate === null) return sendMessage(chatId, `❌ نرخ در دسترس نیست.${FOOTER}`, env);
      const toman = Math.round(amount * rate);
      return sendMessage(chatId,
        `🔄 *تبدیل*\n━━━━━━━━━━━━━━━━━━━\n\n💵 *${toPersianNumber(amount)}* دلار\n       ⬇️\n💰 *${toPersianNumber(toman)}* تومان\n\n📌 نرخ: \`${toPersianNumber(rate)}\`${FOOTER}`,
        env, { replyMarkup: BACK_KEYBOARD });
    }

    return sendMessage(chatId, `❓ *دستور نامعتبر*\n\n/menu${FOOTER}`, env, { replyMarkup: MAIN_MENU_KEYBOARD });
  } catch (err) {
    console.error(`[bot] ${err?.message || err}`);
    try { await sendMessage(chatId, `❌ خطا.${FOOTER}`, env); } catch {}
  }
}

async function handleCallbackQuery(cb, env, ctx) {
  const chatId = cb?.message?.chat?.id;
  const messageId = cb?.message?.message_id;
  const isPhoto = !!(cb?.message?.photo);
  const data = safeStr(cb?.data, "");

  if (!chatId || !messageId) return;

  console.log(`[callback] "${data}" chat=${chatId}`);

  const limited = await isRateLimited(chatId, env);
  if (limited) {
    ctx.waitUntil(answerCallbackQuery(cb.id, env, "⏳ لطفاً صبر کنید..."));
    return;
  }

  ctx.waitUntil(answerCallbackQuery(cb.id, env));

  try {
    await registerUser(chatId, env);
    if (!data.startsWith("cmd:")) return;
    const action = data.slice(4);
    const opts = { editMessageId: messageId, wasPhoto: isPhoto };

    switch (action) {
      case "menu": return respondWithMenu(chatId, env, opts);
      case "all": return respondWithAll(chatId, env, opts);
      case "price": return respondWithRate(chatId, env, opts);
      case "eur": return respondWithAsset(chatId, env, "eur", opts);
      case "gold": return respondWithGold(chatId, env, opts);
      case "coins": return respondWithCoins(chatId, env, opts);
      case "currencies": return respondWithCurrencies(chatId, env, opts);
      case "oil": return respondWithOil(chatId, env, opts);
      case "history": return respondWithHistory(chatId, env, 7, opts);
      case "stats": return respondWithStats(chatId, env, opts);
      case "compare": return respondWithCompare(chatId, env, 30, opts);
      case "alert": return respondWithAlertHelp(chatId, env, opts);
      case "subscribe":
        await unsubscribeUser(chatId, env);
        return respondWithRate(chatId, env, { ...opts, subscribe: true });
      case "notify_off":
        await setNotifyOff(chatId, env);
        return updateTextMessage(chatId, env, opts,
          `🔕 *نوتیف ساعتی لغو شد*\n\n💡 فعال‌سازی: دکمه زیر.${FOOTER}`, NOTIFY_OFF_KEYBOARD);
      case "notify_on":
        await setNotifyOn(chatId, env);
        return updateTextMessage(chatId, env, opts,
          `🔔 *نوتیف ساعتی فعال شد*.${FOOTER}`, MAIN_MENU_KEYBOARD);
      case "convert":
        return updateTextMessage(chatId, env, opts,
          `🔄 *تبدیل*\n\n\`/convert <عدد>\`\n\nمثال: \`/convert 100\`${FOOTER}`, BACK_KEYBOARD);
      default: return;
    }
  } catch (err) {
    console.error(`[callback] ${err?.message || err}`);
    try { await sendMessage(chatId, `❌ خطا.${FOOTER}`, env); } catch {}
  }
}

// ============================================================
//  Webhook
// ============================================================

async function handleWebhook(request, env, ctx) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const update = await request.json();
    if (update?.message?.text) ctx.waitUntil(handleBotCommand(update.message, env, ctx));
    if (update?.callback_query) ctx.waitUntil(handleCallbackQuery(update.callback_query, env, ctx));
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`[webhook] ${err.message}`);
    return new Response("Error", { status: 500 });
  }
}

// ============================================================
//  Cron
// ============================================================

async function sendHourlyNotification(env) {
  console.log(`[notify] Starting...`);
  const startTime = Date.now();

  try {
    const { data } = await fetchHistory(env);
    const price = data.latest?.price || data.latest?.price_toman;
    if (!price) return;

    const users = await getActiveUsers(env);
    console.log(`[notify] ${users.length} users`);
    if (users.length === 0) return;

    const caption = buildPriceCaption(data, true);
    const photoUrl = chartUrlFor("usd");

    let sent = 0, deleted = 0, failed = 0, first_time = 0;

    for (let i = 0; i < users.length; i++) {
      if (Date.now() - startTime > NOTIFY_TIMEOUT_MS) {
        console.warn(`[notify] Timeout at ${i}/${users.length}`);
        break;
      }

      const chatId = users[i];
      const lastKey = `${KV_NOTIFY_MSG_PREFIX}${chatId}`;

      try {
        const lastMsgIdStr = await env.RATE_KV.get(lastKey);
        if (lastMsgIdStr) {
          const lastMsgId = parseInt(lastMsgIdStr, 10);
          if (!isNaN(lastMsgId)) {
            const delResult = await deleteMessage(chatId, lastMsgId, env);
            if (delResult.ok) deleted++;
          }
        } else first_time++;

        const result = await sendPhoto(chatId, photoUrl, caption, env, { replyMarkup: NOTIFY_KEYBOARD });

        if (result.ok && result.result?.message_id) {
          await env.RATE_KV.put(lastKey, String(result.result.message_id), { expirationTtl: KV_NOTIFY_MSG_TTL });
          sent++;
        } else {
          const desc = result.description || "";
          if (desc.includes("blocked") || desc.includes("not found") || desc.includes("deactivated")) {
            await env.RATE_KV.delete(`${KV_USER_PREFIX}${chatId}`);
            await env.RATE_KV.delete(lastKey);
          }
          failed++;
        }
      } catch (err) { failed++; }

      if (i > 0 && i % NOTIFY_BATCH_SIZE === 0) await sleep(1000);
      else await sleep(50);
    }

    console.log(`[notify] Done in ${Date.now() - startTime}ms. Sent: ${sent}, Deleted: ${deleted}, Failed: ${failed}`);
  } catch (err) { console.error(`[notify] ${err.message}`); }
}

async function updateSubscribers(env) {
  try {
    const { data } = await fetchHistory(env);
    const newPrice = data.latest?.price || data.latest?.price_toman;

    const list = await env.RATE_KV.list({ prefix: KV_SUB_PREFIX });
    if (list.keys.length === 0) return;

    let edited = 0, deleted = 0, skipped = 0;
    const caption = buildPriceCaption(data, false);
    const photoUrl = chartUrlFor("usd");

    for (const key of list.keys) {
      const sub = await env.RATE_KV.get(key.name, "json");
      if (!sub) continue;
      if (sub.last_price === newPrice) { skipped++; continue; }

      try {
        let result = await editMessageMedia(sub.chat_id, sub.message_id, photoUrl, caption, env, { replyMarkup: PRICE_KEYBOARD });
        if (!result.ok && (result.description?.includes("no caption") || result.description?.includes("not a photo"))) {
          result = await editMessage(sub.chat_id, sub.message_id, caption, env, { replyMarkup: PRICE_KEYBOARD });
        }
        if (result.ok) {
          await env.RATE_KV.put(key.name, JSON.stringify({ ...sub, last_price: newPrice, last_updated: Date.now() }), { expirationTtl: KV_SUB_TTL });
          edited++;
        } else {
          const desc = result.description || "";
          if (desc.includes("blocked") || desc.includes("not found") || desc.includes("chat not found") || desc.includes("deactivated")) {
            await env.RATE_KV.delete(key.name);
            await env.RATE_KV.delete(`${KV_USER_PREFIX}${sub.chat_id}`);
            deleted++;
          }
        }
      } catch (err) {}
      await sleep(50);
    }
    console.log(`[subs] Edited: ${edited}, Deleted: ${deleted}, Skipped: ${skipped}`);
  } catch (err) {}
}

async function handleScheduled(controller, env, ctx) {
  console.log(`[cron] ${controller.cron}`);
  if (!env.RATE_KV) return;

  const currentMinute = new Date().getUTCMinutes();
  console.log(`[cron] minute: ${currentMinute}`);

  if (currentMinute === 7 || currentMinute === 37) {
    try { await triggerWorkflow(env); }
    catch (err) { console.error(`[cron] Trigger: ${err.message}`); }
  }

  try {
    const { data } = await fetchHistory(env);
    const currentPrice = data.latest?.price || data.latest?.price_toman;
    await checkAlerts(env, currentPrice);
  } catch (err) {}

  if (currentMinute === 7) {
    const lastNotify = parseInt((await env.RATE_KV.get(KV_LAST_NOTIFY_TIME)) || "0", 10);
    const minutesSinceLast = (Date.now() - lastNotify) / 60000;
    if (minutesSinceLast >= 55) {
      await sendHourlyNotification(env);
      await env.RATE_KV.put(KV_LAST_NOTIFY_TIME, String(Date.now()));
    }
  }

  await updateSubscribers(env);
}

// ============================================================
//  Admin Stats
// ============================================================

async function handleAdminStats(env) {
  try {
    const users = await getActiveUsers(env);
    const subsList = await env.RATE_KV.list({ prefix: KV_SUB_PREFIX });
    const allUsersList = await env.RATE_KV.list({ prefix: KV_USER_PREFIX });
    const alertsList = await env.RATE_KV.list({ prefix: KV_ALERT_PREFIX });

    let activeAlerts = 0, triggeredAlerts = 0;
    for (const key of alertsList.keys) {
      const a = await env.RATE_KV.get(key.name, "json");
      if (a) {
        if (a.triggered) triggeredAlerts++;
        else activeAlerts++;
      }
    }

    const notifyList = await env.RATE_KV.list({ prefix: KV_NOTIFY_MSG_PREFIX });

    return jsonResponse({
      success: true,
      version: "15.7",
      users: {
        total: allUsersList.keys.length,
        active_notify: users.length,
        inactive_notify: allUsersList.keys.length - users.length,
      },
      subscribers: subsList.keys.length,
      alerts: { total: alertsList.keys.length, active: activeAlerts, triggered: triggeredAlerts },
      notify_messages: notifyList.keys.length,
      last_notify_time: await env.RATE_KV.get(KV_LAST_NOTIFY_TIME),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse("Stats failed", 500, err.message);
  }
}

// ============================================================
//  UI — ریدایرکت به GitHub Pages
// ============================================================

async function handleUI() {
  return Response.redirect(GITHUB_PAGES_URL, 301);
}

// ============================================================
//  API Endpoints
// ============================================================

async function handleSetup(env) {
  const result = await telegramAPI("setMyCommands", { commands: BOT_COMMANDS }, env);
  return jsonResponse({ success: result.ok, commands: BOT_COMMANDS, telegram_response: result });
}

async function handleRoot() {
  return jsonResponse({
    name: "Nabz-e Bazaar Bot API",
    version: "15.7",
    source: "NodeOOF/usd",
    ui: GITHUB_PAGES_URL,
    endpoints: {
      "GET /rate": "دلار + تغییرات",
      "GET /market": "همه ۴۷ دارایی",
      "GET /history?days=N": "تاریخچه دلار",
      "GET /stats": "آمار",
      "GET /compare?days=N": "مقایسه",
      "GET /health": "سلامت",
      "GET /ui": "ریدایرکت به داشبورد",
      "GET /trigger": "Trigger GitHub Action",
      "GET /admin/stats": "آمار admin",
      "POST /webhook": "وبهوک تلگرام",
    },
  });
}

async function handleRate(env) {
  const { data } = await fetchHistory(env);
  const price = data.latest.price || data.latest.price_toman;
  return jsonResponse({
    success: true,
    price_toman: price,
    date: data.latest.date,
    updated_at: data.updated_at,
    changes: {
      h24: computeChange(data.history, 1),
      d7: computeChange(data.history, 7),
      d30: computeChange(data.history, 30),
    },
  });
}

async function handleMarket(env) {
  const { data } = await fetchMarket(env);
  return jsonResponse({ success: true, ...data });
}

async function handleHistory(env, url) {
  const { data } = await fetchHistory(env);
  const daysParam = url.searchParams.get("days");
  let history = data.history || [];
  if (daysParam) {
    const days = parseInt(daysParam, 10);
    if (isNaN(days) || days < 1 || days > 5000) return errorResponse("Invalid days", 400);
    history = history.slice(-days);
  }
  return jsonResponse({ success: true, total: history.length, updated_at: data.updated_at, history });
}

async function handleStats(env) {
  const { data } = await fetchHistory(env);
  const stats = computeStats(data.history);
  if (!stats) return errorResponse("No history", 502);
  return jsonResponse({ success: true, ...stats, updated_at: data.updated_at });
}

async function handleCompare(env, url) {
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const { data } = await fetchHistory(env);
  const comparison = computeChange(data.history, days);
  if (!comparison) return errorResponse("Not enough history", 400);
  return jsonResponse({ success: true, days, ...comparison, updated_at: data.updated_at });
}

async function handleHealth(env) {
  try {
    const { data, source } = await fetchHistory(env);
    const users = await getActiveUsers(env).catch(() => []);
    return jsonResponse({
      status: "healthy",
      version: "15.7",
      source,
      ui: GITHUB_PAGES_URL,
      updated_at: data.updated_at,
      active_users: users.length,
      trigger_configured: !!(env.GITHUB_OWNER && env.GITHUB_REPO && env.GITHUB_WORKFLOW && env.GITHUB_TOKEN),
    });
  } catch (err) {
    return jsonResponse({ status: "unhealthy", error: err.message }, 503);
  }
}

async function handleTrigger(env) {
  try {
    const result = await triggerWorkflow(env);
    return jsonResponse({ success: true, message: "✅ Workflow triggered", ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    return errorResponse("Trigger failed", 500, err.message);
  }
}

// ============================================================
//  Router
// ============================================================

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === "/webhook" && method === "POST") return handleWebhook(request, env, ctx);
  if (path === "/setup") return handleSetup(env);
  if (path === "/trigger") return handleTrigger(env);
  if (path === "/admin/stats") return handleAdminStats(env);
  if (method !== "GET") return errorResponse("Method not allowed", 405);

  switch (path) {
    case "/": case "": return handleRoot();
    case "/rate": return handleRate(env);
    case "/market": return handleMarket(env);
    case "/history": return handleHistory(env, url);
    case "/stats": return handleStats(env);
    case "/compare": return handleCompare(env, url);
    case "/health": return handleHealth(env);
    case "/ui": return handleUI();
    default: return errorResponse("Not found", 404, { path });
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    try { return await route(request, env, ctx); }
    catch (err) { console.error(`[fatal] ${err.message}`); return errorResponse("Server error", 500, err.message); }
  },
  async scheduled(controller, env, ctx) { return handleScheduled(controller, env, ctx); },
};
