/* Rewritten parity and RAID widgets (10. 11. 2026). Inserted into the artifact by content/adapters/2.1.js before the widgets start;
   they use the artifact's own helpers (a7, sum, esc, segHTML, xorS, $). */

/* Parity table to fill in. Every row is one character ("N = 78"), so the bits can be traced back to the ASCII code,
   the label column is always there, and a new example is a random word instead of random bits. */
WIDGETS.pgfill = host=>{
  const WORDS = ["JAVA","KODA","DISK","BAJT","BITI","DATA","BYTE","RAID"];
  let word = "NOVO", user = null, checked = false;
  const data = ()=>[...word].map(a7).map(s=>[...s].map(Number));
  const exp = ()=>{ const d = data(), rb = d.map(r=>sum(r)%2), cb = d[0].map((_,j)=>sum(d.map(r=>r[j]))%2); return {d, rb, cb, co:sum(cb)%2}; };
  const reset = ()=>{ const d = data(); user = {r:Array(d.length).fill(null), c:Array(d[0].length).fill(null), x:null}; checked = false; };
  reset();
  host.innerHTML = `<div class="wbox"><p class="wnote">Vsaka vrstica je en znak v 7-bitni kodi ASCII (znak = koda). Dopolni paritetne bite za <b>sodo pariteto</b>: bit na desni naredi število enic v vrstici sodo, bit spodaj število enic v stolpcu. Klik na polje ga nastavi na 1, nato na 0 in nazadnje spet izprazni.</p>
    <div class="row"><button class="chip" type="button" data-a="novo">Primer: NOVO</button><button class="chip" type="button" data-a="new">Nov naključen primer</button></div>
    <div class="tbl fit"><table class="pgrid"><tbody class="tb"></tbody></table></div>
    <div class="actions"><button class="btn" type="button" data-a="check">Preveri</button><button class="btn ghost" type="button" data-a="sol">Prikaži rešitev</button><button class="btn ghost" type="button" data-a="clr">Počisti</button></div>
    <p class="wnote res" aria-live="polite"></p>
    <div class="pgwhy"></div></div>`;
  const tb = $(".tb",host), res = $(".res",host), why = $(".pgwhy",host);
  const pcell = (kind,i,val,want)=>{ const cls = checked ? (val===want?" ok":" no") : ""; return `<td class="pb"><button type="button" class="pf${cls}" data-k="${kind}" data-i="${i}" aria-label="paritetni bit ${kind==="r"?"vrstice "+(i+1):kind==="c"?"stolpca "+(i+1):"v kotu"}">${val===null?"":val}</button></td>`; };
  const explain = ()=>{
    const ch = word[0], code = ch.charCodeAt(0);
    why.innerHTML = `<p class="wnote"><b>Od kod so enice in ničle?</b> Vsak znak ima svojo kodo ASCII. Računalnik jo shrani kot dvojiško število v 7 bitih. Pri znaku <b>${esc(ch)}</b> je koda ${code} in ${code}₁₀ = <code>${a7(ch)}</code>₂, zato je prva vrstica <code>${a7(ch)}</code>. Enako velja za vse druge vrstice.</p>
      <p class="wnote"><b>Zakaj sploh računamo paritetne bite?</b> Pošiljatelj podatkom doda paritetne bite in vse skupaj pošlje (po kablu, brezžično) ali shrani (trak, kartica, pomnilnik). Prejemnik v vsaki vrstici in vsakem stolpcu ponovno prešteje enice. Če število ni sodo, je nastala napaka. Če sta napačni natanko ena vrstica in en stolpec, je napačen bit na njunem presečišču, zato ga prejemnik ne samo zazna, ampak tudi popravi (obrne 0 ↔ 1).</p>`;
  };
  const draw = ()=>{
    const e = exp(), C = e.d[0].length;
    host.querySelector('[data-a="novo"]').setAttribute("aria-pressed", String(word==="NOVO"));
    tb.innerHTML = e.d.map((r,i)=>`<tr><td class="lb">${esc(word[i])} = ${word.charCodeAt(i)}</td>${r.map(v=>`<td>${v}</td>`).join("")}${pcell("r",i,user.r[i],e.rb[i])}</tr>`).join("")
      + `<tr><td class="lb">paritetni bit</td>${[...Array(C)].map((_,j)=>pcell("c",j,user.c[j],e.cb[j])).join("")}${pcell("x",0,user.x,e.co)}</tr>`;
    tb.querySelectorAll(".pf").forEach(b=>b.addEventListener("click",()=>{
      const k=b.dataset.k, i=+b.dataset.i; const cur = k==="r"?user.r[i]:k==="c"?user.c[i]:user.x;
      const nx = cur===null?1:cur===1?0:null;
      if(k==="r") user.r[i]=nx; else if(k==="c") user.c[i]=nx; else user.x=nx;
      checked = false; res.textContent = ""; res.className = "wnote res"; draw();
      const nb = tb.querySelector(`.pf[data-k="${k}"][data-i="${i}"]`); if(nb) nb.focus();
    }));
  };
  const check = ()=>{
    const e = exp(); checked = true;
    const all = [...user.r.map((v,i)=>[v,e.rb[i]]), ...user.c.map((v,j)=>[v,e.cb[j]]), [user.x,e.co]];
    const good = all.filter(([v,w])=>v===w).length, empty = all.filter(([v])=>v===null).length;
    draw();
    res.className = "wnote res " + (good===all.length?"ok":"bad");
    res.innerHTML = good===all.length ? `Vse pravilno: ${all.length} od ${all.length}. Bit v kotu je pariteta paritetnih bitov: dobiš ga iz desnega stolpca in iz spodnje vrstice enako.` : `Pravilnih je ${good} od ${all.length}${empty?` (${empty} polj je praznih)`:""}. Rdeča polja popravi: za vrstico preštej enice v vrstici, za stolpec enice v stolpcu, nato izberi bit tako, da bo število enic sodo.`;
  };
  const fresh = w=>{ word = w; reset(); res.textContent = ""; res.className = "wnote res"; explain(); draw(); };
  host.querySelectorAll("[data-a]").forEach(b=>b.addEventListener("click",()=>{
    const a=b.dataset.a;
    if(a==="check") check();
    else if(a==="sol"){ const e=exp(); user = {r:e.rb.slice(), c:e.cb.slice(), x:e.co}; checked=true; draw(); res.className="wnote res"; res.textContent="Rešitev je izpolnjena."; }
    else if(a==="clr"){ reset(); res.textContent=""; res.className="wnote res"; draw(); }
    else if(a==="novo") fresh("NOVO");
    else if(a==="new"){ const pool = WORDS.filter(x=>x!==word); fresh(pool[rint(pool.length)]); }
  }));
  explain(); draw();
};

