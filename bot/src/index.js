// ============================================================
//  Cloudflare Worker — Nabz-e Bazaar Bot
//  نسخه: 13.0
//  منبع: itsyebekhe/nabz (۴۷ دارایی)
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

const NABZ_RAW = "https://cdn.jsdelivr.net/gh/itsyebekhe/nabz@main";
const NABZ_CDN = "https://cdn.jsdelivr.net/gh/itsyebekhe/nabz@main";

const HISTORY_SOURCES = [
  `${NABZ_RAW}/api/history_usd.json`,
  `${NABZ_CDN}/api/history_usd.json`,
];

const MARKET_SOURCES = [
  `${NABZ_RAW}/market.json`,
  `${NABZ_CDN}/market.json`,
  "https://cdn.statically.io/gh/itsyebekhe/nabz/main/market.json",
];

const FOOTER = "\n\n━━━━━━━━━━━━━━━━━━━\n🌐 github.com/NodeOOF\n🤖 @dolarazad\\_bot";

const DEFAULT_STALE_MINUTES = 120;
const DEFAULT_CACHE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 10000;

const KV_SUB_PREFIX = "sub:";
const KV_SUB_TTL = 60 * 60 * 24 * 7;

// ============================================================
//  جدول دارایی‌ها — دقیقاً مطابق nabz
// ============================================================

const ASSETS = {
  // ارزهای شاخص
  usd: { title: "دلار آمریکا", icon: "🇺🇸", unit: "تومان", category: "major" },
  eur: { title: "یورو اروپا", icon: "🇪🇺", unit: "تومان", category: "major" },
  aed: { title: "درهم امارات", icon: "🇦🇪", unit: "تومان", category: "major" },
  try: { title: "لیر ترکیه", icon: "🇹🇷", unit: "تومان", category: "major" },
  gbp: { title: "پوند انگلیس", icon: "🇬🇧", unit: "تومان", category: "major" },
  cad: { title: "دلار کانادا", icon: "🇨🇦", unit: "تومان", category: "major" },
  aud: { title: "دلار استرالیا", icon: "🇦🇺", unit: "تومان", category: "major" },
  cny: { title: "یوان چین", icon: "🇨🇳", unit: "تومان", category: "major" },

  // طلا و فلزات
  gold_18k: { title: "طلای ۱۸ عیار", icon: "✨", unit: "تومان", category: "gold" },
  gold_mesghal: { title: "مثقال طلا (آبشده)", icon: "⚖️", unit: "تومان", category: "gold" },
  usd_xau: { title: "انس جهانی طلا", icon: "🌐", unit: "دلار", category: "gold" },
  gold_ounce: { title: "انس جهانی طلا", icon: "🌐", unit: "دلار", category: "gold" },

  // سکه‌ها
  coin_emami: { title: "سکه تمام امامی", icon: "🟡", unit: "تومان", category: "coin" },
  coin_bahar: { title: "سکه بهار آزادی", icon: "🟡", unit: "تومان", category: "coin" },
  coin_half: { title: "نیم سکه", icon: "🟡", unit: "تومان", category: "coin" },
  coin_quarter: { title: "ربع سکه", icon: "🟡", unit: "تومان", category: "coin" },
  coin_gram: { title: "سکه گرمی", icon: "🟡", unit: "تومان", category: "coin" },

  // سایر ارزها
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

  // انرژی
  oil: { title: "نفت خام", icon: "🛢", unit: "دلار", category: "energy" },
};

const BOT_COMMANDS = [
  { command: "start", description: "🏠 شروع و منوی اصلی" },
  { command: "all", description: "📊 همه قیمت‌ها" },
  { command: "price", description: "💵 دلار + نمودار" },
  { command: "eur", description: "💶 یورو + نمودار" },
  { command: "gold", description: "🥇 طلا + نمودار" },
  { command: "coins", description: "🪙 سکه‌ها + نمودار" },
  { command: "currencies", description: "💱 ارزها" },
  { command: "oil", description: "🛢 نفت" },
  { command: "history", description: "📊 تاریخچه دلار" },
  { command: "stats", description: "📈 آمار" },
  { command: "compare", description: "📉 مقایسه" },
  { command: "convert", description: "🔄 تبدیل" },
  { command: "subscribe", description: "🔔 اشتراک خودکار" },
  { command: "unsubscribe", description: "🔕 غیرفعال‌سازی" },
  { command: "help", description: "📖 راهنما" },
];

