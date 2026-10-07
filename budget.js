(() => {
  const KEY = "household-budget-v1";
  const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
  const dateText = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const toISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const addMonths = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setMonth(d.getMonth() + n); return toISO(d); };
  const nextDate = (after, day, monthStep = 1, monthParity = null) => {
    let d = new Date(`${after}T12:00:00`); d.setDate(1);
    for (let i=0;i<30;i++) { const candidate = new Date(d.getFullYear(),d.getMonth(),Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()),12); const iso=toISO(candidate); if (iso>after && (!monthParity || candidate.getMonth()%2===monthParity)) return iso; d.setMonth(d.getMonth()+monthStep); }
    return after;
  };
  const defaults = {
    balance: 0,
    start: "2026-09-27",
    incomes: [{label:"毎月の入金",amount:30000,day:6},{label:"厚生障害年金",amount:106000,day:15,even:true},{label:"作業所",amount:4700,day:25}],
    expenses: [{label:"SMBC医療保険",amount:4234,day:27},{label:"定期サービス",amount:12193,day:27},{label:"借入 最低返済（概算）",amount:7200,day:27},{label:"病院代（予算）",amount:7000,day:6}],
    receipts: [], flows: []
  };
  let state;
  try { state = {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")}; } catch { state = {...defaults}; }
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (text) => String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function save(){ localStorage.setItem(KEY,JSON.stringify(state)); render(); }
  function scheduled(start,end){
    const out=[];
    for(const item of state.incomes){ let day=nextDate(start,item.day,1,item.even?1:null); for(let i=0;i<14 && day<=end;i++,day=nextDate(day,item.day,1,item.even?1:null)) out.push({date:day,label:item.label,amount:+item.amount,type:"income"}); }
    for(const item of state.expenses){ let day=nextDate(start,item.day); for(let i=0;i<14 && day<=end;i++,day=nextDate(day,item.day)) out.push({date:day,label:item.label,amount:+item.amount,type:"expense"}); }
    for(const f of state.flows||[]) if(f.date>start && f.date<=end) out.push({...f,amount:+f.amount});
    // Card purchases are paid on the following month's 27th, alongside the fixed subscriptions and estimated debt minimum.
    const firstMonth=state.start.slice(0,7), lastMonth=end.slice(0,7); let month=firstMonth;
    for(let i=0;i<15 && month<=lastMonth;i++){
      const cardTotal=state.receipts.filter(r=>r.method==="card" && r.date.slice(0,7)===month).reduce((sum,r)=>sum+r.total,0);
      if(cardTotal){const [y,m]=month.split("-").map(Number);const bill=toISO(new Date(y,m,27,12));if(bill>start&&bill<=end)out.push({date:bill,label:`前月のカード利用分（${yen.format(cardTotal)}）`,amount:cardTotal,type:"expense"});}
      const [y,m]=month.split("-").map(Number);month=toISO(new Date(y,m,1,12)).slice(0,7);
    }
    for(const r of state.receipts) if(r.method==="cash"&&r.date>start&&r.date<=end) out.push({date:r.date,label:`支出記録${r.memo?`・${r.memo}`:""}`,amount:r.total,type:"expense",receipt:true});
    return out.sort((a,b)=>a.date.localeCompare(b.date)||(a.type==="expense"?-1:1));
  }
  function pensionAfter(start){return nextDate(start,15,2,1);}
  function render(){
    $("balance").value=state.balance;
    const start=state.start, pension=pensionAfter(start), until=toISO(new Date(new Date(`${pension}T12:00:00`).getTime()-86400000));
    const near=scheduled(start,until); const net=near.reduce((s,e)=>s+(e.type==="income"?e.amount:-e.amount),+state.balance);
    const days=Math.max(1,Math.ceil((new Date(`${pension}T12:00:00`)-new Date(`${start}T12:00:00`))/86400000));
    $("next-pension-label").textContent=`${dateText(pension)}の年金日前の見込み`;
    $("forecast-net").textContent=yen.format(net); $("forecast-net").classList.toggle("negative",net<0);
    $("forecast-period").textContent=`${dateText(start)}〜${dateText(until)}（年金入金前）`;
    $("daily-limit").textContent=yen.format(Math.max(0,Math.floor(net/days)));
    const end2=addMonths(start,2), two=scheduled(start,end2).reduce((s,e)=>s+(e.type==="income"?e.amount:-e.amount),0);
    $("two-month-net").textContent=yen.format(two); $("two-month-net").classList.toggle("negative",two<0);
    $("two-month-period").textContent=`${dateText(start)}〜${dateText(end2)}・登録済み予定分`;
    const flows=scheduled(start,addMonths(start,2)); $("flow-list").innerHTML=flows.length?flows.map(f=>`<div class="flow-row"><span class="flow-date">${dateText(f.date)}</span><span class="flow-name">${escapeHTML(f.label)}${f.receipt?'<span class="flow-sub">現金払い・支出記録</span>':""}</span><span class="amount ${f.type}">${f.type==="income"?"+":"−"}${yen.format(f.amount)}</span></div>`).join(""):'<p class="empty">この期間の予定はありません。</p>';
    const month=state.start.slice(0,7), receipts=state.receipts.filter(r=>r.date.slice(0,7)===month), alc=receipts.reduce((s,r)=>s+r.alcohol,0), other=receipts.reduce((s,r)=>s+r.other,0);
    $("month-alcohol").textContent=yen.format(alc);$("month-other").textContent=yen.format(other);$("month-total").textContent=yen.format(alc+other);
    const recent=[...state.receipts].sort((a,b)=>b.date.localeCompare(a.date));
    $("receipt-list").innerHTML=recent.length?recent.map(r=>`<div class="receipt-row"><span class="flow-date">${dateText(r.date)}</span><span class="flow-name">${escapeHTML(r.memo||"レシート")}${r.image?`<span class="flow-sub">📷 ${escapeHTML(r.image)}</span>`:""}</span><span class="receipt-meta">酒 ${yen.format(r.alcohol)} ／ その他 ${yen.format(r.other)}・${r.method==="card"?"カード":"現金"}</span><span class="amount">${yen.format(r.total)}</span><button class="delete-button" type="button" data-delete-receipt="${r.id}" aria-label="削除">削除</button></div>`).join(""):'<p class="empty">まだ支出を記録していません。</p>';
  }
  $("balance").addEventListener("change",e=>{state.balance=Math.max(0,+e.target.value||0);save();});
  $("add-flow-toggle").addEventListener("click",()=>$("flow-form").classList.toggle("hidden"));
  $("flow-form").elements.date.value=state.start;
  $("flow-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.flows.push({id:crypto.randomUUID(),label:f.get("label"),date:f.get("date"),type:f.get("type"),amount:+f.get("amount")});e.currentTarget.reset();e.currentTarget.elements.date.value=state.start;e.currentTarget.classList.add("hidden");save();});
  const imageInput=document.querySelector('[name="image"]'); imageInput.addEventListener("change",()=>$("image-name").textContent=imageInput.files[0]?.name||"写真を選ぶ／撮る");
  $("receipt-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget),total=+f.get("total"),alcohol=+f.get("alcohol"),other=+f.get("other");if(total!==alcohol+other){$("receipt-error").textContent="総額は、酒代とその他の合計に合わせてください。";return;}$("receipt-error").textContent="";state.receipts.push({id:crypto.randomUUID(),date:f.get("date"),total,alcohol,other,method:f.get("method"),memo:f.get("memo"),image:imageInput.files[0]?.name||""});e.currentTarget.reset();e.currentTarget.elements.date.value=toISO(new Date());e.currentTarget.elements.alcohol.value=0;e.currentTarget.elements.other.value=0;$("image-name").textContent="写真を選ぶ／撮る";save();});
  $("receipt-form").elements.date.value=toISO(new Date());
  $("receipt-list").addEventListener("click",e=>{const button=e.target.closest("[data-delete-receipt]");if(button){state.receipts=state.receipts.filter(r=>r.id!==button.dataset.deleteReceipt);save();}});
  render();
})();