/* RAID 5 step by step: first how the parity block P comes out of the three data disks (column by column), then what happens
   when one disk fails and how its bits are rebuilt, again column by column, with the arithmetic written out. */
WIDGETS.raid = host=>{
  const names = ["Disk 1","Disk 2","Disk 3","Disk P"], N = 8;
  const d = ["10110010","01101100","11100101"], P = xorS(xorS(d[0],d[1]),d[2]), all = [...d, P];
  let phase = 1, failed = 1, k = 0;
  const eni = o => ["nobene enice","eno enico","dve enici","tri enice","štiri enice"][o];
  host.innerHTML = `<div class="wbox raid"><p class="wnote">Trije diski hranijo podatke, četrti (Disk P) hrani <b>paritetni blok</b>. Vsak disk ima tu 8 bitov. P je izbran tako, da je v <b>vsakem stolpcu</b> število enic na vseh štirih diskih sodo. To je XOR podatkovnih bitov in ista ideja kot vzdolžna pariteta.</p>
    <div class="row"><span class="eyebrow">Korak</span>${segHTML([[1,"1. Kako nastane P"],[2,"2. Disk odpove in obnova"]],1,"data-ph")}</div>
    <div class="row rf" hidden><span class="eyebrow">Odpove</span>${segHTML([[0,"Disk 1"],[1,"Disk 2"],[2,"Disk 3"],[3,"Disk P"]],1,"data-f")}</div>
    <div class="tbl fit rgrid"></div>
    <div class="rline" aria-live="polite"></div>
    <div class="actions"><button class="btn" type="button" data-a="next">Naslednji bit</button><button class="btn ghost" type="button" data-a="all">Prikaži vse</button><button class="btn ghost" type="button" data-a="again">Znova</button></div>
    <div class="rnote"></div></div>`;
  const grid = $(".rgrid",host), line = $(".rline",host), note = $(".rnote",host);
  const draw = ()=>{
    host.querySelectorAll("[data-ph]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.ph===phase)));
    host.querySelectorAll("[data-f]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.f===failed)));
    $(".rf",host).hidden = phase!==2;
    $('[data-a="next"]',host).disabled = k>=N;
    grid.innerHTML = `<table class="rt"><tbody>${names.map((n,i)=>{
      const dead = phase===2 && i===failed;
      const cells = [...Array(N)].map((_,j)=>{
        let cls = "bt", txt = all[i][j];
        if(phase===1 && i===3){ if(j>=k){ txt = "?"; cls += " q"; } else cls += " new"; }
        if(dead){ if(j>=k){ txt = "?"; cls += " lost"; } else cls += " new"; }
        return `<td class="${k>0 && j===k-1 ? "cur" : ""}"><span class="${cls}">${txt}</span></td>`;
      }).join("");
      return `<tr class="${i===2?"ln ":""}${i===3?"par ":""}${dead?"dead":""}"><th scope="row">${n}${i===3?" (paritetni)":""}${dead?` <span class="x">odpovedal</span>`:""}</th>${cells}</tr>`;
    }).join("")}</tbody></table>`;
    const j = k-1;
    if(phase===1){
      if(k===0) line.innerHTML = `Pritisni »Naslednji bit«. Za vsak stolpec se izračuna bit na paritetnem disku.`;
      else if(k<N){ const b = [0,1,2].map(i=>+d[i][j]), o = sum(b);
        line.innerHTML = `<b>Stolpec ${k}:</b> ${b.join(" XOR ")} = <b>${P[j]}</b>. Podatkovni biti imajo ${eni(o)}. Da jih je skupaj sodo, je P = ${P[j]}.`; }
      else line.innerHTML = `<b>Vsi stolpci:</b> P = ${d[0]} XOR ${d[1]} XOR ${d[2]} = <b>${P}</b>. Vsi diski delujejo.`;
    } else {
      const surv = [0,1,2,3].filter(i=>i!==failed);
      if(k===0) line.innerHTML = `<b>${names[failed]} je odpovedal</b>, njegovi biti so izgubljeni (?). Pritisni »Naslednji bit«: vsak izgubljeni bit se izračuna iz preostalih treh diskov v istem stolpcu.`;
      else if(k<N){ const b = surv.map(i=>+all[i][j]), o = sum(b);
        line.innerHTML = `<b>Stolpec ${k}:</b> ${surv.map(i=>names[i]).join(" XOR ")} = ${b.join(" XOR ")} = <b>${all[failed][j]}</b>. Preostali imajo ${eni(o)}. Da jih je skupaj sodo, mora biti izgubljeni bit ${all[failed][j]}.`; }
      else line.innerHTML = `<b>Obnovljeno:</b> ${names[failed]} = <b>${all[failed]}</b>. Enako kot pred odpovedjo ✓ Vsi podatki so spet na voljo.`;
    }
    note.innerHTML = phase===1
      ? `<p class="wnote">XOR dveh bitov je 1, kadar sta različna. Pri treh bitih je rezultat 1, kadar je enic <b>liho</b> mnogo. Zato paritetni bit vedno dopolni število enic v stolpcu na sodo.</p>`
      : `<p class="wnote"><b>Zakaj to deluje?</b> V vsakem stolpcu je število enic na štirih diskih sodo. Ko en bit izgine, ga dopolnimo do sodega: to je XOR preostalih treh. Matematično: iz P = A XOR B XOR C sledi B = A XOR C XOR P, ker je XOR sam sebi obraten. Če odpovesta dva diska, sta v stolpcu dve neznanki in obnova ni mogoča.</p>
        <p class="wnote"><b>V praksi:</b> pri pravem RAID 5 so paritetni bloki razporejeni po vseh diskih (ne samo po enem), disk, ki odpove, se zamenja z novim in sistem med obnovo prebere vse preostale diske. Če odpove paritetni disk, se P preprosto izračuna na novo iz podatkovnih diskov.</p>`;
  };
  host.querySelectorAll("[data-ph]").forEach(b=>b.addEventListener("click",()=>{ phase = +b.dataset.ph; k = 0; draw(); }));
  host.querySelectorAll("[data-f]").forEach(b=>b.addEventListener("click",()=>{ failed = +b.dataset.f; k = 0; draw(); }));
  host.querySelectorAll("[data-a]").forEach(b=>b.addEventListener("click",()=>{
    const a = b.dataset.a;
    if(a==="next") k = Math.min(N, k+1); else if(a==="all") k = N; else k = 0;
    draw();
  }));
  draw();
};