// ============================================================
//  بخش ۲: cache
// ============================================================

const _cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

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
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Nabz-Worker/13.0", Accept: "application/json" },
      cf: { cacheTtl: 60, cacheEverything: true },
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

/** URL چارت هر دارایی */
function chartUrlFor(key) {
  return `${NABZ_RAW}/charts/${key}.png`;
}

// ============================================================
//  بخش ۵: پردازش داده
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
//  بخش ۶: API Endpoints
// ============================================================

async function handleRoot() {
  return jsonResponse({
    name: "Nabz-e Bazaar Bot API",
    version: "13.0",
    source: "itsyebekhe/nabz",
    endpoints: {
      "GET /rate": "دلار + تغییرات",
      "GET /market": "همه ۴۷ دارایی",
      "GET /history?days=N": "تاریخچه دلار",
      "GET /stats": "آمار",
      "GET /compare?days=N": "مقایسه",
      "GET /health": "سلامت",
      "GET /ui": "صفحه وب",
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
    return jsonResponse({ status: "healthy", source, updated_at: data.updated_at });
  } catch (err) {
    return jsonResponse({ status: "unhealthy", error: err.message }, 503);
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
.value{font-weight:700;color:#111;direction:ltr;font-variant-numeric:tabular-nums}
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
  const AR={usd:'دلار',eur:'یورو',aed:'درهم',try:'لیر ترکیه',gbp:'پوند',cad:'دلار کانادا',aud:'دلار استرالیا',cny:'یوان',jpy:'ین',chf:'فرانک',rub:'روبل',sar:'ریال عربستان',iqd:'دینار عراق',aed:'درهم',kwd:'دینار کویت',omr:'ریال عمان'};
  let h='<div class="section">💵 ارزها</div>';
  Object.keys(AR).forEach(k=>{if(d[k])h+='<div class="row"><span class="label">'+AR[k]+'</span><span class="value">'+fmt(d[k])+'<span class="unit"> تومان</span></span></div>';});
  h+='<div class="section">🥇 طلا</div>';
  if(d.gold_18k)h+='<div class="row"><span class="label">۱۸ عیار</span><span class="value">'+fmt(d.gold_18k)+'<span class="unit"> تومان</span></span></div>';
  if(d.gold_mesghal)h+='<div class="row"><span class="label">مثقال</span><span class="value">'+fmt(d.gold_mesghal)+'<span class="unit"> تومان</span></span></div>';
  if(d.usd_xau)h+='<div class="row"><span class="label">انس جهانی</span><span class="value">'+d.usd_xau+'<span class="unit"> دلار</span></span></div>';
  h+='<div class="section">🪙 سکه</div>';
  if(d.coin_emami)h+='<div class="row"><span class="label">امامی</span><span class="value">'+fmt(d.coin_emami)+'<span class="unit"> تومان</span></span></div>';
  if(d.coin_bahar)h+='<div class="row"><span class="label">بهار آزادی</span><span class="value">'+fmt(d.coin_bahar)+'<span class="unit"> تومان</span></span></div>';
  if(d.coin_half)h+='<div class="row"><span class="label">نیم سکه</span><span class="value">'+fmt(d.coin_half)+'<span class="unit"> تومان</span></span></div>';
  if(d.coin_quarter)h+='<div class="row"><span class="label">ربع سکه</span><span class="value">'+fmt(d.coin_quarter)+'<span class="unit"> تومان</span></span></div>';
  if(d.coin_gram)h+='<div class="row"><span class="label">سکه گرمی</span><span class="value">'+fmt(d.coin_gram)+'<span class="unit"> تومان</span></span></div>';
  h+='<div class="section">🛢 انرژی</div>';
  if(d.oil)h+='<div class="row"><span class="label">نفت خام</span><span class="value">'+d.oil+'<span class="unit"> دلار</span></span></div>';
  h+='<div style="text-align:center;color:#999;font-size:11px;margin-top:16px">'+(d.date_shamsi_full||d.updated_at||'')+'</div>';
  document.getElementById('c').innerHTML=h;
}).catch(()=>document.getElementById('c').innerHTML='<div style="color:red;text-align:center">خطا</div>');
</script></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60", ...CORS_HEADERS },
  });
}

