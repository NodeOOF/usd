// ============================================================
//  Cloudflare Worker — Nabz-e Bazaar Bot + GitHub Trigger
//  نسخه: 14.2
//  منبع داده: NodeOOF/nabz (fork)
//
//  قابلیت‌ها:
//    - ۴۷ دارایی (ارز، طلا، سکه، نفت)
//    - editMessageMedia برای ویرایش عکس + caption
//    - نوتیف ساعتی برای همه کاربران (پیش‌فرض فعال)
//    - لغو/فعال‌سازی نوتیف با یک دکمه
//    - حذف خودکار نوتیف بعد از ۵ دقیقه
//    - اشتراک زنده دلار (ویرایش پیام هر ۳۰ دقیقه)
//    - ⭐ Trigger GitHub Action برای scraping
//    - cache buster برای داده‌های تازه
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

// ⭐ منبع داده: fork خودت (NodeOOF/USD)
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
  "https://cdn.jsdelivr.net/gh/NodeOOF/usd@main",
  "https://raw.githubusercontent.com/NodeOOF/usd/main",
];

const FOOTER = "\n\n━━━━━━━━━━━━━━━━━━━\n🌐 github.com/NodeOOF\n🤖 @dolarazad\\_bot";

const DEFAULT_CACHE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 10000;

// KV keys
const KV_SUB_PREFIX = "sub:";
const KV_USER_PREFIX = "user:";
const KV_NOTIFY_PENDING = "notify:pending";
const KV_LAST_NOTIFY_TIME = "notify:last_time";

// TTL
const KV_SUB_TTL = 60 * 60 * 24 * 7;
const KV_USER_TTL = 60 * 60 * 24 * 30;
const KV_PENDING_TTL = 60 * 60;

// نوتیف
const NOTIFY_DELETE_AFTER_MINUTES = 5;
const NOTIFY_INTERVAL_MINUTES = 60;
const NOTIFY_BATCH_SIZE = 20;

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
  gold_mesghal: { title: "مثقال طلا (آبشده)", icon: "⚖️", unit: "تومان", category: "gold" },
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
  afn: { title: "افغانی افغانستان", icon: "🇦🇫", unit: "تومان", category: "fiat" },
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
  { command: "subscribe", description: "🔔 اشتراک زنده دلار" },
  { command: "unsubscribe", description: "🔕 لغو اشتراک زنده" },
  { command: "notify_off", description: "🔕 لغو نوتیف ساعتی" },
  { command: "notify_on", description: "🔔 فعال‌سازی نوتیف ساعتی" },
  { command: "help", description: "📖 راهنما" },
];

// ============================================================
//  بخش ۲: cache
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
//  بخش ۳: ابزارها
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
  return n.toLocaleString("fa-IR");
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

// ============================================================
//  بخش ۴: لایه داده
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
        "User-Agent": "Nabz-Worker/14.0",
        "Accept": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
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
  return `${CHART_BASE_URLS[0]}/charts/${key}.png`;
}

// ============================================================
//  بخش ۵: ⭐ GitHub Trigger
// ============================================================

async function triggerWorkflow(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const workflow = env.GITHUB_WORKFLOW;
  const branch = env.GITHUB_BRANCH || "main";

  if (!owner || !repo || !workflow) {
    throw new Error("GITHUB_OWNER/REPO/WORKFLOW not configured");
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
  console.log(`[trigger] Dispatching: ${owner}/${repo}/${workflow}@${branch}`);

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
    const text = await respText(res);
    throw new Error(`GitHub ${res.status}: ${text}`);
  }

  console.log(`[trigger] Success (${res.status})`);
  return { status: res.status, workflow, branch };
}

async function respText(res) {
  try { return (await res.text()).slice(0, 200); } catch { return ""; }
}

// ============================================================
//  بخش ۶: پردازش داده
// ============================================================

