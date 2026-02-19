import { useState, useEffect, useCallback } from "react";

// ── SUPABASE ──────────────────────────────────────────────
const SB_URL = "https://wboqmxtlumskqvdmrorv.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib3FteHRsdW1za3F2ZG1yb3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE3MjAsImV4cCI6MjA4NzAzNzcyMH0.6yJuYGRHk7aEKkkt_JMReY-Ewt_uaq1Y9kualj5KDs4";
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

const sGet = (t, q="") => fetch(`${SB_URL}/rest/v1/${t}${q?`?${q}`:""}`, { headers: H }).then(r => r.json());
const sPost = (t, b) => fetch(`${SB_URL}/rest/v1/${t}`, { method:"POST", headers:{...H, Prefer:"return=representation"}, body:JSON.stringify(b) }).then(r => r.json());
const sPatch = (t, f, b) => fetch(`${SB_URL}/rest/v1/${t}?${f}`, { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body:JSON.stringify(b) }).then(r => r.json());
const sDel = (t, f) => fetch(`${SB_URL}/rest/v1/${t}?${f}`, { method:"DELETE", headers: H });

// ── DATA MAPPING ─────────────────────────────────────────
const dbToLink = r => ({ id:r.id, pmId:r.pm_id, pmName:r.pm_name, accId:r.acc_id, client:r.client, username:r.username, url:r.url, likes:r.likes||0, date:r.date, postDate:r.post_date, manualDateUsed:r.manual_date_used, status:r.status, duplicate:r.duplicate, promotedFromDraft:r.promoted_from_draft, promotedAt:r.promoted_at });
const linkToDb = l => ({ id:l.id, pm_id:l.pmId, pm_name:l.pmName, acc_id:l.accId, client:l.client, username:l.username, url:l.url, likes:l.likes||0, date:l.date, post_date:l.postDate||null, manual_date_used:l.manualDateUsed||false, status:l.status, duplicate:l.duplicate||false, promoted_from_draft:l.promotedFromDraft||false, promoted_at:l.promotedAt||null });
const updToDb = u => { const m={pmId:"pm_id",pmName:"pm_name",accId:"acc_id",postDate:"post_date",manualDateUsed:"manual_date_used",promotedFromDraft:"promoted_from_draft",promotedAt:"promoted_at"}; return Object.fromEntries(Object.entries(u).map(([k,v])=>[m[k]||k,v])); };

// ── SEED DATA ─────────────────────────────────────────────
const DEFAULT_PMS = [
  { id:"aava", name:"Aava", accounts:[
    {id:"a1",client:"Hook",username:"aava.hook"},{id:"a2",client:"Tea",username:"fbigirlboss444"},
    {id:"a3",client:"Spec",username:"aava.spec"},{id:"a4",client:"Aava",username:"aava.comet"},
    {id:"a5",client:"Tea",username:"avadates"},{id:"a6",client:"Figma",username:"celebwaava"},
    {id:"a7",client:"GeniesWeb",username:"genies_chat"},{id:"a8",client:"Genies",username:"aavassim"},
  ]},
  { id:"cam", name:"Cam", accounts:[
    {id:"c1",client:"Genies App",username:"camthegpt"},{id:"c2",client:"Dream Body",username:"chadbria"},
    {id:"c3",client:"Tea",username:"beware.of.boy"},{id:"c4",client:"Genies Web",username:"masonvale_lover23"},
    {id:"c5",client:"Hook",username:"theradioheadgirl"},{id:"c6",client:"Figma",username:"makewithcam"},
  ]},
  { id:"ushni", name:"Ushni", accounts:[
    {id:"u1",client:"Figma",username:"ushstyles"},{id:"u2",client:"Convo",username:"hpwithush"},
    {id:"u3",client:"Figma",username:"scrapbookapp"},{id:"u4",client:"Spec",username:"ushspec"},
    {id:"u5",client:"Figma",username:"crimewush"},{id:"u6",client:"Tea",username:"datingginnyc"},
    {id:"u7",client:"Playful",username:"judeduarteloverx"},
  ]},
  { id:"almond", name:"Almond", accounts:[
    {id:"al1",client:"Jabali",username:"girlsgogames2.0"},{id:"al2",client:"SimZ",username:"simz.games"},
    {id:"al3",client:"Figma Slides",username:"gaminggossip"},{id:"al4",client:"Figma Make",username:"appsbyalmond"},
    {id:"al5",client:"Figma Make",username:"kepttracks.app"},{id:"al6",client:"Playful",username:"almond.designs4"},
  ]},
];

const TABS = ["Log Links", "Drafts", "Manage Accounts", "⚙ Admin"];

const MONTH_OPTS = [
  { value:"2025-11", label:"December 2025", short:"Dec '25", start:new Date(2025,11,1), end:new Date(2025,11,31,23,59,59) },
  ...Array.from({length:12},(_,i)=>{
    const start=new Date(2026,i,1), end=new Date(2026,i+1,0,23,59,59);
    return { value:`2026-${i}`, label:start.toLocaleDateString("en-US",{month:"long",year:"numeric"}), short:start.toLocaleDateString("en-US",{month:"short"}), start, end };
  }),
];