// ============================================================
//  بخش ۷: Telegram API
// ============================================================

async function telegramAPI(method, body, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

async function deleteMessage(chatId, messageId, env) {
  return telegramAPI("deleteMessage", { chat_id: chatId, message_id: messageId }, env);
}

async function answerCallbackQuery(id, env, text = null) {
  return telegramAPI("answerCallbackQuery", { callback_query_id: id, text, show_alert: false }, env);
}

async function sendPhoto(chatId, photoUrl, caption, env, options = {}) {
  return telegramAPI("sendPhoto", {
    chat_id: chatId, photo: photoUrl, caption,
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
  }, env);
}

async function editMessageCaption(chatId, messageId, caption, env, options = {}) {
  return telegramAPI("editMessageCaption", {
    chat_id: chatId, message_id: messageId, caption,
    parse_mode: options.parseMode || "Markdown",
    reply_markup: options.replyMarkup,
  }, env);
}

// ============================================================
//  بخش ۸: Keyboards
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
    [{ text: "🔔 اشتراک خودکار", callback_data: "cmd:subscribe" }],
  ],
};

const PRICE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "🔄 به‌روزرسانی", callback_data: "cmd:price" },
      { text: "📊 همه", callback_data: "cmd:all" },
    ],
    [
      { text: "📊 تاریخچه", callback_data: "cmd:history" },
      { text: "📈 آمار", callback_data: "cmd:stats" },
    ],
    [
      { text: "🔔 اشتراک", callback_data: "cmd:subscribe" },
      { text: "🏠 منو", callback_data: "cmd:menu" },
    ],
  ],
};

const BACK_KEYBOARD = {
  inline_keyboard: [[{ text: "🏠 منوی اصلی", callback_data: "cmd:menu" }]],
};

// ============================================================
//  بخش ۹: Message Builders
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

  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                                   💵 *دلار آمریکا*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  msg += `💰 *${toPersianNumber(price)}* تومان\n\n`;
  msg += `┌─ 📊 *تغییرات*\n`;
  msg += `│ ۲۴ ساعت:  ${changeIndicator(ch24)}\n`;
  msg += `│ ۷ روز:     ${changeIndicator(ch7)}\n`;
  msg += `│ ۳۰ روز:    ${changeIndicator(ch30)}\n`;
  msg += `└───────────────────────\n\n`;
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

  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                                          📊 *نبض بازار*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

  for (const cat of Object.values(categories)) {
    msg += `${cat.title}\n`;
    for (const key of cat.keys) {
      const info = ASSETS[key];
      if (!info) continue;
      const val = m[key];
      if (val === null || val === undefined) continue;
      const unit = info.unit === "دلار" ? "دلار" : "تومان";
      msg += `├ ${info.title}: *${toPersianNumber(val)}* ${unit}\n`;
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

  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                ${info.icon} *${info.title}*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  msg += `💰 *${toPersianNumber(val)}* ${unit}\n\n`;
  msg += `⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `\n📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildCoinsCaption(m) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                                  🪙 *سکه‌ها*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  const keys = ["coin_emami","coin_bahar","coin_half","coin_quarter","coin_gram"];
  for (const key of keys) {
    const info = ASSETS[key];
    if (!info) continue;
    const v = m[key];
    if (v === null || v === undefined) continue;
    msg += `${info.icon} ${info.title}: *${toPersianNumber(v)}* تومان\n`;
  }
  msg += `\n⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `\n📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildGoldCaption(m) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                          🥇 *طلا*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  if (m.gold_18k) msg += `✨ طلای ۱۸ عیار: *${toPersianNumber(m.gold_18k)}* تومان\n`;
  if (m.gold_mesghal) msg += `⚖️ مثقال: *${toPersianNumber(m.gold_mesghal)}* تومان\n`;
  if (m.usd_xau) msg += `🌐 انس جهانی: *${m.usd_xau}* دلار\n`;
  msg += `\n⏱ ${m.updated_at || "—"}`;
  if (m.date_shamsi_full) msg += `\n📅 ${m.date_shamsi_full}`;
  msg += FOOTER;
  return msg;
}

function buildCurrenciesCaption(m) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                         💱 *همه ارزها*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  const keys = ["usd","eur","aed","try","gbp","cad","aud","cny","rub","iqd","jpy","sar","kwd","omr","chf","sek","nok","dkk","sgd","hkd"];
  for (const key of keys) {
    const info = ASSETS[key];
    if (!info) continue;
    const v = m[key];
    if (v === null || v === undefined) continue;
    msg += `${info.icon} ${info.title}: *${toPersianNumber(v)}*\n`;
  }
  msg += `\n⏱ ${m.updated_at || "—"}`;
  msg += FOOTER;
  return msg;
}

