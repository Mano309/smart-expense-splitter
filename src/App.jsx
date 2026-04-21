import { useEffect, useState } from "react";

async function askAI(systemPrompt, userPrompt) {
  try {
    // Expects an optional serverless proxy (recommended for deployed builds).
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, userPrompt }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    if (typeof data?.text === "string") return data.text.trim();
    return data.content?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

function smartCategoryFromText(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return "other";
  if (/(food|dinner|lunch|breakfast|cafe|coffee|restaurant|snack|pizza|meal)/.test(t)) return "food";
  if (/(uber|ola|taxi|flight|bus|train|fuel|petrol|diesel|trip|travel|metro)/.test(t)) return "travel";
  if (/(rent|room|hostel|apartment|stay|hotel|airbnb|accommodation)/.test(t)) return "rent";
  if (/(movie|game|party|concert|netflix|entertainment|tickets)/.test(t)) return "entertainment";
  if (/(shop|shopping|clothes|grocery|amazon|flipkart|mart)/.test(t)) return "shopping";
  if (/(electric|water|wifi|internet|bill|utility|gas)/.test(t)) return "utilities";
  if (/(doctor|medicine|hospital|pharmacy|health|clinic)/.test(t)) return "health";
  return "other";
}

function fallbackInsights(group, balances, total, settlements) {
  const insights = [];
  const byCat = {};
  group.expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const [cat, amt] = topCat;
    const pct = total ? (amt / total) * 100 : 0;
    insights.push(`${CATEGORIES[cat]?.label || "Other"} is the top spend at Rs ${amt.toFixed(0)} (${pct.toFixed(0)}% of total).`);
  }
  const balArr = Object.entries(balances);
  const creditor = balArr.filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1])[0];
  const debtor = balArr.filter(([, v]) => v < -0.01).sort((a, b) => a[1] - b[1])[0];
  if (creditor && debtor) {
    insights.push(`${creditor[0]} should receive about Rs ${creditor[1].toFixed(0)}, while ${debtor[0]} owes about Rs ${Math.abs(debtor[1]).toFixed(0)}.`);
  }
  insights.push(
    settlements.length === 0
      ? "Group is fully settled right now. No pending transfers needed."
      : `${settlements.length} payment${settlements.length > 1 ? "s" : ""} can settle everyone with minimal transactions.`
  );
  return insights.slice(0, 3);
}

const CATEGORIES = {
  food:          { label: "Food & Dining",  icon: "🍽️", color: "#f59e0b" },
  travel:        { label: "Travel",         icon: "✈️", color: "#3b82f6" },
  rent:          { label: "Rent/Housing",   icon: "🏠", color: "#8b5cf6" },
  entertainment: { label: "Entertainment",  icon: "🎬", color: "#ec4899" },
  shopping:      { label: "Shopping",       icon: "🛍️", color: "#06b6d4" },
  utilities:     { label: "Utilities",      icon: "💡", color: "#10b981" },
  health:        { label: "Health",         icon: "🏥", color: "#ef4444" },
  other:         { label: "Other",          icon: "📦", color: "#6b7280" },
};

const MEMBER_COLORS = ["#f87171","#fb923c","#facc15","#4ade80","#34d399","#60a5fa","#a78bfa","#f472b6"];
const GROUP_EMOJIS  = ["🏖️","🏠","✈️","🍕","🎉","💼","🎮","🌴","⚽","🎵","🧳","🏕️"];

function mColor(name, members) {
  return MEMBER_COLORS[members.indexOf(name) % MEMBER_COLORS.length];
}
function todayStr() { return new Date().toISOString().split("T")[0]; }

function computeAll(members, expenses) {
  const bal = {};
  members.forEach(m => bal[m] = 0);
  expenses.forEach(exp => {
    if (!exp.participants?.length) return;
    exp.participants.forEach(p => {
      const share = exp.splitType === "equal"
        ? exp.amount / exp.participants.length
        : (exp.customSplits?.[p] ?? 0);
      if (p !== exp.paidBy) { bal[p] -= share; bal[exp.paidBy] += share; }
    });
  });
  const pos = [], neg = [];
  Object.entries(bal).forEach(([name, amount]) => {
    if (amount > 0.009) pos.push({ name, amount });
    else if (amount < -0.009) neg.push({ name, amount: -amount });
  });
  pos.sort((a,b) => b.amount - a.amount);
  neg.sort((a,b) => b.amount - a.amount);
  const settlements = [];
  let i = 0, j = 0;
  while (i < pos.length && j < neg.length) {
    const amt = Math.min(pos[i].amount, neg[j].amount);
    settlements.push({ from: neg[j].name, to: pos[i].name, amount: amt });
    pos[i].amount -= amt; neg[j].amount -= amt;
    if (pos[i].amount < 0.01) i++;
    if (neg[j].amount < 0.01) j++;
  }
  return { balances: bal, settlements };
}