function computeStats(history) {
  if (!history || history.length === 0) return null;
  const prices = history.map((x) => x.price || x.price_toman).filter((p) => safeNumber(p) !== null);
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
//  بخش ۷: مدیریت کاربران (نوتیف)
// ============================================================

async function registerUser(chatId, env) {
  const key = `${KV_USER_PREFIX}${chatId}`;
  const existing = await env.RATE_KV.get(key, "json");

  if (!existing) {
    await env.RATE_KV.put(
      key,
      JSON.stringify({
        chat_id: chatId,
        registered_at: Date.now(),
        notify_off: false,
      }),
      { expirationTtl: KV_USER_TTL }
    );
    console.log(`[user] New: ${chatId}`);
    return;
  }

  await env.RATE_KV.put(
    key,
    JSON.stringify({ ...existing, last_seen: Date.now() }),
    { expirationTtl: KV_USER_TTL }
  );
}

async function setNotifyOff(chatId, env) {
  const key = `${KV_USER_PREFIX}${chatId}`;
  const user = (await env.RATE_KV.get(key, "json")) || { chat_id: chatId, registered_at: Date.now() };
  user.notify_off = true;
  user.notify_off_at = Date.now();
  await env.RATE_KV.put(key, JSON.stringify(user), { expirationTtl: KV_USER_TTL });
  console.log(`[user] Notify OFF: ${chatId}`);
}

async function setNotifyOn(chatId, env) {
  const key = `${KV_USER_PREFIX}${chatId}`;
  const user = (await env.RATE_KV.get(key, "json")) || { chat_id: chatId, registered_at: Date.now() };
  user.notify_off = false;
  user.notify_on_at = Date.now();
  await env.RATE_KV.put(key, JSON.stringify(user), { expirationTtl: KV_USER_TTL });
  console.log(`[user] Notify ON: ${chatId}`);
}

async function isNotifyEnabled(chatId, env) {
  const user = await env.RATE_KV.get(`${KV_USER_PREFIX}${chatId}`, "json");
  return user !== null && user.notify_off !== true;
}

async function getActiveUsers(env) {
  const users = [];
  let cursor = undefined;

  do {
    const list = await env.RATE_KV.list({ prefix: KV_USER_PREFIX, cursor });
    for (const key of list.keys) {
      const user = await env.RATE_KV.get(key.name, "json");
      if (user && user.chat_id && user.notify_off !== true) {
        users.push(user.chat_id);
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return users;
}

// ============================================================
//  بخش ۸: مدیریت اشتراک زنده دلار
// ============================================================

async function subscribeUser(chatId, messageId, price, env) {
  await env.RATE_KV.put(`${KV_SUB_PREFIX}${chatId}`,
    JSON.stringify({ chat_id: chatId, message_id: messageId, last_price: price, last_updated: Date.now() }),
    { expirationTtl: KV_SUB_TTL });
}

async function unsubscribeUser(chatId, env) {
  await env.RATE_KV.delete(`${KV_SUB_PREFIX}${chatId}`);
}

async function updateSubscriptionMessage(chatId, newMessageId, price, env) {
  const key = `${KV_SUB_PREFIX}${chatId}`;
  const existing = await env.RATE_KV.get(key, "json");
  await env.RATE_KV.put(key,
    JSON.stringify({ chat_id: chatId, message_id: newMessageId, last_price: price, last_updated: Date.now(), was_subscribed: existing?.was_subscribed ?? true }),
    { expirationTtl: KV_SUB_TTL });
}

async function isSubscribed(chatId, env) {
  const d = await env.RATE_KV.get(`${KV_SUB_PREFIX}${chatId}`, "json");
  return d !== null;
}

// ============================================================
//  بخش ۹: API Endpoints
// ============================================================

async function handleRoot() {
  return jsonResponse({
    name: "Nabz-e Bazaar Bot API",
    version: "14.0",
    source: "NodeOOF/nabz",
    endpoints: {
      "GET /rate": "دلار + تغییرات",
      "GET /market": "همه ۴۷ دارایی",
      "GET /history?days=N": "تاریخچه دلار",
      "GET /stats": "آمار",
      "GET /compare?days=N": "مقایسه",
      "GET /health": "سلامت",
      "GET /ui": "صفحه وب",
      "GET /trigger": "⭐ Trigger GitHub Action",
      "POST /webhook": "وبهوک تلگرام",
    },
  });
}

async function handleRate(env) {
  const { data } = await fetchHistory(env);
  return jsonResponse({
    success: true,
    price_toman: data.latest.price || data.latest.price_toman,
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
      version: "14.0",
      source,
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
    return jsonResponse({
      success: true,
      message: "✅ Workflow triggered",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse("Trigger failed", 500, err.message);
  }
}

async function handleUI() {
  const html = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>نبض بازار — قیمت‌ها</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Vazirmatn,-apple-system,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:20px;display:flex;justify-content:center}
.card{background:#fff;border-radius:24px;padding:24px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)}
h2{text-align:center;font-size:22px;margin-bottom:8px}
.sub{text-align:center;color:#888;font-size:12px;margin-bottom:20px}
.section{font-weight:700;color:#2563eb;margin-top:16px;margin-bottom:8px;padding-top:12px;border-top:2px solid #e5e7eb;font-size:14px}
.section:first-of-type{border-top:none;padding-top:0;margin-top:0}
.row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #f3f4f6}
.label{color:#555}
.value{font-weight:700;color:#111;direction:ltr}
.unit{font-size:10px;color:#888;margin-right:4px}
.loading{text-align:center;color:#999;padding:40px}
.footer{text-align:center;color:#999;font-size:11px;margin-top:20px;padding-top:16px;border-top:1px solid #eee}
</style></head><body><div class="card">
<h2>📊 نبض بازار</h2>
<div class="sub">قیمت‌های لحظه‌ای</div>
<div id="c" class="loading">در حال بارگذاری...</div>
<div class="footer">🌐 github.com/NodeOOF<br>🤖 @dolarazad_bot</div>
</div>
<script>
fetch('/market').then(r=>r.json()).then(d=>{
  const fmt=n=>{if(n===null||n===undefined||n==='')return '—';const v=typeof n==='number'?n:parseFloat(n);return isNaN(v)?n:v.toLocaleString('fa-IR')};
  const AR={usd:'دلار',eur:'یورو',aed:'درهم',try:'لیر ترکیه',gbp:'پوند',cad:'دلار کانادا',aud:'دلار استرالیا',cny:'یوان',jpy:'ین',chf:'فرانک',rub:'روبل',sar:'ریال عربستان'};
  let h='<div class="section">💵 ارزها</div>';
  Object.keys(AR).forEach(k=>{if(d[k])h+='<div class="row"><span class="label">'+AR[k]+'</span><span class="value">'+fmt(d[k])+'<span class="unit"> تومان</span></span></div>';});
  h+='<div class="section">🥇 طلا و سکه</div>';
  if(d.gold_18k)h+='<div class="row"><span class="label">طلای ۱۸ عیار</span><span class="value">'+fmt(d.gold_18k)+'<span class="unit"> تومان</span></span></div>';
  if(d.gold_mesghal)h+='<div class="row"><span class="label">مثقال</span><span class="value">'+fmt(d.gold_mesghal)+'<span class="unit"> تومان</span></span></div>';
  if(d.usd_xau)h+='<div class="row"><span class="label">انس جهانی</span><span class="value">'+d.usd_xau+'<span class="unit"> دلار</span></span></div>';
  if(d.coin_emami)h+='<div class="row"><span class="label">سکه امامی</span><span class="value">'+fmt(d.coin_emami)+'<span class="unit"> تومان</span></span></div>';
  if(d.oil)h+='<div class="section">🛢 انرژی</div><div class="row"><span class="label">نفت خام</span><span class="value">'+d.oil+'<span class="unit"> دلار</span></span></div>';
  h+='<div style="text-align:center;color:#999;font-size:11px;margin-top:16px">'+(d.date_shamsi_full||d.updated_at||'')+'</div>';
  document.getElementById('c').innerHTML=h;
}).catch(()=>document.getElementById('c').innerHTML='<div style="color:red;text-align:center">خطا</div>');
</script></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60", ...CORS_HEADERS },
  });
}

// ============================================================
//  بخش ۱۰: Telegram API
// ============================================================

async function telegramAPI(method, body, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await resp.json();
  if (!result.ok) console.error(`[telegram] ${method}: ${result.description}`);
  return result;
}

async function sendMessage(chatId, text, env, options = {}) {
  return telegramAPI("sendMessage", {
    chat_id: chatId, text,
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: true,
  }, env);
}

async function editMessage(chatId, messageId, text, env, options = {}) {
  return telegramAPI("editMessageText", {
    chat_id: chatId, message_id: messageId, text,
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: true,
  }, env);
}

async function editMessageCaption(chatId, messageId, caption, env, options = {}) {
  return telegramAPI("editMessageCaption", {
    chat_id: chatId, message_id: messageId, caption,
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
  }, env);
}

async function editMessageMedia(chatId, messageId, photoUrl, caption, env, options = {}) {
  return telegramAPI("editMessageMedia", {
    chat_id: chatId,
    message_id: messageId,
    media: {
      type: "photo",
      media: photoUrl,
      caption: caption,
      parse_mode: options.parseMode || "Markdown",
    },
    reply_markup: options.replyMarkup,
  }, env);
}

async function deleteMessage(chatId, messageId, env) {
  return telegramAPI("deleteMessage", { chat_id: chatId, message_id: messageId }, env);
}

async function answerCallbackQuery(id, env, text = null) {
  return telegramAPI("answerCallbackQuery", { callback_query_id: id, text, show_alert: false }, env);
}

async function sendPhoto(chatId, photoUrl, caption, env, options = {}) {
  const urlResult = await telegramAPI("sendPhoto", {
    chat_id: chatId, photo: photoUrl, caption,
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
  }, env);
  if (urlResult.ok) return urlResult;

  console.warn(`[sendPhoto] URL failed, trying file upload...`);
  try {
    const imgResp = await fetch(photoUrl, {
      headers: { "User-Agent": "Nabz-Worker/14.0" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status}`);
    const imgBlob = await imgResp.blob();
    const filename = photoUrl.split("/").pop() || "chart.png";

    const form = new FormData();
    form.append("chat_id", chatId.toString());
    form.append("photo", imgBlob, filename);
    if (caption) form.append("caption", caption);
    form.append("parse_mode", options.parseMode || "Markdown");
    if (options.replyMarkup) form.append("reply_markup", JSON.stringify(options.replyMarkup));

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const resp = await fetch(url, { method: "POST", body: form });
    const result = await resp.json();
    if (!result.ok) console.error(`[sendPhoto] file upload failed: ${result.description}`);
    return result;
  } catch (err) {
    console.error(`[sendPhoto] file upload error: ${err.message}`);
    return urlResult;
  }
}

// ============================================================
//  بخش ۱۱: Keyboards
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
    [{ text: "🔔 اشتراک زنده دلار", callback_data: "cmd:subscribe" }],
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
      { text: "🔔 اشتراک زنده", callback_data: "cmd:subscribe" },
      { text: "🏠 منو", callback_data: "cmd:menu" },
    ],
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
      { text: "📊 همه قیمت‌ها", callback_data: "cmd:all" },
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
//  بخش ۱۲: Message Builders
// ============================================================

function changeIndicator(ch) {
  if (!ch) return "_داده کافی نیست_";
  const arrow = ch.direction === "up" ? "🔺" : ch.direction === "down" ? "🔻" : "▪️";
  const sign = ch.change > 0 ? "+" : ch.change < 0 ? "−" : "";
  return `${arrow} \`${sign}${toPersianNumber(Math.abs(ch.change))}\` (${ch.change_percent}%)`;
}

function buildPriceCaption(data) {
  const ch24 = computeChange(data.history, 1);
  const ch7 = computeChange(data.history, 7);
  const ch30 = computeChange(data.history, 30);
  const price = data.latest?.price || data.latest?.price_toman;

  let msg = `💵 *دلار آمریکا*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `💰 *${toPersianNumber(price)}* تومان\n\n`;
  msg += `📊 *تغییرات*\n`;
  msg += `• ۲۴ ساعت: ${changeIndicator(ch24)}\n`;
  msg += `• ۷ روز: ${changeIndicator(ch7)}\n`;
  msg += `• ۳۰ روز: ${changeIndicator(ch30)}\n\n`;
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

  let msg = `📊 *نبض بازار*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

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

  let msg = `${info.icon} *${info.title}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
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
  msg += `💰 *${m.oil || "—"}* دلار\n\n`;
  msg += `⏱ ${m.updated_at || "—"}`;
  msg += FOOTER;
  return msg;
}

function buildHistoryMessage(data, days = 7) {
  const history = data.history.slice(-days);
  const prices = history.map((h) => safeNumber(h.price || h.price_toman)).filter((p) => p !== null);
  if (prices.length === 0) return `📊 *تاریخچه*\n\n_داده‌ای موجود نیست._` + FOOTER;

  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  let msg = `📊 *تاریخچه ${toPersianNumber(days)} روز دلار*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
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

function buildMenuMessage(subscribed, notifyEnabled) {
  let msg = `🏠 *منوی اصلی*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `سلام! 👋\n`;
  msg += `من بات *نبض بازار* هستم.\n\n`;
  msg += `📋 *قابلیت‌ها*\n`;
  msg += `• 📊 همه قیمت‌ها\n`;
  msg += `• 💵 دلار + نمودار\n`;
  msg += `• 💶 یورو + نمودار\n`;
  msg += `• 🥇 طلا + نمودار\n`;
  msg += `• 🪙 سکه + نمودار\n`;
  msg += `• 💱 همه ارزها\n`;
  msg += `• 🔄 تبدیل\n\n`;
  msg += `🔔 *وضعیت‌ها:*\n`;
  msg += `• نوتیف ساعتی: ${notifyEnabled ? "✅ فعال" : "🔕 غیرفعال"}\n`;
  msg += `• اشتراک زنده دلار: ${subscribed ? "✅ فعال" : "❌ غیرفعال"}\n\n`;
  msg += `💡 *راهنما:*\n`;
  msg += `• «🔔 اشتراک زنده دلار» → پیام دلار هر ۳۰ دقیقه ویرایش می‌شود\n`;
  msg += `• «🔕 لغو نوتیف ساعتی» → پیام ساعتی دریافت نکن`;
  msg += FOOTER;
  return msg;
}

// ============================================================
//  بخش ۱۳: تابع کمکی
// ============================================================

async function updateWithPhoto(chatId, env, options, assetKey, caption) {
  const photoUrl = chartUrlFor(assetKey);

  if (options.editMessageId) {
    const mediaResult = await editMessageMedia(
      chatId,
      options.editMessageId,
      photoUrl,
      caption,
      env,
      { replyMarkup: options.replyMarkup }
    );

    if (mediaResult.ok) return mediaResult;

    const desc = mediaResult.description || "";
    console.warn(`[edit] editMessageMedia failed: ${desc}`);

    if (desc.includes("no caption") || desc.includes("message is not a photo")) {
      const capResult = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: options.replyMarkup });
      if (capResult.ok) return capResult;
    }

    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }

  const photoResult = await sendPhoto(chatId, photoUrl, caption, env, {
    replyMarkup: options.replyMarkup,
  });
  if (photoResult.ok) return photoResult;

  return sendMessage(chatId, caption, env, { replyMarkup: options.replyMarkup });
}

// ============================================================
//  بخش ۱۴: Handlers
// ============================================================

async function respondWithRate(chatId, env, options = {}) {
  const { data } = await fetchHistory(env);
  const caption = buildPriceCaption(data);
  const price = data.latest?.price || data.latest?.price_toman;

  const replyMarkup = options.replyMarkup || PRICE_KEYBOARD;
  const result = await updateWithPhoto(chatId, env, { ...options, replyMarkup }, "usd", caption);

  if (options.subscribe && result.ok) {
    if (options.editMessageId) {
      await updateSubscriptionMessage(chatId, options.editMessageId, price, env);
    } else if (result.result?.message_id) {
      await subscribeUser(chatId, result.result.message_id, price, env);
    }
  }

  return result;
}

async function respondWithAsset(chatId, env, assetKey, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildAssetCaption(assetKey, data);
  return updateWithPhoto(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, assetKey, caption);
}

async function respondWithAll(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildAllCaption(data);
  return updateWithPhoto(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "usd", caption);
}

async function respondWithCoins(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildCoinsCaption(data);
  return updateWithPhoto(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "coin_emami", caption);
}

async function respondWithGold(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildGoldCaption(data);
  return updateWithPhoto(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "gold_18k", caption);
}

async function respondWithCurrencies(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildCurrenciesCaption(data);
  return updateWithPhoto(chatId, env, { ...options, replyMarkup: BACK_KEYBOARD }, "eur", caption);
}

async function respondWithOil(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const msg = buildOilCaption(data);
  if (options.editMessageId) {
    const r = await editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
    if (r.ok) return r;
    if (!r.description?.includes("no caption")) return r;
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithHistory(chatId, env, days = 7, options = {}) {
  const { data } = await fetchHistory(env);
  const msg = buildHistoryMessage(data, days);
  if (options.editMessageId) {
    const r = await editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
    if (r.ok) return r;
    if (!r.description?.includes("no caption")) return r;
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithStats(chatId, env, options = {}) {
  const { data } = await fetchHistory(env);
  const msg = buildStatsMessage(data);
  if (options.editMessageId) {
    const r = await editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
    if (r.ok) return r;
    if (!r.description?.includes("no caption")) return r;
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithCompare(chatId, env, days = 30, options = {}) {
  const { data } = await fetchHistory(env);
  const msg = buildCompareMessage(data, days);
  if (options.editMessageId) {
    const r = await editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
    if (r.ok) return r;
    if (!r.description?.includes("no caption")) return r;
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithMenu(chatId, env, options = {}) {
  const subscribed = await isSubscribed(chatId, env);
  const notifyEnabled = await isNotifyEnabled(chatId, env);
  const msg = buildMenuMessage(subscribed, notifyEnabled);
  if (options.editMessageId) {
    const r = await editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: MAIN_MENU_KEYBOARD });
    if (r.ok) return r;
    if (!r.description?.includes("no caption")) return r;
    await deleteMessage(chatId, options.editMessageId, env).catch(() => {});
  }
  return sendMessage(chatId, msg, env, { replyMarkup: MAIN_MENU_KEYBOARD });
}

// ============================================================
//  بخش ۱۵: پردازش دستورات متنی
// ============================================================

async function handleBotCommand(message, env, ctx) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const text = (message.text || "").trim();

  console.log(`[bot] Command: "${text}" from chat ${chatId}`);

  ctx.waitUntil((async () => {
    await sleep(2000);
    await deleteMessage(chatId, messageId, env).catch(() => {});
  })());

  try {
    await registerUser(chatId, env);

    if (text === "/start" || text === "/menu") return respondWithMenu(chatId, env);

    if (text === "/help") {
      let msg = `📖 *راهنمای بات*\n━━━━━━━━━━━━━━━━━━━\n\n`;
      BOT_COMMANDS.forEach((c) => { msg += `/${c.command} — ${c.description}\n`; });
      msg += `\n💡 *نکته:* هر ساعت یک نوتیف قیمت دریافت می‌کنی.\n`;
      msg += `برای لغو: /notify\\_off`;
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

    if (text === "/subscribe") {
      const msg = await respondWithRate(chatId, env, { subscribe: true });
      if (msg.ok) {
        return sendMessage(chatId,
          `✅ *اشتراک زنده دلار فعال شد*\n\n` +
          `از این پس قیمت دلار هر ۳۰ دقیقه بررسی و در صورت تغییر، *همین پیام* ویرایش می‌شود.\n\n` +
          `🔕 لغو: /unsubscribe` + FOOTER, env);
      }
      return msg;
    }

    if (text === "/unsubscribe") {
      await unsubscribeUser(chatId, env);
      return sendMessage(chatId,
        `🔕 *اشتراک زنده دلار غیرفعال شد*\n\nدیگر پیام دلار برایت ویرایش نمی‌شود.` + FOOTER,
        env, { replyMarkup: MAIN_MENU_KEYBOARD });
    }

    if (text === "/notify_off") {
      await setNotifyOff(chatId, env);
      return sendMessage(chatId,
        `🔕 *نوتیف ساعتی لغو شد*\n\n` +
        `دیگر پیام ساعتی قیمت دریافت نمی‌کنی.\n\n` +
        `💡 برای فعال‌سازی: /notify\\_on` + FOOTER,
        env, { replyMarkup: NOTIFY_OFF_KEYBOARD });
    }

    if (text === "/notify_on") {
      await setNotifyOn(chatId, env);
      return sendMessage(chatId,
        `🔔 *نوتیف ساعتی فعال شد*\n\n` +
        `از این پس هر ساعت قیمت جدید برایت ارسال می‌شود.\n\n` +
        `🔕 برای لغو: /notify\\_off` + FOOTER,
        env, { replyMarkup: MAIN_MENU_KEYBOARD });
    }

    if (text.startsWith("/convert")) {
      const arg = text.replace("/convert", "").trim();
      const amount = parseFloat(arg);
      if (isNaN(amount) || amount <= 0) {
        return sendMessage(chatId, `🔄 *تبدیل دلار به تومان*\n\nمثال: \`/convert 100\`` + FOOTER, env, { replyMarkup: BACK_KEYBOARD });
      }
      const { data } = await fetchHistory(env);
      const rate = safeNumber(data.latest?.price || data.latest?.price_toman);
      if (rate === null) return sendMessage(chatId, `❌ نرخ دلار در دسترس نیست.` + FOOTER, env);
      const toman = Math.round(amount * rate);
      let msg = `🔄 *تبدیل ارز*\n━━━━━━━━━━━━━━━━━━━\n\n`;
      msg += `💵 *${toPersianNumber(amount)}* دلار\n       ⬇️\n💰 *${toPersianNumber(toman)}* تومان\n\n`;
      msg += `📌 نرخ: \`${toPersianNumber(rate)}\``;
      msg += FOOTER;
      return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
    }

    return sendMessage(chatId, `❓ *دستور نامعتبر*\n\nاز /menu استفاده کن.` + FOOTER, env, { replyMarkup: MAIN_MENU_KEYBOARD });
  } catch (err) {
    console.error(`[bot] ERROR: ${err.message}\n${err.stack}`);
    try {
      return await sendMessage(chatId, `❌ *خطا در پردازش*\n\nلطفاً بعداً تلاش کن.` + FOOTER, env);
    } catch (e2) { console.error(`[bot] double error: ${e2.message}`); }
  }
}

// ============================================================
//  بخش ۱۶: Callback Query Handler
// ============================================================

async function handleCallbackQuery(cb, env, ctx) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data || "";
  ctx.waitUntil(answerCallbackQuery(cb.id, env));

  try {
    if (!data.startsWith("cmd:")) return;
    const action = data.slice(4);

    await registerUser(chatId, env);

    switch (action) {
      case "menu": return respondWithMenu(chatId, env, { editMessageId: messageId });
      case "all": return respondWithAll(chatId, env, { editMessageId: messageId });
      case "price": return respondWithRate(chatId, env, { editMessageId: messageId });
      case "eur": return respondWithAsset(chatId, env, "eur", { editMessageId: messageId });
      case "gold": return respondWithGold(chatId, env, { editMessageId: messageId });
      case "coins": return respondWithCoins(chatId, env, { editMessageId: messageId });
      case "currencies": return respondWithCurrencies(chatId, env, { editMessageId: messageId });
      case "oil": return respondWithOil(chatId, env, { editMessageId: messageId });
      case "history": return respondWithHistory(chatId, env, 7, { editMessageId: messageId });
      case "stats": return respondWithStats(chatId, env, { editMessageId: messageId });
      case "compare": return respondWithCompare(chatId, env, 30, { editMessageId: messageId });

      case "subscribe":
        await unsubscribeUser(chatId, env);
        return respondWithRate(chatId, env, { editMessageId: messageId, subscribe: true });

      case "notify_off":
        await setNotifyOff(chatId, env);
        return editMessage(
          chatId, messageId,
          `🔕 *نوتیف ساعتی لغو شد*\n\n` +
          `دیگر پیام ساعتی قیمت دریافت نمی‌کنی.\n\n` +
          `💡 برای فعال‌سازی مجدد، دکمه زیر را بزن.` + FOOTER,
          env, { replyMarkup: NOTIFY_OFF_KEYBOARD }
        );

      case "notify_on":
        await setNotifyOn(chatId, env);
        return editMessage(
          chatId, messageId,
          `🔔 *نوتیف ساعتی فعال شد*\n\n` +
          `از این پس هر ساعت قیمت جدید برایت ارسال می‌شود.\n\n` +
          `💡 برای لغو، دکمه زیر را بزن.` + FOOTER,
          env, { replyMarkup: MAIN_MENU_KEYBOARD }
        );

      case "convert":
        return editMessage(chatId, messageId,
          `🔄 *تبدیل دلار به تومان*\n\nدستور \`/convert <عدد>\` را بفرست.\n\nمثال: \`/convert 100\`` + FOOTER,
          env, { replyMarkup: BACK_KEYBOARD });

      default: return;
    }
  } catch (err) { console.error(`[callback] ERROR: ${err.message}`); }
}

// ============================================================
//  بخش ۱۷: Webhook
// ============================================================

async function handleWebhook(request, env, ctx) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const update = await request.json();
    if (update.message && update.message.text) ctx.waitUntil(handleBotCommand(update.message, env, ctx));
    if (update.callback_query) ctx.waitUntil(handleCallbackQuery(update.callback_query, env, ctx));
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`[webhook] ${err.message}`);
    return new Response("Error", { status: 500 });
  }
}

// ============================================================
//  بخش ۱۸: Cron
// ============================================================

async function sendHourlyNotification(env) {
  console.log(`[notify] Starting hourly notification...`);

  const { data } = await fetchHistory(env);
  const price = data.latest?.price || data.latest?.price_toman;
  if (!price) { console.error(`[notify] No price`); return; }

  const users = await getActiveUsers(env);
  console.log(`[notify] ${users.length} active users`);
  if (users.length === 0) return;

  const caption = buildPriceCaption(data);
  const photoUrl = chartUrlFor("usd");
  const pending = (await env.RATE_KV.get(KV_NOTIFY_PENDING, "json")) || [];

  let sent = 0, failed = 0;

  for (let i = 0; i < users.length; i++) {
    const chatId = users[i];
    try {
      const result = await sendPhoto(chatId, photoUrl, caption, env, {
        replyMarkup: NOTIFY_KEYBOARD,
      });

      if (result.ok && result.result?.message_id) {
        pending.push({
          chat_id: chatId,
          message_id: result.result.message_id,
          sent_at: Date.now(),
        });
        sent++;
      } else {
        const desc = result.description || "";
        if (desc.includes("blocked") || desc.includes("chat not found") || desc.includes("deactivated") || desc.includes("kicked")) {
          await env.RATE_KV.delete(`${KV_USER_PREFIX}${chatId}`);
          console.log(`[notify] Removed blocked: ${chatId}`);
        }
        failed++;
      }
    } catch (err) {
      console.error(`[notify] ${chatId}: ${err.message}`);
      failed++;
    }

    if (i > 0 && i % NOTIFY_BATCH_SIZE === 0) {
      await sleep(1000);
    } else {
      await sleep(50);
    }
  }

  await env.RATE_KV.put(KV_NOTIFY_PENDING, JSON.stringify(pending), {
    expirationTtl: KV_PENDING_TTL,
  });

  console.log(`[notify] Sent: ${sent}, Failed: ${failed}, Pending: ${pending.length}`);
}

async function cleanupOldNotifications(env) {
  const pending = (await env.RATE_KV.get(KV_NOTIFY_PENDING, "json")) || [];
  if (pending.length === 0) return;

  const now = Date.now();
  const keep = [];
  let deleted = 0;

  for (const n of pending) {
    const ageMin = (now - n.sent_at) / 60000;
    if (ageMin >= NOTIFY_DELETE_AFTER_MINUTES) {
      try {
        await deleteMessage(n.chat_id, n.message_id, env);
        deleted++;
      } catch {}
    } else {
      keep.push(n);
    }
    await sleep(30);
  }

  if (keep.length > 0) {
    await env.RATE_KV.put(KV_NOTIFY_PENDING, JSON.stringify(keep), {
      expirationTtl: KV_PENDING_TTL,
    });
  } else {
    await env.RATE_KV.delete(KV_NOTIFY_PENDING);
  }

  if (deleted > 0) console.log(`[cleanup] Deleted: ${deleted}, Kept: ${keep.length}`);
}

async function updateSubscribers(env) {
  const { data } = await fetchHistory(env);
  const newPrice = data.latest?.price || data.latest?.price_toman;

  const list = await env.RATE_KV.list({ prefix: KV_SUB_PREFIX });
  if (list.keys.length === 0) return;

  console.log(`[subs] ${list.keys.length} subscribers`);

  let edited = 0, deleted = 0, skipped = 0;
  for (const key of list.keys) {
    const sub = await env.RATE_KV.get(key.name, "json");
    if (!sub) continue;
    if (sub.last_price === newPrice) { skipped++; continue; }

    const caption = buildPriceCaption(data);
    try {
      let result = await editMessageMedia(
        sub.chat_id,
        sub.message_id,
        chartUrlFor("usd"),
        caption,
        env,
        { replyMarkup: PRICE_KEYBOARD }
      );

      if (!result.ok && result.description?.includes("no caption")) {
        result = await editMessage(sub.chat_id, sub.message_id, caption, env, { replyMarkup: PRICE_KEYBOARD });
      }

      if (result.ok) {
        await env.RATE_KV.put(key.name, JSON.stringify({ ...sub, last_price: newPrice, last_updated: Date.now() }), { expirationTtl: KV_SUB_TTL });
        edited++;
      } else {
        const desc = result.description || "";
        if (desc.includes("not found") || desc.includes("can't be edited") || desc.includes("chat not found")) {
          await env.RATE_KV.delete(key.name);
          deleted++;
        }
      }
    } catch (err) {
      console.error(`[subs] ${sub.chat_id}: ${err.message}`);
    }
    await sleep(50);
  }
  console.log(`[subs] Edited: ${edited}, Deleted: ${deleted}, Skipped: ${skipped}`);
}

/**
 * ⭐ Cron Handler ترکیبی
 *
 * cron: "7,22,37,52 * * * *"
 *   :07 → trigger GitHub + نوتیف + cleanup
 *   :22 → چک داده + ویرایش subscribers + cleanup
 *   :37 → trigger GitHub + cleanup
 *   :52 → چک داده + ویرایش subscribers + cleanup
 */
async function handleScheduled(controller, env, ctx) {
  console.log(`[cron] ${controller.cron}`);
  if (!env.RATE_KV) return;

  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  console.log(`[cron] UTC minute: ${currentMinute}`);

  // ⭐ همیشه: پاک‌سازی نوتیف‌های قدیمی
  await cleanupOldNotifications(env);

  // ⭐ دقیقه :07 و :37 → Trigger GitHub Action
  if (currentMinute === 7 || currentMinute === 37) {
    try {
      await triggerWorkflow(env);
    } catch (err) {
      console.error(`[cron] Trigger failed: ${err.message}`);
      // خطا نادیده گرفته می‌شود، cron بعدی تلاش می‌کند
    }
  }

  // ⭐ دقیقه :07 → نوتیف ساعتی
  if (currentMinute === 7) {
    const lastNotify = parseInt((await env.RATE_KV.get(KV_LAST_NOTIFY_TIME)) || "0", 10);
    const minutesSinceLast = (Date.now() - lastNotify) / 60000;

    if (minutesSinceLast >= 55) {
      await sendHourlyNotification(env);
      await env.RATE_KV.put(KV_LAST_NOTIFY_TIME, String(Date.now()));
    } else {
      console.log(`[cron] Notify skip, ${Math.round(minutesSinceLast)}m`);
    }
  }

  // ⭐ همیشه: ویرایش subscribers
  await updateSubscribers(env);
}

// ============================================================
//  بخش ۱۹: Setup & Router
// ============================================================

async function handleSetup(env) {
  const result = await telegramAPI("setMyCommands", { commands: BOT_COMMANDS }, env);
  return jsonResponse({ success: result.ok, commands: BOT_COMMANDS, telegram_response: result });
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === "/webhook" && method === "POST") return handleWebhook(request, env, ctx);
  if (path === "/setup") return handleSetup(env);
  if (path === "/trigger") return handleTrigger(env);

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