function buildOilCaption(m) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                               🛢 *نفت خام*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
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

  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `       📊 *تاریخچه ${toPersianNumber(days)} روز*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  history.forEach((item) => {
    const v = safeNumber(item.price || item.price_toman);
    if (v === null) return;
    const ratio = (v - minP) / range;
    const bars = Math.round(ratio * 8);
    const visual = "▰".repeat(bars + 1) + "▱".repeat(Math.max(0, 8 - bars));
    msg += `\`${item.date.slice(5)}\` ${visual}\n        💰 *${toPersianNumber(v)}*\n`;
  });
  msg += `\n⏱ ${data.updated_at}`;
  msg += FOOTER;
  return msg;
}

function buildStatsMessage(data) {
  const stats = computeStats(data.history);
  if (!stats) return `📈 *آمار*\n\n_داده‌ای موجود نیست._` + FOOTER;

  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                              📈 *آمار کلی دلار*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  msg += `┌─ 💹 *بازه قیمت*\n`;
  msg += `│ 🔻 کمینه: *${toPersianNumber(stats.min_price)}*\n`;
  msg += `│ 🔺 بیشینه: *${toPersianNumber(stats.max_price)}*\n`;
  msg += `└ 📊 میانگین: *${toPersianNumber(stats.avg_price)}*\n\n`;
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

  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `          📊 *مقایسه ${toPersianNumber(days)} روزه*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  msg += `┌─ 💰 امروز: *${toPersianNumber(comparison.current)}*\n`;
  msg += `└─ 📅 ${comparison.past_date}: *${toPersianNumber(comparison.past)}*\n\n`;
  msg += `${arrow} تغییر: *${sign}${toPersianNumber(Math.abs(comparison.change))}* (${comparison.change_percent}%)`;
  msg += FOOTER;
  return msg;
}

function buildMenuMessage(subscribed) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `                                                                  🏠 *منوی اصلی*\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
  msg += `سلام! 👋\n`;
  msg += `من بات *نبض بازار* هستم.\n\n`;
  msg += `📋 *قابلیت‌ها*\n`;
  msg += `├ 📊 همه قیمت‌ها\n`;
  msg += `├ 💵 دلار + نمودار\n`;
  msg += `├ 💶 یورو + نمودار\n`;
  msg += `├ 🥇 طلا + نمودار\n`;
  msg += `├ 🪙 سکه + نمودار\n`;
  msg += `├ 💱 همه ارزها\n`;
  msg += `└ 🔄 تبدیل\n\n`;
  if (subscribed) {
    msg += `┌─ 🔔 *اشتراک خودکار*\n`;
    msg += `└ ✅ *فعال* — قیمت هر ۳۰ دقیقه ویرایش می‌شود\n`;
  } else {
    msg += `┌─ 💡 *اشتراک خودکار*\n`;
    msg += `└ غیرفعال — با دکمه زیر فعال کن\n`;
  }
  msg += FOOTER;
  return msg;
}