const SEED = [{
  id:"g1", name:"Goa Trip", emoji:"🏖️",
  members:["Alice","Bob","Carol","Dave"],
  createdAt:"2026-04-15",
  expenses:[
    {id:"e1",name:"Hotel (3 nights)",amount:9600,paidBy:"Alice",participants:["Alice","Bob","Carol","Dave"],category:"rent",splitType:"equal",customSplits:{},date:"2026-04-15",note:"Sea-view room"},
    {id:"e2",name:"Airport taxi",amount:1200,paidBy:"Bob",participants:["Alice","Bob","Carol","Dave"],category:"travel",splitType:"equal",customSplits:{},date:"2026-04-15",note:""},
    {id:"e3",name:"Beach dinner",amount:3600,paidBy:"Carol",participants:["Alice","Bob","Carol","Dave"],category:"food",splitType:"equal",customSplits:{},date:"2026-04-16",note:"Seafood place"},
    {id:"e4",name:"Scooter rental",amount:1600,paidBy:"Dave",participants:["Carol","Dave"],category:"travel",splitType:"equal",customSplits:{},date:"2026-04-16",note:"2 scooters"},
    {id:"e5",name:"Snorkeling trip",amount:2000,paidBy:"Alice",participants:["Alice","Bob","Carol","Dave"],category:"entertainment",splitType:"equal",customSplits:{},date:"2026-04-17",note:""},
  ]
}];

