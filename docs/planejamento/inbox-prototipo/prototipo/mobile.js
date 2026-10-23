(function(){
if(window.__crmMobile)return;window.__crmMobile=true;
const vp=()=>{const w=window.innerWidth;return w<700?'phone':w<1100?'tablet':'desktop';};
const setVp=()=>{const v=vp();if(document.documentElement.dataset.vp!==v)document.documentElement.dataset.vp=v;};
setVp();window.addEventListener('resize',setVp);
const head=document.head;
[['viewport','width=device-width, initial-scale=1, viewport-fit=cover'],['theme-color','#0b0e10'],['apple-mobile-web-app-capable','yes'],['mobile-web-app-capable','yes']].forEach(([n,c])=>{let m=head.querySelector('meta[name="'+n+'"]');if(!m){m=document.createElement('meta');m.name=n;head.appendChild(m);}m.content=c;});

// Design system: geometria (pílulas, círculos) aplicada a todas as telas
{const g=document.createElement('style');g.id='crm-ds-css';g.textContent=`
body,button,input,textarea,select{font-family:"Interface Sans","Segoe UI",Roboto,system-ui,sans-serif}
button[style*="height:"][style*="padding:0 "]{border-radius:999px!important}
button[style*="width:"][style*="height:"]:not([style*="padding:0 "]):not([style*="padding:2px"]):not([style*="width:20px"]):not([style*="width:18px"]):not([style*="width:24px"]){border-radius:50%!important}
textarea[style*="border-radius:12px"],div[style*="height:38px"][style*="border-radius:10px"],div[style*="height:34px"][style*="border-radius:9px"]{border-radius:22px!important}
[style*="z-index"][style*="border-radius:16px"]{border-radius:14px!important}
:where(button,a,input,textarea,select):focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;head.appendChild(g);}
const P='[data-vp=phone]',T='[data-vp=tablet]';
const css=`
crm-tabbar{display:none}
${P} crm-tabbar{display:block}
[data-m=back],[data-m=phone-only]{display:none!important}
${P} [data-m=back],${P} [data-m=phone-only]{display:grid!important}
${P} [data-m=hide-phone]{display:none!important}
${P} [data-m=root],${T} [data-m=root]{min-width:0!important}
${P} [data-m=root]{width:100vw!important;height:100dvh!important;padding-bottom:calc(58px + env(safe-area-inset-bottom))!important}
${P} [data-m=rail]{display:none!important}
${P} [data-m=page-pad]{padding-left:14px!important;padding-right:14px!important}
${P} [data-m=wrap]{flex-wrap:wrap!important}
${P} [data-m=list]{width:100%!important;flex:1 1 auto!important;border-right:0!important}
${P} [data-m=panel]{width:100%!important;flex:1 1 auto!important;border-left:0!important}
${P} [data-m=chat]{width:100%!important}
${P} [data-mview=list] [data-m=chat],${P} [data-mview=list] [data-m=panel]{display:none!important}
${P} [data-mview=chat] [data-m=list],${P} [data-mview=chat] [data-m=panel]{display:none!important}
${P} [data-mview=panel] [data-m=list],${P} [data-mview=panel] [data-m=chat]{display:none!important}
${P} [data-mview=detail] [data-m=list]{display:none!important}
${T} [data-m=list]{max-width:44vw}
${P} [data-mview=list] [data-m=detail]{display:none!important}
${P} [data-m=detail]{width:100%!important;flex:1 1 auto!important;border-left:0!important;position:static!important;max-width:none!important}
${P} [data-m=shrink]{min-width:0!important}
${P} [data-m=msgs]{padding:12px 10px 8px!important}
${P} [data-m=sheet]{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;max-width:none!important;max-height:85dvh!important;border-radius:18px 18px 0 0!important;z-index:70!important;padding-bottom:calc(12px + env(safe-area-inset-bottom))!important}
${P} [data-m=fullsheet]{position:fixed!important;inset:0!important;width:100%!important;max-width:none!important;height:100dvh!important;max-height:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;z-index:75!important;overflow-y:auto!important;padding-top:env(safe-area-inset-top)!important;padding-bottom:env(safe-area-inset-bottom)!important}
${P} [data-m=sheet]{border-left:0!important;border-right:0!important;border-bottom:0!important;overflow-y:auto!important;box-shadow:0 -12px 40px rgba(0,0,0,.4)!important}
${T} [data-m=list]{width:300px!important}
${T} [data-m=panel]{position:fixed!important;top:0;right:0;bottom:0;z-index:30;box-shadow:-16px 0 40px rgba(0,0,0,.35)}
${P} input,${P} select,${P} textarea{font-size:16px!important}
[data-swipe]{touch-action:pan-y}
`;
const st=document.createElement('style');st.id='crm-mobile-css';st.textContent=css;head.appendChild(st);

// swipe gestures: element with data-swipe; right swipe clicks [data-swipe-right], left swipe clicks [data-swipe-left]
let sw=null;
document.addEventListener('touchstart',e=>{const el=e.target.closest('[data-swipe]');if(!el||e.touches.length!==1)return;sw={el,x:e.touches[0].clientX,y:e.touches[0].clientY,dx:0,lock:null};},{passive:true});
document.addEventListener('touchmove',e=>{if(!sw)return;const dx=e.touches[0].clientX-sw.x,dy=e.touches[0].clientY-sw.y;if(sw.lock===null&&(Math.abs(dx)>8||Math.abs(dy)>8))sw.lock=Math.abs(dx)>Math.abs(dy)?'x':'y';if(sw.lock!=='x')return;const can=dx>0?sw.el.querySelector('[data-swipe-right]'):sw.el.querySelector('[data-swipe-left]');sw.dx=can?dx:dx*.15;sw.el.style.transition='none';sw.el.style.transform='translateX('+sw.dx+'px)';sw.el.style.boxShadow=sw.dx>60?'inset 4px 0 0 var(--accent)':sw.dx<-60?'inset -4px 0 0 var(--warn)':'';},{passive:true});
document.addEventListener('touchend',()=>{if(!sw)return;const {el,dx}=sw;sw=null;el.style.transition='transform .2s, box-shadow .2s';el.style.transform='';el.style.boxShadow='';if(Math.abs(dx)<80)return;const t=el.querySelector(dx>0?'[data-swipe-right]':'[data-swipe-left]');if(t){navigator.vibrate&&navigator.vibrate(12);t.click();}});

const ROLE=()=>{try{return localStorage.getItem('crm-role')||'admin';}catch(e){return 'admin';}};
const page=()=>{const p=decodeURIComponent(location.pathname.split('/').pop()||'').replace('.dc.html','');return p.split(' ')[0];};
const pushState=()=>typeof Notification==='undefined'?'unsupported':Notification.permission;
function notifyDemo(){try{new Notification('Nova mensagem · Mariana Costa',{body:'“Pode ser quinta às 19h?”',tag:'crm-demo'});}catch(e){}}
function askPush(cb){if(typeof Notification==='undefined'){cb&&cb('unsupported');return;}Notification.requestPermission().then(p=>{if(p==='granted')notifyDemo();cb&&cb(p);});}

class CrmTabbar extends HTMLElement{
  connectedCallback(){this.render();}
  render(){
    const r=ROLE(),pg=page();
    const tabs=[['Inbox','icon-message-circle','Conversas'],['Funil','icon-kanban','Funil'],['Tarefas','icon-list-todo','Tarefas'],['Contatos','icon-contact','Contatos']];
    const more=[['Carteira','icon-briefcase',r==='vendedor'?'Minha carteira':'Carteiras'],['Relatorios','icon-trending-up','Relatórios'],['Comissoes','icon-wallet',r==='vendedor'?'Minhas comissões':'Comissões'],...(r==='vendedor'?[]:[['Agente','icon-bot','Agente de IA']]),['Configuracoes','icon-settings','Configurações']];
    const inMore=more.some(m=>m[0]===pg);
    const btn=(on,icon,label,attr)=>`<button ${attr} aria-current="${on?'page':'false'}" style="position:relative;flex:1;min-width:0;height:58px;border:0;background:transparent;color:${on?'var(--accent)':'var(--mute)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:${on?700:500} 10.5px Roboto,system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent">${on?'<span style="position:absolute;top:0;left:22%;right:22%;height:3px;border-radius:0 0 3px 3px;background:var(--accent)"></span>':''}<span style="display:grid;place-items:center;width:52px;height:28px;border-radius:14px;background:${on?'var(--accent-soft)':'transparent'}"><i class="${icon}" style="font-size:20px"></i></span><span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${label}</span></button>`;
    const ps=pushState();const asked=(()=>{try{return localStorage.getItem('crm-push-asked');}catch(e){return '1';}})();
    this.innerHTML=`
<div data-bar style="position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--rail);border-top:1px solid var(--line);display:flex;padding-bottom:env(safe-area-inset-bottom)">
${tabs.map(([p,i,l])=>btn(p===pg,i,l,`data-go="${p}"`)).join('')}${(()=>{const cur=more.find(x=>x[0]===pg);return cur?btn(true,cur[1],cur[2],'data-more'):btn(false,'icon-menu','Mais','data-more');})()}
</div>
${ps==='default'&&!asked?`<div data-push style="position:fixed;left:10px;right:10px;top:calc(10px + env(safe-area-inset-top));z-index:65;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.35);padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-family:Roboto,system-ui,sans-serif;color:var(--ink)"><div style="display:flex;gap:10px;font-size:13px;line-height:1.45"><i class="icon-bell-ring" style="flex:none;font-size:18px;color:var(--accent)"></i><span>Receba aviso de mensagem nova, contato sem resposta e tarefa vencendo, mesmo com o app fechado.</span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button data-push-no style="height:34px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:var(--mute);font:500 13px Roboto,sans-serif">Agora não</button><button data-push-yes style="height:34px;padding:0 14px;border:0;border-radius:9px;background:var(--accent);color:var(--accent-ink);font:600 13px Roboto,sans-serif">Ativar avisos</button></div></div>`:''}
<div data-sheet-bg style="display:none;position:fixed;inset:0;z-index:66;background:rgba(0,0,0,.45)"></div>
<div data-sheet style="display:none;position:fixed;left:0;right:0;bottom:0;z-index:67;background:var(--surface);border-radius:18px 18px 0 0;border-top:1px solid var(--line);padding:8px 10px calc(14px + env(safe-area-inset-bottom));font-family:Roboto,system-ui,sans-serif;color:var(--ink);max-height:85dvh;overflow-y:auto">
<div style="width:36px;height:4px;border-radius:2px;background:var(--elev2);margin:4px auto 10px"></div>
${more.map(([p,i,l])=>`<button data-go="${p}" style="display:flex;align-items:center;gap:14px;width:100%;height:52px;padding:0 12px;border:0;border-radius:11px;background:${p===pg?'var(--elev)':'transparent'};color:var(--ink);font:500 15px Roboto,sans-serif;text-align:left"><i class="${i}" style="font-size:20px;color:${p===pg?'var(--accent)':'var(--mute)'}"></i>${l}</button>`).join('')}
<div style="height:1px;background:var(--line);margin:8px 6px"></div>
<button data-push-row style="display:flex;align-items:center;gap:14px;width:100%;min-height:52px;padding:6px 12px;border:0;border-radius:11px;background:transparent;color:var(--ink);font:500 15px Roboto,sans-serif;text-align:left"><i class="icon-bell" style="font-size:20px;color:var(--mute)"></i><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span>Notificações push</span><span style="font-size:12px;color:var(--mute)">${ps==='granted'?'Ativadas · toque para testar':ps==='denied'?'Bloqueadas no navegador':ps==='unsupported'?'Instale o app na tela inicial para ativar':'Desativadas · toque para ativar'}</span></span></button>
<button data-theme style="display:flex;align-items:center;gap:14px;width:100%;height:52px;padding:0 12px;border:0;border-radius:11px;background:transparent;color:var(--ink);font:500 15px Roboto,sans-serif;text-align:left"><i class="icon-sun-moon" style="font-size:20px;color:var(--mute)"></i>Alternar tema</button>
<div style="padding:10px 12px 4px;font-size:11px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.06em">Ver o produto como</div>
<div style="display:flex;gap:6px;padding:4px 8px 6px">${[['admin','Admin'],['gerente','Gerente'],['vendedor','Vendedor']].map(([id,l])=>`<button data-role="${id}" style="flex:1;height:40px;border-radius:10px;border:1px solid ${r===id?'var(--accent)':'var(--line)'};background:${r===id?'var(--accent-soft)':'transparent'};color:var(--ink);font:500 13px Roboto,sans-serif">${l}</button>`).join('')}</div>
</div>`;
    const sheet=this.querySelector('[data-sheet]'),bg=this.querySelector('[data-sheet-bg]');
    const open=v=>{sheet.style.display=bg.style.display=v?'block':'none';};
    this.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{location.href=b.dataset.go+'.dc.html';});
    this.querySelector('[data-more]').onclick=()=>open(true);bg.onclick=()=>open(false);
    this.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{try{localStorage.setItem('crm-role',b.dataset.role);}catch(e){}location.reload();});
    this.querySelector('[data-theme]').onclick=()=>{const cur=document.documentElement.dataset.theme==='claro'?'claro':'escuro';const t=cur==='escuro'?'claro':'escuro';try{localStorage.setItem('crm-theme',t);}catch(e){}location.reload();};
    this.querySelector('[data-push-row]').onclick=()=>{if(pushState()==='granted')notifyDemo();else askPush(()=>this.render());};
    const pn=this.querySelector('[data-push-no]'),py=this.querySelector('[data-push-yes]');
    if(pn)pn.onclick=()=>{try{localStorage.setItem('crm-push-asked','1');}catch(e){}this.render();};
    if(py)py.onclick=()=>{try{localStorage.setItem('crm-push-asked','1');}catch(e){}askPush(()=>this.render());};
  }
}
customElements.define('crm-tabbar',CrmTabbar);
})();