// ============================================================
//  بخش ۱۰: Subscription
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
//  بخش ۱۱: Handlers
// ============================================================

async function respondWithRate(chatId, env, options = {}) {
  const { data } = await fetchHistory(env);
  const caption = buildPriceCaption(data);
  const price = data.latest?.price || data.latest?.price_toman;

  if (options.editMessageId) {
    const result = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: PRICE_KEYBOARD });
    if (result.ok && options.subscribe) await updateSubscriptionMessage(chatId, options.editMessageId, price, env);
    if (!result.ok && result.description?.includes("no caption")) {
      const textResult = await editMessage(chatId, options.editMessageId, caption, env, { replyMarkup: PRICE_KEYBOARD });
      if (textResult.ok && options.subscribe) await updateSubscriptionMessage(chatId, options.editMessageId, price, env);
      return textResult;
    }
    return result;
  }

  // send photo with fallback
  const photoResult = await sendPhoto(chatId, chartUrlFor("usd"), caption, env, { replyMarkup: PRICE_KEYBOARD });
  if (photoResult.ok) {
    if (photoResult.result?.message_id && options.subscribe) await subscribeUser(chatId, photoResult.result.message_id, price, env);
    return photoResult;
  }

  console.warn(`[rate] photo failed, fallback to text`);
  const textResult = await sendMessage(chatId, caption, env, { replyMarkup: PRICE_KEYBOARD });
  if (textResult.ok && textResult.result?.message_id && options.subscribe) await subscribeUser(chatId, textResult.result.message_id, price, env);
  return textResult;
}

