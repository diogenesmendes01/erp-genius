(function(){
const ROLES=[['admin','Admin','Configura tudo: canais, IA, integrações e segurança'],['gerente','Gerente de Vendas','Vê toda a equipe e ajusta o que é do time'],['vendedor','Vendedor','Opera o dia a dia com os próprios leads']];
const get=()=>{try{return localStorage.getItem('crm-role')||'admin';}catch(e){return 'admin';}};
window.CRM_ROLE=get;
if(customElements.get('crm-role'))return;
class CrmRole extends HTMLElement{
  connectedCallback(){
    const r=get();const cur=ROLES.find(x=>x[0]===r)||ROLES[0];
    this.style.cssText='position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:6px';
    this.innerHTML=`<button title="Simular papel" style="position:relative;width:34px;height:34px;border:0;padding:0;border-radius:50%;background:oklch(0.6 0.1 220);color:#fff;display:grid;place-items:center;font:600 12px Roboto,system-ui,sans-serif;cursor:pointer">CS<span style="position:absolute;bottom:-1px;right:-1px;width:11px;height:11px;border-radius:50%;background:var(--accent);border:2px solid var(--rail)"></span></button><span style="font:600 9.5px Roboto,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--mute)">${cur[0]==='admin'?'Admin':cur[0]==='gerente'?'Gerente':'Vend.'}</span>`;
    const pop=document.createElement('div');
    pop.style.cssText='display:none;position:fixed;left:72px;bottom:14px;width:290px;background:var(--card, var(--surface));border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow, 0 12px 32px rgba(0,0,0,.35));padding:8px;z-index:9999;font-family:Roboto,system-ui,sans-serif;color:var(--ink)';
    pop.innerHTML=`<div style="padding:8px 10px 10px;display:flex;flex-direction:column;gap:2px;border-bottom:1px solid var(--line);margin-bottom:6px"><span style="font-size:13.5px;font-weight:600">Carlos Santos</span><span style="font-size:12px;color:var(--mute)">Ver o produto como</span></div>`+ROLES.map(([id,l,d])=>`<button data-r="${id}" style="display:flex;align-items:flex-start;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:${id===r?'var(--elev)':'transparent'};color:var(--ink);text-align:left;cursor:pointer;font-family:inherit"><span style="flex:none;margin-top:3px;width:14px;height:14px;border-radius:50%;border:2px solid ${id===r?'var(--accent)':'var(--faint)'};display:grid;place-items:center">${id===r?'<span style="width:6px;height:6px;border-radius:50%;background:var(--accent)"></span>':''}</span><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:500">${l}</span><span style="font-size:11.5px;color:var(--mute);line-height:1.4">${d}</span></span></button>`).join('');
    document.body.appendChild(pop);this._pop=pop;
    const btn=this.querySelector('button');
    btn.onclick=e=>{e.stopPropagation();pop.style.display=pop.style.display==='none'?'block':'none';};
    pop.onclick=e=>{e.stopPropagation();const b=e.target.closest('[data-r]');if(!b)return;try{localStorage.setItem('crm-role',b.dataset.r);}catch(_){}location.reload();};
    this._off=()=>{pop.style.display='none';};document.addEventListener('click',this._off);
  }
  disconnectedCallback(){document.removeEventListener('click',this._off);this._pop&&this._pop.remove();}
}
customElements.define('crm-role',CrmRole);
})();