const S = `
@import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f5f3ef;--bg2:#edeae4;--surface:#fff;--border:#ddd9d0;--border2:#c9c4ba;
  --text:#1a1814;--muted:#7a7568;--accent:#1a1814;--lime:#c8f135;--orange:#ff6b35;
  --green:#16a34a;--red:#dc2626;--blue:#2563eb;
  --r:12px;--font:'Cabinet Grotesk',sans-serif;--mono:'JetBrains Mono',monospace;
  --sh:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);
}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:15px;line-height:1.5}
.app{min-height:100vh;display:flex;flex-direction:column}
/* topbar */
.topbar{height:54px;background:var(--accent);color:var(--lime);display:flex;align-items:center;padding:0 20px;gap:12px;position:sticky;top:0;z-index:300}
.logo{font-size:18px;font-weight:900;letter-spacing:-.5px;display:flex;align-items:center;gap:8px}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--lime)}
.logo-sub{font-size:12px;font-weight:500;opacity:.55;color:var(--lime);margin-left:2px}
.tb-spacer{flex:1}
.ai-badge{background:var(--lime);color:var(--accent);font-size:11px;font-weight:800;padding:4px 10px;border-radius:99px;letter-spacing:.5px}
/* shell */
.shell{display:flex;flex:1;height:calc(100vh - 54px);overflow:hidden}
/* sidebar */
.sidebar{width:252px;min-width:252px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.sb-head{padding:14px 14px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.sb-title{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)}
.sb-scroll{flex:1;overflow-y:auto;padding:6px}
.g-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;transition:background .12s;border:1.5px solid transparent;margin-bottom:2px}
.g-item:hover{background:var(--bg2)}
.g-item.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.g-item.active .g-sub,.g-item.active .g-cnt{color:rgba(255,255,255,.5)}
.g-emoji{font-size:22px;flex-shrink:0}
.g-inf{flex:1;min-width:0}
.g-name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.g-sub{font-size:11px;color:var(--muted)}
.g-cnt{font-family:var(--mono);font-size:12px;color:var(--muted)}
.sb-foot{padding:10px;border-top:1px solid var(--border)}
.btn-newg{width:100%;padding:10px;background:var(--lime);color:var(--accent);border:none;border-radius:8px;font-family:var(--font);font-size:13px;font-weight:800;cursor:pointer;transition:opacity .15s,transform .1s}
.btn-newg:hover{opacity:.85;transform:translateY(-1px)}
/* content */
.content{flex:1;overflow-y:auto;background:var(--bg)}
.inner{max-width:880px;margin:0 auto;padding:24px 28px}
/* group header card */
.gh{display:flex;align-items:flex-start;gap:18px;margin-bottom:20px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 22px;box-shadow:var(--sh)}
.gh-em{font-size:46px;flex-shrink:0;line-height:1}
.gh-inf{flex:1}
.gh-name{font-size:24px;font-weight:900;letter-spacing:-.5px}
.gh-meta{font-size:12px;color:var(--muted);margin-top:3px}
.gh-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.m-pill{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;background:var(--bg2);border:1px solid var(--border)}
.m-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.gh-acts{display:flex;gap:8px;flex-shrink:0}
/* stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;box-shadow:var(--sh)}
.sv{font-size:22px;font-weight:900;font-family:var(--mono);letter-spacing:-1px}
.sl{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-top:2px}
/* tabs */
.tabs{display:flex;gap:2px;background:var(--border);border-radius:10px;padding:3px;margin-bottom:18px}
.tab{flex:1;padding:8px 10px;border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:700;color:var(--muted);border-radius:7px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:5px}
.tab.on{background:var(--surface);color:var(--text);box-shadow:var(--sh)}
/* card */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh);margin-bottom:14px}
.ch{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)}
.ct{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)}
/* expense item */
.ei{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border);transition:background .1s;animation:fs .2s ease}
.ei:last-child{border-bottom:none}
.ei:hover{background:var(--bg)}
@keyframes fs{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.cat-ic{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.em{flex:1;min-width:0}
.en{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ed{font-size:12px;color:var(--muted);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}
.etag{padding:1px 6px;border-radius:4px;background:var(--bg2);font-size:11px;font-weight:600}
.er{display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.ea{font-size:15px;font-weight:900;font-family:var(--mono)}
.esh{font-size:11px;color:var(--muted);font-family:var(--mono)}
.del-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:15px;padding:3px;transition:color .15s}
.del-btn:hover{color:var(--red)}
/* balances */
.br{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border)}
.br:last-child{border-bottom:none}
.bav{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0}
.bn{font-size:14px;font-weight:700;flex:1}
.bbt{width:110px}
.bbtr{height:6px;background:var(--bg2);border-radius:99px;overflow:hidden}
.bbf{height:100%;border-radius:99px;transition:width .5s cubic-bezier(.34,1.56,.64,1)}
.bam{font-family:var(--mono);font-size:14px;font-weight:700;min-width:80px;text-align:right}
.bs{font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;margin-left:6px}
.sp{background:#dcfce7;color:var(--green)}
.sn{background:#fee2e2;color:var(--red)}
.sz{background:var(--bg2);color:var(--muted)}
/* settlements */
.si{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid var(--border)}
.si:last-child{border-bottom:none}
.sav{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0}
.snames{flex:1;display:flex;align-items:center;gap:8px}
.sarr{font-size:16px;color:var(--muted)}
.sfr{font-size:14px;font-weight:700;color:var(--red)}
.sto{font-size:14px;font-weight:700;color:var(--green)}
.samt{font-family:var(--mono);font-size:16px;font-weight:900;color:var(--orange)}
.all-ok{text-align:center;padding:40px 20px;display:flex;flex-direction:column;align-items:center;gap:8px}
.all-ok .big{font-size:48px}
.all-ok p{font-size:15px;font-weight:700;color:var(--green)}
/* analytics */
.agrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.barrow{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.bl{font-size:12px;color:var(--muted);min-width:96px;text-align:right;font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt{flex:1;height:10px;background:var(--bg2);border-radius:99px;overflow:hidden}
.bf{height:100%;border-radius:99px;transition:width .7s cubic-bezier(.34,1.56,.64,1)}
.bv{font-size:12px;font-family:var(--mono);font-weight:600;min-width:68px;text-align:right}
/* ai panel */
.ai-panel{background:var(--accent);border-radius:var(--r);padding:20px;margin-bottom:14px;position:relative;overflow:hidden}
.ai-panel::before{content:'';position:absolute;top:-40px;right:-40px;width:150px;height:150px;border-radius:50%;background:rgba(200,241,53,.07)}
.ai-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.ai-title{font-size:14px;font-weight:800;color:var(--lime);letter-spacing:.5px}
.ai-dot{width:8px;height:8px;border-radius:50%;background:var(--lime);animation:blink 1.5s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.ai-btn{margin-left:auto;padding:7px 16px;background:var(--lime);border:none;border-radius:8px;font-family:var(--font);font-size:12px;font-weight:800;cursor:pointer;transition:opacity .15s,transform .1s;color:var(--accent)}
.ai-btn:hover:not(:disabled){opacity:.85;transform:translateY(-1px)}
.ai-btn:disabled{opacity:.4;cursor:not-allowed}
.ai-ins{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-left:3px solid var(--lime);border-radius:8px;padding:11px 14px;margin-bottom:8px;font-size:13px;color:rgba(255,255,255,.9);line-height:1.6;animation:fs .3s ease}
.ai-ld{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.5);font-size:13px}
.spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--lime);border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.ai-ph{color:rgba(255,255,255,.4);font-size:13px;line-height:1.6}
/* buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;border:none;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap}
.btn:hover:not(:disabled){transform:translateY(-1px)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}
.bp{background:var(--accent);color:#fff}
.bp:hover:not(:disabled){background:#333}
.bl2{background:var(--lime);color:var(--accent)}
.bg2{background:var(--bg2);color:var(--text);border:1px solid var(--border)}
.bg2:hover:not(:disabled){border-color:var(--border2)}
.bsm{padding:6px 12px;font-size:12px}
/* overlay/modal */
.ov{position:fixed;inset:0;z-index:500;background:rgba(26,24,20,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fdi .15s}
@keyframes fdi{from{opacity:0}to{opacity:1}}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;padding:26px;box-shadow:0 8px 32px rgba(0,0,0,.12);animation:su .2s ease}
@keyframes su{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
.mt{font-size:22px;font-weight:900;letter-spacing:-.5px;margin-bottom:18px}
.mf{display:flex;gap:8px;margin-top:20px}
.mf .btn{flex:1;justify-content:center}
/* form */
.fg{margin-bottom:14px}
.fl{display:block;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
input[type=text],input[type=number],input[type=date],select,textarea{width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:9px 12px;font-family:var(--font);font-size:14px;color:var(--text);outline:none;transition:border-color .15s}
input:focus,select:focus{border-color:var(--accent)}
input::placeholder{color:var(--muted)}
select option{background:var(--surface)}
.ir{display:flex;gap:8px}
.ir input{flex:1}
/* pill checkboxes */
.pg{display:flex;flex-wrap:wrap;gap:6px}
.pc{display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:99px;border:1.5px solid var(--border);background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;transition:all .12s;user-select:none}
.pc.on{border-color:var(--accent);background:var(--accent);color:#fff}
.pc input{display:none}
/* split tabs */
.stabs{display:flex;gap:4px}
.stab{flex:1;padding:9px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;color:var(--muted);text-align:center}
.stab.on{border-color:var(--accent);background:var(--accent);color:#fff}
/* cat grid */
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.ct2{padding:7px 3px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;transition:all .12s;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px}
.ct2.on{border-color:var(--accent);background:var(--accent);color:#fff}
.ci{font-size:19px}
.cl2{font-size:10px;font-weight:700}
/* emoji row */
.er2{display:flex;flex-wrap:wrap;gap:5px}
.eo{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:21px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;transition:all .12s}
.eo.on{border-color:var(--accent);background:rgba(26,24,20,.08)}
/* custom split */
.ctable{width:100%;border-collapse:collapse}
.ctable td{padding:5px 0;font-size:13px}
.ctable td:first-child{padding-right:10px;font-weight:600;width:38%}
.ctable input{padding:6px 9px;font-size:13px}
.csm{font-size:12px;margin-top:5px;font-family:var(--mono)}
/* info note */
.note{font-size:12px;color:var(--muted);padding:9px 12px;background:var(--bg2);border-radius:8px;margin-top:6px;line-height:1.5}
/* empty */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:10px;color:var(--muted)}
.empty-ic{font-size:52px;opacity:.4}
.empty h3{font-size:18px;font-weight:800;color:var(--text)}
.empty p{font-size:13px}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
`;