async function respondWithAsset(chatId, env, assetKey, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildAssetCaption(assetKey, data);

  if (options.editMessageId) {
    const result = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    if (!result.ok && result.description?.includes("no caption")) {
      return editMessage(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    }
    return result;
  }

  const photoResult = await sendPhoto(chatId, chartUrlFor(assetKey), caption, env, { replyMarkup: BACK_KEYBOARD });
  if (photoResult.ok) return photoResult;
  return sendMessage(chatId, caption, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithAll(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildAllCaption(data);
  if (options.editMessageId) {
    const r = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    if (!r.ok && r.description?.includes("no caption")) return editMessage(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    return r;
  }
  const r = await sendPhoto(chatId, chartUrlFor("usd"), caption, env, { replyMarkup: BACK_KEYBOARD });
  if (r.ok) return r;
  return sendMessage(chatId, caption, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithCoins(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildCoinsCaption(data);
  if (options.editMessageId) {
    const r = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    if (!r.ok && r.description?.includes("no caption")) return editMessage(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    return r;
  }
  const r = await sendPhoto(chatId, chartUrlFor("coin_emami"), caption, env, { replyMarkup: BACK_KEYBOARD });
  if (r.ok) return r;
  return sendMessage(chatId, caption, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithGold(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildGoldCaption(data);
  if (options.editMessageId) {
    const r = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    if (!r.ok && r.description?.includes("no caption")) return editMessage(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    return r;
  }
  const r = await sendPhoto(chatId, chartUrlFor("gold_18k"), caption, env, { replyMarkup: BACK_KEYBOARD });
  if (r.ok) return r;
  return sendMessage(chatId, caption, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithCurrencies(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const caption = buildCurrenciesCaption(data);
  if (options.editMessageId) {
    const r = await editMessageCaption(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    if (!r.ok && r.description?.includes("no caption")) return editMessage(chatId, options.editMessageId, caption, env, { replyMarkup: BACK_KEYBOARD });
    return r;
  }
  const r = await sendPhoto(chatId, chartUrlFor("eur"), caption, env, { replyMarkup: BACK_KEYBOARD });
  if (r.ok) return r;
  return sendMessage(chatId, caption, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithOil(chatId, env, options = {}) {
  const { data } = await fetchMarket(env);
  const msg = buildOilCaption(data);
  if (options.editMessageId) return editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithHistory(chatId, env, days = 7, options = {}) {
  const { data } = await fetchHistory(env);
  const msg = buildHistoryMessage(data, days);
  if (options.editMessageId) return editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithStats(chatId, env, options = {}) {
  const { data } = await fetchHistory(env);
  const msg = buildStatsMessage(data);
  if (options.editMessageId) return editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithCompare(chatId, env, days = 30, options = {}) {
  const { data } = await fetchHistory(env);
  const msg = buildCompareMessage(data, days);
  if (options.editMessageId) return editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: BACK_KEYBOARD });
  return sendMessage(chatId, msg, env, { replyMarkup: BACK_KEYBOARD });
}

async function respondWithMenu(chatId, env, options = {}) {
  const subscribed = await isSubscribed(chatId, env);
  const msg = buildMenuMessage(subscribed);
  if (options.editMessageId) return editMessage(chatId, options.editMessageId, msg, env, { replyMarkup: MAIN_MENU_KEYBOARD });
  return sendMessage(chatId, msg, env, { replyMarkup: MAIN_MENU_KEYBOARD });
}

// ============================================================
//  بخش ۱۲: پردازش دستورات
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
    if (text === "/start" || text === "/menu") return respondWithMenu(chatId, env);

    if (text === "/help") {
      let msg = `📖 *راهنمای بات*\n━━━━━━━━━━━━━━━━━━━\n\n`;
      BOT_COMMANDS.forEach((c) => { msg += `/${c.command}\n   ${c.description}\n`; });
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
          `✅ *اشتراک فعال شد*\n\n` +
          `از این پس قیمت دلار هر ۳۰ دقیقه بررسی و در صورت تغییر، *همین پیام* ویرایش می‌شود.\n\n` +
          `🔕 لغو: /unsubscribe` + FOOTER, env);
      }
      return msg;
    }

    if (text === "/unsubscribe") {
      await unsubscribeUser(chatId, env);
      return sendMessage(chatId, `🔕 *اشتراک غیرفعال شد*\n\nدیگر پیام قیمت برایت ویرایش نمی‌شود.` + FOOTER, env, { replyMarkup: MAIN_MENU_KEYBOARD });
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

async function handleCallbackQuery(cb, env, ctx) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data || "";
  ctx.waitUntil(answerCallbackQuery(cb.id, env));

  try {
    if (!data.startsWith("cmd:")) return;
    const action = data.slice(4);

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
      case "convert":
        return editMessage(chatId, messageId,
          `🔄 *تبدیل دلار به تومان*\n\nدستور \`/convert <عدد>\` را بفرست.\n\nمثال: \`/convert 100\`` + FOOTER,
          env, { replyMarkup: BACK_KEYBOARD });
      default: return;
    }
  } catch (err) { console.error(`[callback] ERROR: ${err.message}`); }
}

// ============================================================
//  بخش ۱۳: Webhook
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
//  بخش ۱۴: Cron
// ============================================================

async function handleScheduled(controller, env, ctx) {
  console.log(`[cron] ${controller.cron}`);
  if (!env.RATE_KV) return;

  try {
    const { data } = await fetchHistory(env);
    const newPrice = data.latest?.price || data.latest?.price_toman;
    const list = await env.RATE_KV.list({ prefix: KV_SUB_PREFIX });

    let edited = 0, deleted = 0, skipped = 0;
    for (const key of list.keys) {
      const sub = await env.RATE_KV.get(key.name, "json");
      if (!sub) continue;
      if (sub.last_price === newPrice) { skipped++; continue; }

      const caption = buildPriceCaption(data);
      try {
        let result = await editMessageCaption(sub.chat_id, sub.message_id, caption, env, { replyMarkup: PRICE_KEYBOARD });
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
      } catch (err) { console.error(`[cron] ${sub.chat_id}: ${err.message}`); }
      await sleep(50);
    }
    console.log(`[cron] Edited: ${edited}, Deleted: ${deleted}, Skipped: ${skipped}`);
  } catch (err) { console.error(`[cron] Fatal: ${err.message}`); }
}

// ============================================================
//  بخش ۱۵: Setup & Router
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