function uid() { return Math.random().toString(36).slice(2,9); }
function extractTikTokPostDate(url) {
  if(!url) return null;
  const match=url.match(/\/video\/(\d+)/);
  if(!match) return null;
  try { const id=BigInt(match[1]); const ts=Number(id>>32n); if(ts<1000000000||ts>9999999999) return null; return new Date(ts*1000); } catch { return null; }
}
function calcVideoBonus(likes) { if(!likes||likes<1000) return 0; if(likes>=10000) return 150; return 75; }
function bonusLabel(likes) { if(!likes||likes<1000) return null; if(likes>=10000) return "10K+ 🎉 $150"; return "1K+ ⭐ $75"; }
function calcProjectBonuses(links) {
  const byProject={};
  links.filter(l=>!l.duplicate&&l.status!=="draft").forEach(l=>{
    const key=`${l.pmId}__${l.client}`;
    if(!byProject[key]) byProject[key]={pmId:l.pmId,pmName:l.pmName,client:l.client,raw:0};
    byProject[key].raw+=calcVideoBonus(l.likes||0);
  });
  Object.values(byProject).forEach(p=>{p.capped=Math.min(p.raw,500);});
  return byProject;
}

// ── APP ───────────────────────────────────────────────────
export default function App() {
  const [pms, setPms] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);

  const loadAll = useCallback(async () => {
    let [pmsRaw, accsRaw, linksRaw] = await Promise.all([
      sGet("pms","select=*&order=name"),
      sGet("accounts","select=*"),
      sGet("links","select=*&order=date.desc"),
    ]);
    if (!Array.isArray(pmsRaw) || pmsRaw.length === 0) {
      await sPost("pms", DEFAULT_PMS.map(p=>({id:p.id,name:p.name})));
      await sPost("accounts", DEFAULT_PMS.flatMap(p=>p.accounts.map(a=>({id:a.id,pm_id:p.id,client:a.client,username:a.username}))));
      [pmsRaw, accsRaw] = await Promise.all([sGet("pms","select=*&order=name"), sGet("accounts","select=*")]);
      linksRaw = [];
    }
    setPms((pmsRaw||[]).map(p=>({...p, accounts:(accsRaw||[]).filter(a=>a.pm_id===p.id)})));
    setLinks((Array.isArray(linksRaw)?linksRaw:[]).map(dbToLink));
  }, []);

  useEffect(() => {
    (async () => {
      try { await loadAll(); }
      catch(e) { setLoadError("Could not connect to database. Check your internet connection."); }
      setLoading(false);
    })();
  }, [loadAll]);

  const wrap = useCallback(async (fn) => {
    setSaving(true);
    try { await fn(); } catch(e) { console.error(e); }
    setSaving(false);
  }, []);

  const handleAddPm = useCallback(async (name) => {
    const id=uid();
    await wrap(async()=>{ await sPost("pms",{id,name}); setPms(p=>[...p,{id,name,accounts:[]}]); });
    return id;
  }, [wrap]);

  const handleRenamePm = useCallback(async (pmId, name) => {
    await wrap(async()=>{ await sPatch("pms",`id=eq.${pmId}`,{name}); setPms(p=>p.map(pm=>pm.id===pmId?{...pm,name}:pm)); });
  }, [wrap]);

  const handleAddAccount = useCallback(async (pmId, client, username) => {
    const id=uid();
    await wrap(async()=>{ await sPost("accounts",{id,pm_id:pmId,client,username}); setPms(p=>p.map(pm=>pm.id===pmId?{...pm,accounts:[...pm.accounts,{id,pm_id:pmId,client,username}]}:pm)); });
  }, [wrap]);

  const handleRemoveAccount = useCallback(async (pmId, accountId) => {
    await wrap(async()=>{ await sDel("accounts",`id=eq.${accountId}`); setPms(p=>p.map(pm=>pm.id===pmId?{...pm,accounts:pm.accounts.filter(a=>a.id!==accountId)}:pm)); });
  }, [wrap]);

  const handleAddLink = useCallback(async (newLink) => {
    await wrap(async()=>{
      const isDupe=newLink.status!=="draft"&&links.some(x=>x.url&&x.url.trim()===newLink.url.trim()&&x.status!=="draft");
      const final={...newLink,duplicate:isDupe};
      await sPost("links",linkToDb(final));
      setLinks(l=>[final,...l]);
    });
  }, [wrap, links]);

  const handleUpdateLink = useCallback(async (id, updates) => {
    await wrap(async()=>{ await sPatch("links",`id=eq.${id}`,updToDb(updates)); setLinks(l=>l.map(x=>x.id===id?{...x,...updates}:x)); });
  }, [wrap]);

  const handleDeleteLink = useCallback(async (id) => {
    await wrap(async()=>{ await sDel("links",`id=eq.${id}`); setLinks(l=>l.filter(x=>x.id!==id)); });
  }, [wrap]);

  const handleClearAll = useCallback(async () => {
    await wrap(async()=>{ await sDel("links","id=not.is.null"); setLinks([]); });
  }, [wrap]);

  const handleRefresh = useCallback(async () => {
    setSaving(true);
    try { await loadAll(); } catch(e) {}
    setSaving(false);
  }, [loadAll]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center space-y-3">
        <div className="text-3xl animate-pulse">⏳</div>
        <p className="text-white text-sm">Connecting to database…</p>
      </div>
    </div>
  );
  if (loadError) return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-8 text-center max-w-sm space-y-4">
        <div className="text-3xl">⚠️</div>
        <p className="text-red-400 text-sm">{loadError}</p>
        <button onClick={()=>window.location.reload()} style={{background:"#7c3aed"}} className="px-4 py-2 rounded-lg text-sm text-white hover:opacity-90">Retry</button>
      </div>
    </div>
  );

  const draftCount = links.filter(l=>l.status==="draft").length;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div style={{background:"#0d0014"}} className="border-b border-purple-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{background:"#7c3aed"}} className="w-8 h-8 rounded-lg flex items-center justify-center text-lg">▶</div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">BW Club PM Content Tracker</h1>
            <p style={{color:"#a78bfa"}} className="text-xs">2026 · Live Shared Database</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span style={{color:"#fbbf24"}} className="text-xs">Saving…</span>}
          <button onClick={handleRefresh} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-3 py-1.5 text-xs text-purple-300 hover:text-white">↺ Refresh</button>
        </div>
      </div>

      <div style={{background:"#0d0014"}} className="border-b border-purple-900 px-6 flex gap-1">
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${tab===i?"border-purple-400 text-purple-300":"border-transparent text-gray-400 hover:text-white"}`}>
            {t}
            {i===1&&draftCount>0&&<span style={{background:"#7c3aed"}} className="absolute -top-0.5 -right-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{draftCount}</span>}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab===0 && <LogTab pms={pms} links={links} onAddLink={handleAddLink} />}
        {tab===1 && <DraftsTab pms={pms} links={links} onUpdateLink={handleUpdateLink} />}
        {tab===2 && <ManageTab pms={pms} onAddPm={handleAddPm} onRenamePm={handleRenamePm} onAddAccount={handleAddAccount} onRemoveAccount={handleRemoveAccount} />}
        {tab===3 && <AdminGate pms={pms} links={links} onDeleteLink={handleDeleteLink} onClearAll={handleClearAll} onUpdateLink={handleUpdateLink} onRefresh={handleRefresh} />}
      </div>
    </div>
  );
}

// ── LOG TAB ───────────────────────────────────────────────
function LogTab({ pms, links, onAddLink }) {
  const [pmId, setPmId] = useState("");
  const [accId, setAccId] = useState("");
  const [url, setUrl] = useState("");
  const [likes, setLikes] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pm = pms.find(p=>p.id===pmId);
  const accounts = pm?.accounts??[];
  const acc = accounts.find(a=>a.id===accId);
  const postDate = extractTikTokPostDate(url);
  const resolvedPostDate = postDate||(manualDate?new Date(manualDate+"T12:00:00"):null);
  const likesNum = parseInt(likes.replace(/[^0-9]/g,""))||0;
  const bl = bonusLabel(likesNum);
  const iStyle = {background:"#1a0030",borderColor:"#4c1d95"};
  const iCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-gray-500";

  const submit = async () => {
    if(!pmId||!accId||!url.trim()){setError("Please select a PM, account, and paste a link.");return;}
    if(!isDraft&&!url.includes("tiktok.com")){setError("Only TikTok links can be logged as Live. Check 'This is a Draft' for Frame.io or other links.");return;}
    if(!isDraft&&!resolvedPostDate){setError("Please enter the post date manually for this carousel/photo post.");return;}
    await onAddLink({id:uid(),pmId,pmName:pm.name,accId,client:acc.client,username:acc.username,url:url.trim(),likes:isDraft?0:likesNum,date:new Date().toISOString(),postDate:isDraft?null:(resolvedPostDate?.toISOString()||null),manualDateUsed:!isDraft&&!postDate&&!!manualDate,status:isDraft?"draft":"live",duplicate:false});
    setUrl(""); setLikes(""); setManualDate(""); setIsDraft(false); setError("");
    setSuccess(true); setTimeout(()=>setSuccess(false),2000);
  };

  const recentLive = [...links].filter(l=>l.status!=="draft").sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-base text-white">Log a Video Link</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{color:"#c4b5fd"}} className="text-xs mb-1 block">Project Manager</label>
            <select value={pmId} onChange={e=>{setPmId(e.target.value);setAccId("");}} style={{background:"#1a0030",borderColor:"#4c1d95",color:"white"}} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Select PM…</option>
              {pms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{color:"#c4b5fd"}} className="text-xs mb-1 block">Account</label>
            <select value={accId} onChange={e=>setAccId(e.target.value)} disabled={!pmId} style={{background:"#1a0030",borderColor:"#4c1d95",color:"white"}} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-40">
              <option value="">Select account…</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.client} — @{a.username}</option>)}
            </select>
          </div>
        </div>

        <button onClick={()=>setIsDraft(v=>!v)} style={{background:isDraft?"#3b0764":"#1a0030",borderColor:isDraft?"#7c3aed":"#4c1d95"}} className="w-full border rounded-lg px-4 py-3 flex items-center gap-3 transition-colors text-left">
          <div style={{background:isDraft?"#7c3aed":"#0d0014",borderColor:isDraft?"#7c3aed":"#4c1d95"}} className="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors">
            {isDraft&&<span className="text-white text-xs font-bold">✓</span>}
          </div>
          <div>
            <p className="text-sm font-medium text-white">This is a Draft</p>
            <p style={{color:"#a78bfa"}} className="text-xs">Check for Frame.io or unreleased links. Won't count toward billing until marked Live.</p>
          </div>
        </button>

        <div>
          <label style={{color:"#c4b5fd"}} className="text-xs mb-1 block">{isDraft?"Frame.io / Draft Link":"TikTok Video URL"}</label>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder={isDraft?"https://app.frame.io/...":"https://www.tiktok.com/@username/video/..."} style={iStyle} className={iCls}/>
          {url&&!isDraft&&(
            <div className="space-y-2 mt-1.5">
              {postDate
                ?<p className="text-xs" style={{color:"#86efac"}}>✓ Post date detected: <strong>{postDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong></p>
                :(<div style={{background:"#1a0020",borderColor:"#7c3aed"}} className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold" style={{color:"#fbbf24"}}>⚠ Carousel/photo post — enter date manually:</p>
                  <input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} style={{background:"#0d0014",borderColor:"#4c1d95",colorScheme:"dark"}} className="w-full border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"/>
                  {manualDate&&<p className="text-xs" style={{color:"#86efac"}}>✓ Using: <strong>{new Date(manualDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong></p>}
                </div>)}
            </div>
          )}
          {url&&isDraft&&<p className="text-xs mt-1.5" style={{color:"#a78bfa"}}>📝 Saved as draft — update to TikTok link in the Drafts tab when live.</p>}
        </div>

        {!isDraft&&(
          <div>
            <label style={{color:"#c4b5fd"}} className="text-xs mb-1 block">Like Count <span style={{color:"#6b21a8"}}>(optional — for bonus)</span></label>
            <div className="flex gap-3 items-center">
              <input value={likes} onChange={e=>setLikes(e.target.value)} placeholder="e.g. 12500" style={iStyle} className={iCls}/>
              {likesNum>0&&(bl?<span className="text-sm font-bold shrink-0" style={{color:"#86efac"}}>{bl}</span>:<span className="text-xs shrink-0" style={{color:"#6b21a8"}}>No bonus yet</span>)}
            </div>
            <p className="text-xs mt-1.5" style={{color:"#6b21a8"}}>1K likes = $75 · 10K likes = $150 · capped at $500/project</p>
          </div>
        )}

        {error&&<p className="text-red-400 text-sm">{error}</p>}
        {success&&<p style={{color:"#86efac"}} className="text-sm">✓ {isDraft?"Saved as draft!":"Link logged!"}</p>}
        <button onClick={submit} style={{background:isDraft?"#4c1d95":"#7c3aed"}} className="w-full hover:opacity-90 transition-opacity rounded-lg py-2 text-sm font-semibold text-white">
          {isDraft?"📝 Save as Draft":"Log Live Link"}
        </button>
      </div>

      {recentLive.length>0&&(
        <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-5">
          <h3 style={{color:"#c4b5fd"}} className="text-sm font-semibold mb-3">Recently Logged (Live)</h3>
          <div className="space-y-2">
            {recentLive.map(l=>(
              <div key={l.id} style={{background:"#1a0030"}} className="flex items-start gap-3 text-xs rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="text-white font-medium">{l.pmName}</span> · {l.client} · <span style={{color:"#a78bfa"}}>@{l.username}</span>
                  {l.promotedFromDraft&&<span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{background:"#1a2a00",color:"#86efac"}}>draft→live</span>}
                  {l.likes>0&&<span className="ml-2" style={{color:"#86efac"}}>{l.likes.toLocaleString()} likes{calcVideoBonus(l.likes)>0?` · $${calcVideoBonus(l.likes)}`:""}</span>}
                  <div className="truncate text-gray-500 mt-0.5">{l.url}</div>
                </div>
                <span style={{color:"#6b21a8"}} className="shrink-0">{new Date(l.postDate||l.date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DRAFTS TAB ────────────────────────────────────────────
function DraftsTab({ pms, links, onUpdateLink }) {
  const [selectedPm, setSelectedPm] = useState("");
  const [promotingId, setPromotingId] = useState(null);
  const [tikTokUrl, setTikTokUrl] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [likes, setLikes] = useState("");
  const [promoteError, setPromoteError] = useState("");

  const myDrafts = links.filter(l=>l.status==="draft"&&(!selectedPm||l.pmId===selectedPm)).sort((a,b)=>b.date.localeCompare(a.date));
  const postDate = extractTikTokPostDate(tikTokUrl);
  const resolvedDate = postDate||(manualDate?new Date(manualDate+"T12:00:00"):null);
  const likesNum = parseInt((likes||"").replace(/[^0-9]/g,""))||0;

  const submitPromote = async (draft) => {
    if(!tikTokUrl.trim()||!tikTokUrl.includes("tiktok.com")){setPromoteError("Please paste a valid TikTok URL.");return;}
    if(!resolvedDate){setPromoteError("Please enter the post date for this carousel/photo post.");return;}
    await onUpdateLink(draft.id,{url:tikTokUrl.trim(),status:"live",likes:likesNum,postDate:resolvedDate.toISOString(),manualDateUsed:!postDate&&!!manualDate,promotedFromDraft:true,promotedAt:new Date().toISOString()});
    setPromotingId(null); setTikTokUrl(""); setManualDate(""); setLikes(""); setPromoteError("");
  };

  const cancelPromote = () => { setPromotingId(null); setTikTokUrl(""); setManualDate(""); setLikes(""); setPromoteError(""); };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-base text-white">📝 Drafts</h2>
        <p style={{color:"#7e22ce"}} className="text-xs">Select your name to see your pending drafts. When a video goes live on TikTok, hit "Mark Live" and paste the TikTok URL.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setSelectedPm("")} style={selectedPm===""?{background:"#7c3aed",color:"white"}:{background:"#1a0030",color:"#c4b5fd",borderColor:"#4c1d95"}} className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors">All PMs</button>
          {pms.map(p=>{
            const count=links.filter(l=>l.status==="draft"&&l.pmId===p.id).length;
            return (
              <button key={p.id} onClick={()=>setSelectedPm(p.id)} style={selectedPm===p.id?{background:"#7c3aed",color:"white"}:{background:"#1a0030",color:"#c4b5fd",borderColor:"#4c1d95"}} className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2">
                {p.name}
                {count>0&&<span style={{background:selectedPm===p.id?"rgba(255,255,255,0.25)":"#3b0764"}} className="text-xs rounded-full px-1.5 py-0.5">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {myDrafts.length===0
        ?<div style={{color:"#4c1d95"}} className="text-center py-16 text-sm">{selectedPm?"No pending drafts for this PM.":"No pending drafts."}</div>
        :(<div className="space-y-3">
          {myDrafts.map(draft=>(
            <div key={draft.id} style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{draft.pmName}</span>
                    <span style={{color:"#6b21a8"}}>·</span>
                    <span className="text-white text-sm">{draft.client}</span>
                    <span style={{color:"#c4b5fd"}} className="text-sm">@{draft.username}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:"#2d0057",color:"#c4b5fd"}}>⏳ Draft</span>
                  </div>
                  <p style={{color:"#6b21a8"}} className="text-xs">Added {new Date(draft.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>
                  {draft.url&&<a href={draft.url} target="_blank" rel="noreferrer" style={{color:"#818cf8"}} className="text-xs hover:underline truncate block max-w-xs">{draft.url}</a>}
                </div>
                {promotingId!==draft.id&&(
                  <button onClick={()=>{setPromotingId(draft.id);setTikTokUrl("");setManualDate("");setLikes("");setPromoteError("");}} style={{background:"#166534",color:"#86efac"}} className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80 font-semibold shrink-0">✓ Mark Live</button>
                )}
              </div>
              {promotingId===draft.id&&(
                <div style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg p-4 space-y-3">
                  <p style={{color:"#c4b5fd"}} className="text-xs font-semibold">Paste the live TikTok URL:</p>
                  <div>
                    <input value={tikTokUrl} onChange={e=>setTikTokUrl(e.target.value)} placeholder="https://www.tiktok.com/@username/video/..." style={{background:"#0d0014",borderColor:"#4c1d95"}} className="w-full border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"/>
                    {tikTokUrl&&(postDate
                      ?<p className="text-xs mt-1.5" style={{color:"#86efac"}}>✓ Post date: <strong>{postDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong></p>
                      :(<div className="space-y-2 mt-2">
                        <p className="text-xs" style={{color:"#fbbf24"}}>⚠ Carousel/photo post — enter date manually:</p>
                        <input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} style={{background:"#0d0014",borderColor:"#4c1d95",colorScheme:"dark"}} className="w-full border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"/>
                      </div>)
                    )}
                  </div>
                  <div>
                    <label style={{color:"#c4b5fd"}} className="text-xs mb-1 block">Like Count <span style={{color:"#6b21a8"}}>(optional)</span></label>
                    <div className="flex gap-2 items-center">
                      <input value={likes} onChange={e=>setLikes(e.target.value)} placeholder="e.g. 5000" style={{background:"#0d0014",borderColor:"#4c1d95"}} className="flex-1 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"/>
                      {likesNum>0&&bonusLabel(likesNum)&&<span className="text-xs font-bold shrink-0" style={{color:"#86efac"}}>{bonusLabel(likesNum)}</span>}
                    </div>
                  </div>
                  {promoteError&&<p className="text-xs text-red-400">{promoteError}</p>}
                  <div className="flex gap-2">
                    <button onClick={cancelPromote} style={{background:"#0d0014",borderColor:"#4c1d95"}} className="flex-1 border rounded-lg py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={()=>submitPromote(draft)} style={{background:"#166534"}} className="flex-1 rounded-lg py-2 text-sm font-semibold text-white hover:opacity-90">🚀 Mark as Live</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>)}
    </div>
  );
}

// ── MANAGE ACCOUNTS TAB ───────────────────────────────────
function ManageTab({ pms, onAddPm, onRenamePm, onAddAccount, onRemoveAccount }) {
  const [selPm, setSelPm] = useState(pms[0]?.id??"");
  const [newClient, setNewClient] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPmName, setNewPmName] = useState("");
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName] = useState("");
  const pm = pms.find(p=>p.id===selPm);
  const iCls = "border rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-gray-500";
  const iStyle = {background:"#1a0030",borderColor:"#4c1d95"};

  const addAccount = async () => {
    if(!newClient.trim()||!newUser.trim()) return;
    await onAddAccount(selPm, newClient.trim(), newUser.trim().replace(/^@/,""));
    setNewClient(""); setNewUser("");
  };

  const addPm = async () => {
    if(!newPmName.trim()) return;
    const id = await onAddPm(newPmName.trim());
    setSelPm(id); setNewPmName("");
  };

  const saveName = async (pmId) => {
    await onRenamePm(pmId, tempName);
    setEditingName(null);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-5 space-y-3">
        <h3 style={{color:"#c4b5fd"}} className="text-sm font-semibold">Project Managers</h3>
        <div className="flex flex-wrap gap-2">
          {pms.map(p=>(<button key={p.id} onClick={()=>setSelPm(p.id)} style={selPm===p.id?{background:"#7c3aed",color:"white"}:{background:"#1a0030",color:"#c4b5fd",borderColor:"#4c1d95"}} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border">{p.name}</button>))}
        </div>
        <div className="flex gap-2">
          <input value={newPmName} onChange={e=>setNewPmName(e.target.value)} placeholder="New PM name…" style={iStyle} className={`flex-1 ${iCls}`}/>
          <button onClick={addPm} style={{background:"#7c3aed"}} className="hover:opacity-90 px-4 py-2 rounded-lg text-sm font-medium text-white">Add PM</button>
        </div>
      </div>
      {pm&&(
        <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            {editingName===pm.id
              ?<div className="flex gap-2"><input value={tempName} onChange={e=>setTempName(e.target.value)} style={iStyle} className={iCls}/><button onClick={()=>saveName(pm.id)} style={{color:"#a78bfa"}} className="text-sm">Save</button></div>
              :<div className="flex items-center gap-2"><h3 style={{color:"#c4b5fd"}} className="text-sm font-semibold">{pm.name}'s Accounts ({pm.accounts.length})</h3><button onClick={()=>{setEditingName(pm.id);setTempName(pm.name);}} style={{color:"#6b21a8"}} className="hover:text-purple-300 text-xs">✎</button></div>}
          </div>
          <div className="space-y-2">
            {pm.accounts.map(a=>(<div key={a.id} style={{background:"#1a0030"}} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"><span><span className="text-white">{a.client}</span> <span style={{color:"#6b21a8"}}>·</span> <span style={{color:"#c4b5fd"}}>@{a.username}</span></span><button onClick={()=>onRemoveAccount(pm.id,a.id)} className="text-gray-600 hover:text-red-400">✕</button></div>))}
            {pm.accounts.length===0&&<p style={{color:"#6b21a8"}} className="text-sm">No accounts yet.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={newClient} onChange={e=>setNewClient(e.target.value)} placeholder="Client name" style={iStyle} className={iCls}/>
            <input value={newUser} onChange={e=>setNewUser(e.target.value)} placeholder="@username" style={iStyle} className={iCls}/>
          </div>
          <button onClick={addAccount} style={{background:"#7c3aed"}} className="w-full hover:opacity-90 rounded-lg py-2 text-sm font-semibold text-white">+ Add Account</button>
        </div>
      )}
    </div>
  );
}

// ── ADMIN GATE ────────────────────────────────────────────
function AdminGate(props) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState(false);
  const attempt = () => { if(input==="Walid23!"){setUnlocked(true);setErr(false);}else{setErr(true);setInput("");} };
  if(unlocked) return <AdminTab {...props} onLock={()=>setUnlocked(false)}/>;
  return (
    <div className="max-w-xs mx-auto mt-16">
      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-8 space-y-5 text-center">
        <div style={{background:"#1a0030"}} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto">🔒</div>
        <div><h2 className="font-bold text-white text-lg">Admin Access</h2><p style={{color:"#a78bfa"}} className="text-xs mt-1">Enter the password to continue</p></div>
        <input type="password" value={input} onChange={e=>{setInput(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Password" style={{background:"#1a0030",borderColor:err?"#ef4444":"#4c1d95"}} className="w-full border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none text-center"/>
        {err&&<p className="text-red-400 text-xs">Incorrect password.</p>}
        <button onClick={attempt} style={{background:"#7c3aed"}} className="w-full hover:opacity-90 rounded-lg py-2 text-sm font-semibold text-white">Unlock</button>
      </div>
    </div>
  );
}

// ── EXPORT MODAL ──────────────────────────────────────────
function ExportModal({ pms, links, onClose }) {
  const [selPms, setSelPms] = useState(pms.map(p=>p.id));
  const [selMonths, setSelMonths] = useState([`2026-${new Date().getMonth()}`]);
  const togglePm = id => setSelPms(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const toggleMonth = v => setSelMonths(s=>s.includes(v)?s.filter(x=>x!==v):[...s,v]);
  const liveLinks = links.filter(l=>l.status!=="draft");
  const preview = liveLinks.filter(l=>{
    const d=new Date(l.postDate||l.date);
    return selPms.includes(l.pmId)&&selMonths.some(mv=>{const mo=MONTH_OPTS.find(m=>m.value===mv);return mo&&d>=mo.start&&d<=mo.end;});
  });
  const clean = preview.filter(l=>!l.duplicate);
  const bonuses = calcProjectBonuses(clean);
  const totalBonus = Object.values(bonuses).reduce((s,p)=>s+p.capped,0);
  const doExport = () => {
    const pmNames=selPms.map(id=>pms.find(p=>p.id===id)?.name).join("+");
    const monthLabels=selMonths.map(mv=>MONTH_OPTS.find(m=>m.value===mv)?.short).join("+");
    const rows=[["Post Date","Logged Date","PM","Client","Username","TikTok URL","Likes","Video Bonus","Status","Source"],
      ...preview.map(l=>{const vb=l.duplicate?0:calcVideoBonus(l.likes||0);return[new Date(l.postDate||l.date).toLocaleDateString(),new Date(l.date).toLocaleDateString(),l.pmName,l.client,"@"+l.username,l.url,l.likes||0,vb?`$${vb}`:"$0",l.duplicate?"DOUBLE LINK":"OK",l.promotedFromDraft?"Draft→Live":"Direct"];}),
      [],[" --- Bonus Summary ---"],["PM","Client","Raw Bonus","Capped Bonus"],
      ...Object.values(bonuses).map(b=>[b.pmName,b.client,`$${b.raw}`,`$${b.capped}`]),
      [],["TOTAL BONUS PAYOUT","","",`$${totalBonus}`]];
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download=`bwclub-${pmNames}-${monthLabels}.csv`; a.click(); onClose();
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 py-8" style={{background:"rgba(0,0,0,0.75)"}}>
      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-6 w-full max-w-lg space-y-5 mx-4 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between"><h2 className="font-bold text-white text-base">Export Data</h2><button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button></div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label style={{color:"#c4b5fd"}} className="text-xs font-semibold uppercase tracking-wide">Project Managers</label>
            <button onClick={()=>setSelPms(selPms.length===pms.length?[]:pms.map(p=>p.id))} style={{color:"#a78bfa"}} className="text-xs hover:text-white">{selPms.length===pms.length?"Deselect all":"Select all"}</button>
          </div>
          <div className="flex flex-wrap gap-2">{pms.map(p=>(<button key={p.id} onClick={()=>togglePm(p.id)} style={selPms.includes(p.id)?{background:"#7c3aed",color:"white",borderColor:"#7c3aed"}:{background:"#1a0030",color:"#c4b5fd",borderColor:"#4c1d95"}} className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors">{p.name}</button>))}</div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label style={{color:"#c4b5fd"}} className="text-xs font-semibold uppercase tracking-wide">Billing Months</label>
            <button onClick={()=>setSelMonths(selMonths.length===MONTH_OPTS.length?[]:MONTH_OPTS.map(m=>m.value))} style={{color:"#a78bfa"}} className="text-xs hover:text-white">{selMonths.length===MONTH_OPTS.length?"Deselect all":"Select all"}</button>
          </div>
          <div className="grid grid-cols-4 gap-2">{MONTH_OPTS.map(m=>(<button key={m.value} onClick={()=>toggleMonth(m.value)} style={selMonths.includes(m.value)?{background:"#7c3aed",color:"white",borderColor:"#7c3aed"}:{background:"#1a0030",color:"#c4b5fd",borderColor:"#4c1d95"}} className="px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center">{m.short}</button>))}</div>
        </div>
        <div style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-4 py-3 space-y-2">
          <div className="flex items-center justify-between"><span style={{color:"#a78bfa"}} className="text-sm">Live entries (excl. duplicates)</span><span className="text-white font-bold">{clean.length}</span></div>
          <div className="flex items-center justify-between"><span style={{color:"#a78bfa"}} className="text-sm">Est. bonus payout</span><span className="font-bold text-lg" style={{color:"#86efac"}}>${totalBonus}</span></div>
          {preview.length!==clean.length&&<p className="text-xs" style={{color:"#f87171"}}>{preview.length-clean.length} duplicate(s) excluded</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="flex-1 border rounded-lg py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button onClick={doExport} disabled={clean.length===0||!selPms.length||!selMonths.length} style={{background:clean.length===0?"#3b0764":"#7c3aed"}} className="flex-1 rounded-lg py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">↓ Export {clean.length} Rows</button>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN TAB ─────────────────────────────────────────────
function AdminTab({ pms, links, onDeleteLink, onClearAll, onUpdateLink, onLock, onRefresh }) {
  const [filterPm, setFilterPm] = useState("all");
  const [filterStatus, setFilterStatus] = useState("live");
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editLikes, setEditLikes] = useState({});

  const curMonth = `2026-${new Date().getMonth()}`;
  const defaultPeriod = MONTH_OPTS.find(m=>m.value===curMonth)?.value??"2026-0";
  const [billingPeriod, setBillingPeriod] = useState(defaultPeriod);
  const activePeriod = MONTH_OPTS.find(m=>m.value===billingPeriod);

  const liveLinks = links.filter(l=>l.status!=="draft");
  const periodFiltered = liveLinks.filter(l=>{const d=new Date(l.postDate||l.date);return activePeriod&&d>=activePeriod.start&&d<=activePeriod.end;});
  const cleanPeriod = periodFiltered.filter(l=>!l.duplicate);
  const dupeCount = periodFiltered.filter(l=>l.duplicate).length;
  const byPm = pms.map(p=>({name:p.name,count:cleanPeriod.filter(l=>l.pmId===p.id).length}));
  const bonuses = calcProjectBonuses(cleanPeriod);
  const totalBonus = Object.values(bonuses).reduce((s,p)=>s+p.capped,0);
  const bonusByPm = pms.map(p=>({name:p.name,bonus:Object.values(bonuses).filter(b=>b.pmId===p.id).reduce((s,b)=>s+b.capped,0)}));
  const draftCount = links.filter(l=>l.status==="draft").length;

  const displayLinks = links
    .filter(l=>filterStatus==="all"||l.status===filterStatus)
    .filter(l=>filterPm==="all"||l.pmId===filterPm)
    .filter(l=>!search||[l.client,l.username,l.url,l.pmName].some(v=>v?.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>b.date.localeCompare(a.date));

  const saveLikes = id => { const val=parseInt((editLikes[id]||"").replace(/[^0-9]/g,""))||0; onUpdateLink(id,{likes:val}); setEditLikes(prev=>{const n={...prev};delete n[id];return n;}); };

  return (
    <div className="space-y-6">
      {showExport&&<ExportModal pms={pms} links={links} onClose={()=>setShowExport(false)}/>}

      <div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><p style={{color:"#c4b5fd"}} className="text-sm font-semibold">Billing Period</p>{activePeriod&&<p style={{color:"#7e22ce"}} className="text-xs mt-0.5">{activePeriod.start.toLocaleDateString()} — {activePeriod.end.toLocaleDateString()}</p>}</div>
          <select value={billingPeriod} onChange={e=>setBillingPeriod(e.target.value)} style={{background:"#1a0030",borderColor:"#4c1d95",color:"white"}} className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
            {MONTH_OPTS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-3 py-2">
            <p style={{color:"#a78bfa"}} className="text-xs">Live Total</p>
            <p className="text-xl font-bold text-white">{cleanPeriod.length}</p>
            {dupeCount>0&&<p className="text-xs mt-0.5" style={{color:"#f87171"}}>{dupeCount} dupe{dupeCount>1?"s":""} excl.</p>}
          </div>
          {byPm.map(p=>(<div key={p.name} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-3 py-2"><p style={{color:"#a78bfa"}} className="text-xs">{p.name}</p><p className="text-xl font-bold text-white">{p.count}</p></div>))}
        </div>
        <div style={{borderColor:"#4c1d95"}} className="border-t pt-3">
          <p style={{color:"#c4b5fd"}} className="text-xs font-semibold uppercase tracking-wide mb-2">Bonus Summary</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-3 py-2">
              <p style={{color:"#a78bfa"}} className="text-xs">Total Payout</p>
              <p className="text-xl font-bold" style={{color:"#86efac"}}>${totalBonus}</p>
            </div>
            {bonusByPm.map(p=>(<div key={p.name} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-3 py-2"><p style={{color:"#a78bfa"}} className="text-xs">{p.name}</p><p className="text-xl font-bold" style={{color:p.bonus>0?"#86efac":"white"}}>${p.bonus}</p></div>))}
          </div>
        </div>
        {draftCount>0&&(
          <div style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-3 py-2 flex items-center gap-2">
            <span>📝</span><span style={{color:"#a78bfa"}} className="text-xs"><strong className="text-white">{draftCount}</strong> pending draft{draftCount>1?"s":""} not yet counted toward billing</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{background:"#1a0030",borderColor:"#4c1d95",color:"white"}} className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="live">Live only</option>
          <option value="draft">Drafts only</option>
          <option value="all">All</option>
        </select>
        <select value={filterPm} onChange={e=>setFilterPm(e.target.value)} style={{background:"#1a0030",borderColor:"#4c1d95",color:"white"}} className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="all">All PMs</option>{pms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{background:"#1a0030",borderColor:"#4c1d95"}} className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-gray-500"/>
        <span style={{color:"#a78bfa"}} className="text-sm">{displayLinks.length} entries</span>
        <button onClick={()=>setShowExport(true)} style={{background:"#7c3aed"}} className="rounded-lg px-4 py-2 text-sm text-white font-medium hover:opacity-90">↓ Export</button>
        <button onClick={onRefresh} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-4 py-2 text-sm text-purple-300 hover:text-white">↺ Refresh</button>
        <button onClick={onLock} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">🔒 Lock</button>
        {!confirmClear
          ?<button onClick={()=>setConfirmClear(true)} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded-lg px-4 py-2 text-sm text-red-400 hover:border-red-700">🗑 Clear All</button>
          :<div className="flex items-center gap-2"><span className="text-red-400 text-sm">Sure?</span><button onClick={()=>{onClearAll();setConfirmClear(false);}} className="bg-red-700 rounded-lg px-3 py-2 text-sm text-white">Yes</button><button onClick={()=>setConfirmClear(false)} style={{background:"#1a0030"}} className="rounded-lg px-3 py-2 text-sm text-white">Cancel</button></div>}
      </div>

      {displayLinks.length===0
        ?<div style={{color:"#6b21a8"}} className="text-center py-16">No entries found.</div>
        :(<div style={{background:"#0d0014",borderColor:"#3b0764"}} className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{background:"#1a0030",borderColor:"#3b0764"}} className="border-b text-xs uppercase tracking-wide">
                  {["#","Status","Post Date","PM","Client","Username","URL","Likes","Bonus","Source",""].map(h=>(<th key={h} style={{color:"#a78bfa"}} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {displayLinks.map((l,i)=>{
                  const isDraft=l.status==="draft";
                  const vb=isDraft||l.duplicate?0:calcVideoBonus(l.likes||0);
                  const isEditing=editLikes.hasOwnProperty(l.id);
                  return (
                    <tr key={l.id} style={{borderColor:"#2d0057",background:isDraft?"#100020":l.duplicate?"#1a0010":""}} className="border-b hover:bg-purple-950 transition-colors">
                      <td style={{color:"#6b21a8"}} className="px-4 py-3 text-xs">{i+1}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {isDraft?<span className="px-2 py-0.5 rounded-full font-semibold" style={{background:"#2d0057",color:"#c4b5fd"}}>⏳ Draft</span>:<span className="px-2 py-0.5 rounded-full font-semibold" style={{background:"#166534",color:"#86efac"}}>✓ Live</span>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {isDraft?<span style={{color:"#4c1d95"}}>—</span>:<div className="text-white font-medium">{new Date(l.postDate||l.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                        {l.manualDateUsed&&<span className="text-xs" style={{color:"#fbbf24"}}>✎ manual</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{l.pmName}</td>
                      <td className="px-4 py-3 text-white">{l.client}</td>
                      <td style={{color:"#c4b5fd"}} className="px-4 py-3">@{l.username}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <a href={l.url} target="_blank" rel="noreferrer" style={{color:isDraft?"#a78bfa":"#818cf8"}} className="hover:underline truncate block text-xs">{l.url||"—"}</a>
                        {l.duplicate&&<span className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded" style={{background:"#450a0a",color:"#f87171"}}>DOUBLE LINK</span>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {isDraft?<span style={{color:"#4c1d95"}}>—</span>:isEditing?(
                          <div className="flex gap-1 items-center">
                            <input value={editLikes[l.id]} onChange={e=>setEditLikes(p=>({...p,[l.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&saveLikes(l.id)} style={{background:"#1a0030",borderColor:"#4c1d95"}} className="border rounded px-2 py-1 text-xs text-white w-20 focus:outline-none"/>
                            <button onClick={()=>saveLikes(l.id)} style={{color:"#86efac"}} className="text-xs">✓</button>
                            <button onClick={()=>setEditLikes(p=>{const n={...p};delete n[l.id];return n;})} className="text-gray-500 text-xs">✕</button>
                          </div>
                        ):(
                          <button onClick={()=>setEditLikes(p=>({...p,[l.id]:String(l.likes||"")}))} className="hover:opacity-80">
                            {l.likes>0?<span className="text-white">{l.likes.toLocaleString()} <span style={{color:"#6b21a8"}}>✎</span></span>:<span style={{color:"#4c1d95"}}>— add ✎</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold whitespace-nowrap" style={{color:vb>0?"#86efac":"#4c1d95"}}>{vb>0?`$${vb}`:"—"}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {l.promotedFromDraft?<span className="px-2 py-0.5 rounded-full text-xs" style={{background:"#1a2a00",color:"#86efac"}}>Draft→Live</span>:isDraft?<span style={{color:"#4c1d95"}}>Draft</span>:<span style={{color:"#4c1d95"}}>Direct</span>}
                      </td>
                      <td className="px-4 py-3"><button onClick={()=>onDeleteLink(l.id)} className="text-gray-600 hover:text-red-400 transition-colors">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>
  );
}