export default function App() {
  const [groups, setGroups] = useState(() => {
    try {
      const saved = localStorage.getItem("split-ease-groups-v1");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED;
    } catch {
      return SEED;
    }
  });
  const [activeId, setActiveId] = useState("g1");
  const [tab, setTab] = useState("expenses");
  const [showNG, setShowNG] = useState(false);
  const [showNE, setShowNE] = useState(false);
  const [showAM, setShowAM] = useState(false);
  const [aiIns, setAiIns] = useState([]);
  const [aiLoad, setAiLoad] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("split-ease-groups-v1", JSON.stringify(groups));
    } catch {
      // Ignore storage quota or private browsing errors.
    }
  }, [groups]);

  useEffect(() => {
    if (!groups.some((g) => g.id === activeId)) {
      setActiveId(groups[0]?.id || "");
    }
  }, [groups, activeId]);

  const group = groups.find(g => g.id === activeId) || null;
  const { balances, settlements } = group
    ? computeAll(group.members, group.expenses)
    : { balances:{}, settlements:[] };

  const total = group?.expenses.reduce((s,e)=>s+e.amount,0)||0;
  const avg = group?.members.length ? total/group.members.length : 0;

  const catBD = {};
  group?.expenses.forEach(e=>{ catBD[e.category]=(catBD[e.category]||0)+e.amount; });

  const mPaid = {};
  group?.members.forEach(m=>{ mPaid[m]=0; });
  group?.expenses.forEach(e=>{ if(mPaid[e.paidBy]!==undefined) mPaid[e.paidBy]+=e.amount; });

  function mutG(id, fn) { setGroups(gs=>gs.map(g=>g.id===id?fn(g):g)); }

  function switchG(id) { setActiveId(id); setAiIns([]); setTab("expenses"); }

  async function genInsights() {
    if(!group||group.expenses.length===0) return;
    setAiLoad(true); setAiIns([]);
    const expStr = group.expenses.map(e=>`"${e.name}" ₹${e.amount} [${e.category}] paid by ${e.paidBy}, split among ${e.participants.join(",")}`).join("; ");
    const balStr = Object.entries(balances).map(([k,v])=>`${k}:₹${v.toFixed(0)}`).join(", ");
    const text = await askAI(
      "You are a smart group expense analyst. Return ONLY a valid JSON array of exactly 3 short insightful strings. No markdown.",
      `Group "${group.name}". Members: ${group.members.join(",")}. Expenses: ${expStr}. Balances: ${balStr}. Total: ₹${total}. Give 3 concise insights mentioning real names and amounts.`
    );
    try {
      const arr = JSON.parse(text.replace(/```json|```/g,"").trim());
      if (Array.isArray(arr) && arr.length > 0) {
        setAiIns(arr.map((x) => String(x)).slice(0, 3));
      } else {
        setAiIns(fallbackInsights(group, balances, total, settlements));
      }
    } catch {
      setAiIns(fallbackInsights(group, balances, total, settlements));
    }
    setAiLoad(false);
  }

  return (
    <>
      <style>{S}</style>
      <div className="app">
        <div className="topbar">
          <div className="logo">
            <span className="logo-dot"/>
            SplitEase
            <span className="logo-sub">Smart Expense Splitter</span>
          </div>
          <div className="tb-spacer"/>
          <div className="ai-badge">✦ AI Powered</div>
        </div>

        <div className="shell">
          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="sb-head">
              <span className="sb-title">Groups</span>
            </div>
            <div className="sb-scroll">
              {groups.map(g=>(
                <div key={g.id} className={`g-item ${g.id===activeId?"active":""}`} onClick={()=>switchG(g.id)}>
                  <span className="g-emoji">{g.emoji}</span>
                  <div className="g-inf">
                    <div className="g-name">{g.name}</div>
                    <div className="g-sub">{g.members.length} members</div>
                  </div>
                  <span className="g-cnt">{g.expenses.length}</span>
                </div>
              ))}
            </div>
            <div className="sb-foot">
              <button className="btn-newg" onClick={()=>setShowNG(true)}>+ New Group</button>
            </div>
          </div>

          {/* CONTENT */}
          <div className="content">
            <div className="inner">
              {!group ? (
                <div className="empty">
                  <div className="empty-ic">💸</div>
                  <h3>No group selected</h3>
                  <p>Create a group to start splitting expenses</p>
                  <button className="btn bl2" style={{marginTop:8}} onClick={()=>setShowNG(true)}>+ Create Group</button>
                </div>
              ) : (
                <>
                  {/* GROUP HEADER */}
                  <div className="gh">
                    <div className="gh-em">{group.emoji}</div>
                    <div className="gh-inf">
                      <div className="gh-name">{group.name}</div>
                      <div className="gh-meta">Created {group.createdAt} · {group.expenses.length} expenses</div>
                      <div className="gh-pills">
                        {group.members.map(m=>(
                          <div className="m-pill" key={m}>
                            <span className="m-dot" style={{background:mColor(m,group.members)}}/>
                            {m}
                          </div>
                        ))}
                        <div className="m-pill" style={{cursor:"pointer",border:"1.5px dashed var(--border2)"}} onClick={()=>setShowAM(true)}>
                          + Add Member
                        </div>
                      </div>
                    </div>
                    <div className="gh-acts">
                      <button className="btn bp" onClick={()=>setShowNE(true)}>+ Add Expense</button>
                    </div>
                  </div>

                  {/* STATS */}
                  <div className="stats">
                    <div className="stat"><div className="sv">₹{total.toLocaleString("en-IN")}</div><div className="sl">Total Spent</div></div>
                    <div className="stat"><div className="sv">₹{avg.toFixed(0)}</div><div className="sl">Per Person</div></div>
                    <div className="stat"><div className="sv">{group.expenses.length}</div><div className="sl">Expenses</div></div>
                    <div className="stat">
                      <div className="sv" style={{color:settlements.length===0?"var(--green)":"var(--orange)"}}>{settlements.length}</div>
                      <div className="sl">Settlements</div>
                    </div>
                  </div>

                  {/* TABS */}
                  <div className="tabs">
                    {[
                      {id:"expenses",   label:"Expenses",   icon:"📋"},
                      {id:"balances",   label:"Balances",   icon:"⚖️"},
                      {id:"settlements",label:"Settle Up",  icon:"✅"},
                      {id:"analytics",  label:"Analytics",  icon:"📊"},
                    ].map(t=>(
                      <button key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {/* ── EXPENSES ── */}
                  {tab==="expenses" && (
                    <div className="card">
                      <div className="ch">
                        <span className="ct">All Expenses</span>
                        <button className="btn bl2 bsm" onClick={()=>setShowNE(true)}>+ Add</button>
                      </div>
                      {group.expenses.length===0 ? (
                        <div style={{padding:"36px 18px",textAlign:"center",color:"var(--muted)"}}>
                          No expenses yet. Click "+ Add Expense" to get started!
                        </div>
                      ) : [...group.expenses].reverse().map(exp=>{
                        const cat=CATEGORIES[exp.category]||CATEGORIES.other;
                        const perHead=exp.splitType==="equal"?exp.amount/exp.participants.length:null;
                        return (
                          <div className="ei" key={exp.id}>
                            <div className="cat-ic" style={{background:cat.color+"20"}}>{cat.icon}</div>
                            <div className="em">
                              <div className="en">{exp.name}</div>
                              <div className="ed">
                                <span>Paid by <b>{exp.paidBy}</b></span>
                                <span className="etag" style={{background:cat.color+"18",color:cat.color}}>{cat.label}</span>
                                <span>{exp.participants.length} people</span>
                                <span>{exp.date}</span>
                                {exp.note&&<span style={{fontStyle:"italic"}}>"{exp.note}"</span>}
                              </div>
                            </div>
                            <div className="er">
                              <div className="ea">₹{exp.amount.toLocaleString("en-IN")}</div>
                              {perHead&&<div className="esh">₹{perHead.toFixed(0)}/ea</div>}
                              <button className="del-btn" onClick={()=>mutG(activeId,g=>({...g,expenses:g.expenses.filter(e=>e.id!==exp.id)}))} title="Remove">✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── BALANCES ── */}
                  {tab==="balances" && (
                    <div className="card">
                      <div className="ch">
                        <span className="ct">Member Balances</span>
                        <span style={{fontSize:12,color:"var(--muted)"}}>+ gets back · − owes</span>
                      </div>
                      {group.members.map(m=>{
                        const bal=balances[m]||0;
                        const mx=Math.max(...Object.values(balances).map(Math.abs),1);
                        const pct=Math.abs(bal)/mx*100;
                        return (
                          <div className="br" key={m}>
                            <div className="bav" style={{background:mColor(m,group.members)}}>{m[0].toUpperCase()}</div>
                            <div className="bn">{m}</div>
                            <div className="bbt">
                              <div className="bbtr">
                                <div className="bbf" style={{width:`${pct}%`,background:bal>0.01?"var(--green)":bal<-0.01?"var(--red)":"var(--muted)"}}/>
                              </div>
                            </div>
                            <div className="bam" style={{color:bal>0.01?"var(--green)":bal<-0.01?"var(--red)":"var(--muted)"}}>
                              {bal>0.01?`+₹${bal.toFixed(0)}`:bal<-0.01?`-₹${Math.abs(bal).toFixed(0)}`:"₹0"}
                            </div>
                            <span className={`bs ${bal>0.01?"sp":bal<-0.01?"sn":"sz"}`}>
                              {bal>0.01?"Gets back":bal<-0.01?"Owes":"Settled"}
                            </span>
                          </div>
                        );
                      })}
                      <div style={{padding:"10px 18px",background:"var(--bg)",borderTop:"1px solid var(--border)",fontSize:12,color:"var(--muted)"}}>
                        Balances are recalculated in real-time as you add or remove expenses.
                      </div>
                    </div>
                  )}

                  {/* ── SETTLE UP ── */}
                  {tab==="settlements" && (
                    <div className="card">
                      <div className="ch">
                        <span className="ct">Settlement Plan</span>
                        <span style={{fontSize:12,color:"var(--muted)"}}>Minimum transactions</span>
                      </div>
                      {settlements.length===0 ? (
                        <div className="all-ok">
                          <div className="big">🎉</div>
                          <p>Everyone is settled up!</p>
                          <small style={{color:"var(--muted)",fontSize:13}}>No payments needed right now.</small>
                        </div>
                      ) : settlements.map((s,i)=>(
                        <div className="si" key={i}>
                          <div className="sav" style={{background:mColor(s.from,group.members)}}>{s.from[0]}</div>
                          <div className="snames">
                            <span className="sfr">{s.from}</span>
                            <span className="sarr">pays →</span>
                            <div className="sav" style={{background:mColor(s.to,group.members)}}>{s.to[0]}</div>
                            <span className="sto">{s.to}</span>
                          </div>
                          <div className="samt">₹{s.amount.toFixed(0)}</div>
                        </div>
                      ))}
                      {settlements.length>0&&(
                        <div style={{padding:"10px 18px",background:"var(--bg)",borderTop:"1px solid var(--border)",fontSize:12,color:"var(--muted)"}}>
                          {settlements.length} payment{settlements.length>1?"s":""} to settle all debts. Uses minimum-transactions algorithm.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ANALYTICS ── */}
                  {tab==="analytics" && (
                    <>
                      <div className="agrid">
                        {/* by category - full width */}
                        <div className="card" style={{gridColumn:"1/-1"}}>
                          <div className="ch"><span className="ct">Spending by Category</span></div>
                          <div style={{padding:"14px 18px"}}>
                            {Object.keys(catBD).length===0 ? (
                              <span style={{color:"var(--muted)",fontSize:13}}>No expenses yet.</span>
                            ) : Object.entries(catBD).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
                              const c=CATEGORIES[cat]||CATEGORIES.other;
                              const pct=total?amt/total*100:0;
                              return (
                                <div className="barrow" key={cat}>
                                  <div className="bl">{c.icon} {c.label}</div>
                                  <div className="bt"><div className="bf" style={{width:`${pct}%`,background:c.color}}/></div>
                                  <div className="bv">₹{amt.toLocaleString("en-IN")} <span style={{color:"var(--muted)"}}>{pct.toFixed(0)}%</span></div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* paid by member */}
                        <div className="card">
                          <div className="ch"><span className="ct">Amount Paid</span></div>
                          <div style={{padding:"14px 18px"}}>
                            {group.members.map(m=>{
                              const paid=mPaid[m]||0;
                              const pct=total?paid/total*100:0;
                              return (
                                <div className="barrow" key={m}>
                                  <div className="bl">{m}</div>
                                  <div className="bt"><div className="bf" style={{width:`${pct}%`,background:mColor(m,group.members)}}/></div>
                                  <div className="bv">₹{paid.toLocaleString("en-IN")}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* net balances chart */}
                        <div className="card">
                          <div className="ch"><span className="ct">Net Balances</span></div>
                          <div style={{padding:"14px 18px"}}>
                            {group.members.map(m=>{
                              const bal=balances[m]||0;
                              const mx=Math.max(...Object.values(balances).map(v=>Math.abs(v)),1);
                              const pct=Math.abs(bal)/mx*100;
                              return (
                                <div className="barrow" key={m}>
                                  <div className="bl">{m}</div>
                                  <div className="bt"><div className="bf" style={{width:`${pct}%`,background:bal>0?"var(--green)":bal<0?"var(--red)":"var(--muted)"}}/></div>
                                  <div className="bv" style={{color:bal>0?"var(--green)":bal<0?"var(--red)":"var(--muted)"}}>{bal>0?"+":""}₹{bal.toFixed(0)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* AI INSIGHTS */}
                      <div className="ai-panel">
                        <div className="ai-head">
                          <div className="ai-dot"/>
                          <div className="ai-title">AI Spending Insights</div>
                          <button className="ai-btn" onClick={genInsights} disabled={aiLoad||group.expenses.length===0}>
                            {aiLoad?"Analyzing…":"✦ Generate Insights"}
                          </button>
                        </div>
                        {aiLoad&&<div className="ai-ld"><div className="spin"/>Analyzing spending patterns…</div>}
                        {!aiLoad&&aiIns.length===0&&(
                          <div className="ai-ph">
                            Click "Generate Insights" to get AI-powered analysis: spending patterns, fairness insights, and tips — all personalized to your group's actual data.
                          </div>
                        )}
                        {aiIns.map((ins,i)=>(
                          <div className="ai-ins" key={i}>{ins}</div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNG && <NewGroupModal onClose={()=>setShowNG(false)} onCreate={g=>{setGroups(gs=>[...gs,g]);setActiveId(g.id);setTab("expenses");setAiIns([]);setShowNG(false);}}/>}
      {showNE && group && <NewExpenseModal members={group.members} onClose={()=>setShowNE(false)} onAdd={exp=>{mutG(activeId,g=>({...g,expenses:[...g.expenses,exp]}));setShowNE(false);}}/>}
      {showAM && group && <AddMemberModal existing={group.members} onClose={()=>setShowAM(false)} onAdd={name=>{mutG(activeId,g=>({...g,members:[...g.members,name]}));setShowAM(false);}}/>}
    </>
  );
}

function NewGroupModal({onClose,onCreate}) {
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("🎉");
  const [mi,setMi]=useState("");
  const [members,setMembers]=useState([]);
  function addM(){const n=mi.trim();if(n&&!members.includes(n)&&members.length<20){setMembers(m=>[...m,n]);setMi("");}}
  function doCreate(){if(!name.trim()||members.length<2)return;onCreate({id:"g"+Date.now(),name:name.trim(),emoji,members,expenses:[],createdAt:todayStr()});onClose();}
  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="mt">Create New Group</div>
        <div className="fg"><label className="fl">Group Name</label>
          <input type="text" value={name} placeholder="e.g. Weekend Getaway" onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doCreate()}/>
        </div>
        <div className="fg"><label className="fl">Emoji</label>
          <div className="er2">{GROUP_EMOJIS.map(em=>(
            <div key={em} className={`eo ${emoji===em?"on":""}`} onClick={()=>setEmoji(em)}>{em}</div>
          ))}</div>
        </div>
        <div className="fg"><label className="fl">Members (min. 2)</label>
          <div className="ir">
            <input type="text" value={mi} placeholder="Enter name" onChange={e=>setMi(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addM()}/>
            <button className="btn bg2" onClick={addM}>Add</button>
          </div>
          {members.length>0&&(
            <div className="pg" style={{marginTop:8}}>
              {members.map(m=>(
                <div key={m} className="pc on" style={{cursor:"pointer"}} onClick={()=>setMembers(ms=>ms.filter(x=>x!==m))}>
                  <span style={{background:MEMBER_COLORS[members.indexOf(m)%MEMBER_COLORS.length],width:7,height:7,borderRadius:"50%",display:"inline-block"}}/>
                  {m} ✕
                </div>
              ))}
            </div>
          )}
          <div className="note">Press Enter or click Add. Click a name to remove. At least 2 members required.</div>
        </div>
        <div className="mf">
          <button className="btn bg2" onClick={onClose}>Cancel</button>
          <button className="btn bp" onClick={doCreate} disabled={!name.trim()||members.length<2}>Create Group</button>
        </div>
      </div>
    </div>
  );
}

function NewExpenseModal({members,onClose,onAdd}) {
  const [name,setName]=useState("");
  const [amount,setAmount]=useState("");
  const [paidBy,setPaidBy]=useState(members[0]||"");
  const [category,setCategory]=useState("food");
  const [participants,setParticipants]=useState([...members]);
  const [splitType,setSplitType]=useState("equal");
  const [customSplits,setCustomSplits]=useState({});
  const [date,setDate]=useState(todayStr());
  const [note,setNote]=useState("");
  const [aiCL,setAiCL]=useState(false);

  async function autoCat(){
    if(!name.trim())return;
    setAiCL(true);
    const r=await askAI("Return ONLY one word from: food,travel,rent,entertainment,shopping,utilities,health,other. No explanation.","Categorize expense: \""+name+"\"");
    const c=r.toLowerCase().trim();
    if(CATEGORIES[c]) setCategory(c);
    else setCategory(smartCategoryFromText(name));
    setAiCL(false);
  }

  function toggleP(m){setParticipants(ps=>ps.includes(m)?ps.filter(x=>x!==m):[...ps,m]);}

  const amtN=parseFloat(amount)||0;
  const custTot=participants.reduce((s,p)=>s+(parseFloat(customSplits[p])||0),0);
  const custValidNonNegative=participants.every(p=>(parseFloat(customSplits[p])||0)>=0);
  const custOk=splitType==="equal"||(Math.abs(custTot-amtN)<0.01&&custValidNonNegative);

  function doAdd(){
    if(!name.trim()||amtN<=0||participants.length===0||!custOk)return;
    onAdd({id:"exp"+Date.now(),name:name.trim(),amount:amtN,paidBy,participants,category,splitType,customSplits:splitType==="custom"?customSplits:{},date,note:note.trim()});
  }

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="mt">Add Expense</div>
        <div className="fg"><label className="fl">Description</label>
          <div className="ir">
            <input type="text" value={name} placeholder="e.g. Dinner at restaurant" onChange={e=>setName(e.target.value)}/>
            <button className="btn bg2 bsm" onClick={autoCat} disabled={!name.trim()||aiCL} title="AI auto-detect category">{aiCL?"…":"✦ AI Cat."}</button>
          </div>
        </div>
        <div className="fg"><label className="fl">Amount (₹)</label>
          <input type="number" value={amount} placeholder="0.00" min="0" step="0.01" onChange={e=>setAmount(e.target.value)}/>
        </div>
        <div className="fg"><label className="fl">Paid By</label>
          <select value={paidBy} onChange={e=>setPaidBy(e.target.value)}>
            {members.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">Category {aiCL&&<span style={{fontStyle:"italic",fontWeight:400}}>(detecting…)</span>}</label>
          <div className="cg">
            {Object.entries(CATEGORIES).map(([key,cat])=>(
              <div key={key} className={`ct2 ${category===key?"on":""}`} onClick={()=>setCategory(key)}
                style={category===key?{background:cat.color,borderColor:cat.color}:{}}>
                <span className="ci">{cat.icon}</span>
                <span className="cl2">{cat.label.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="fg"><label className="fl">Split Among</label>
          <div className="pg">
            {members.map(m=>(
              <label key={m} className={`pc ${participants.includes(m)?"on":""}`}>
                <input type="checkbox" checked={participants.includes(m)} onChange={()=>toggleP(m)}/>{m}
              </label>
            ))}
          </div>
        </div>
        <div className="fg"><label className="fl">Split Method</label>
          <div className="stabs">
            <div className={`stab ${splitType==="equal"?"on":""}`} onClick={()=>setSplitType("equal")}>⚖️ Split Equally</div>
            <div className={`stab ${splitType==="custom"?"on":""}`} onClick={()=>setSplitType("custom")}>✏️ Custom Amounts</div>
          </div>
        </div>
        {splitType==="custom"&&(
          <div className="fg"><label className="fl">Custom Amounts</label>
            <table className="ctable"><tbody>
              {participants.map(p=>(
                <tr key={p}><td>{p}</td><td>
                  <input type="number" min="0" step="0.01" placeholder="0"
                    value={customSplits[p]||""} onChange={e=>setCustomSplits(cs=>({...cs,[p]:e.target.value}))}/>
                </td></tr>
              ))}
            </tbody></table>
            <div className="csm" style={{color:custOk?"var(--green)":"var(--red)"}}>
              Total: ₹{custTot.toFixed(2)} / ₹{amtN.toFixed(2)} {custOk?"✓ Balanced":"⚠ Must match amount"}
            </div>
          </div>
        )}
        {splitType==="equal"&&participants.length>0&&amtN>0&&(
          <div className="note">Each person pays ₹{(amtN/participants.length).toFixed(2)}</div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:2}}>
          <div className="fg"><label className="fl">Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          </div>
          <div className="fg"><label className="fl">Note (optional)</label>
            <input type="text" value={note} placeholder="Any detail…" onChange={e=>setNote(e.target.value)}/>
          </div>
        </div>
        <div className="mf">
          <button className="btn bg2" onClick={onClose}>Cancel</button>
          <button className="btn bp" onClick={doAdd} disabled={!name.trim()||amtN<=0||participants.length===0||!custOk}>Add Expense</button>
        </div>
      </div>
    </div>
  );
}

function AddMemberModal({existing,onClose,onAdd}) {
  const [name,setName]=useState("");
  const valid=name.trim()&&!existing.includes(name.trim());
  return (
    <div className="ov" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
        <div className="mt">Add Member</div>
        <div className="fg"><label className="fl">Name</label>
          <input type="text" value={name} placeholder="Enter name" onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&valid&&onAdd(name.trim())} autoFocus/>
          {name.trim()&&existing.includes(name.trim())&&<div style={{color:"var(--red)",fontSize:12,marginTop:4}}>Member already exists.</div>}
        </div>
        <div className="mf">
          <button className="btn bg2" onClick={onClose}>Cancel</button>
          <button className="btn bp" disabled={!valid} onClick={()=>onAdd(name.trim())}>Add Member</button>
        </div>
      </div>
    </div>
  );
}
