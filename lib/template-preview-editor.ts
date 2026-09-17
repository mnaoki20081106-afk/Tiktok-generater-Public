// Editor-only runtime. Public pages never include this script or editing styles.
export const PREVIEW_TEXT_TARGETS: Record<string, Record<string, string>> = {
  news: { commentCount: '.a-cmt', heading: '.v-title,.a-title', publisher: '.a-src,.a-pub', body: '.a-text', duration: '.v-time', badge: '.a-badge', cta: '.a-cta-btn' },
  instagram: { likeCount: '.ig-bar-like', heading: '.ig-name', headline: '.ig-h', cta: '.ig-btn-main' },
  'instagram-live': { likeCount: '.il-eye', heading: '.il-name', notice: '.il-note p', cta: '.il-note-b', comments: '.il-feed-in' },
  live: { likeCount: '.lv-eye', heading: '.lv-nm', cta: '.lv-cta span', comments: '.lv-feed-in' },
  x: { likeCount: '.x-stats > span:nth-child(2) b,.x-like', commentCount: '.x-actions > span:first-child', shareCount: '.x-stats > span:first-child b,.x-actions > span:nth-child(2)', heading: '.x-name', handle: '.x-handle', body: '.x-text', cta: '.x-open,.x-cta a' },
  youtube: { likeCount: '.yt-seg a:first-child', commentCount: '.yt-cm-h > span:first-of-type', heading: '.yt-title', duration: '.yt-time', ago: '.yt-subtxt > span:last-child', channel: '.yt-chip:nth-child(2)', handle: '.yt-subtxt b', teaser: '.yt-cm-t > span:last-child', cta: '.yt-btn.yt-sb' },
  file: { heading: '.gf h1,.gf h2', cta: '.gf-dl' },
};
export function previewEditorHtml(mode: string, token: string, options: object): string {
  const config = JSON.stringify({ mode, token, options, targets: PREVIEW_TEXT_TARGETS[mode] }).replace(/</g, '\\u003c');
  return `<style>
[data-edit-text]{pointer-events:auto!important;cursor:text;white-space:pre-wrap;min-width:24px;min-height:1em;outline:1px dashed #69dfff66;outline-offset:3px}
[data-edit-text]:focus{outline:2px solid #67e8f9;box-shadow:0 0 14px #38bdf866}
[data-edit-text]:empty::before{content:attr(data-placeholder);color:#67e8f9;font-size:12px}
[data-edit-text]:empty{box-shadow:0 0 12px #38bdf888}
[data-edit-image]{pointer-events:auto!important;cursor:pointer;outline:1px dashed #67e8f9;outline-offset:-2px}
.il-sc-t,.il-sc-b,.lv-sc-t,.lv-sc-b,.ig-play,.il-play,.lv-play,.x-play,.yt-play,.v-play{pointer-events:none!important}
</style><script>(()=>{
const c=${config};
const send=(data)=>parent.postMessage({source:'template-editor',token:c.token,mode:c.mode,...data},'*');
const plain=e=>e.innerText.replace(/\\r/g,'');
function edit(el,key,index){
 if(!el)return;
 const value=index===undefined?c.options[key]:c.options.rows?.[index]?.[key];
 // Keep icons and badges outside the editable text node.
 const span=document.createElement('span');
 span.textContent=String(value??''); 
 if(key==='comments')el.replaceChildren(span);
 else {Array.from(el.childNodes).filter(n=>n.nodeType===3||n.nodeName==='BR').forEach(n=>n.remove());el.prepend(span);if(key==='handle')el.prepend(document.createTextNode('@'));if(key==='duration')el.prepend(document.createTextNode('0:00 / '));}
 span.contentEditable='plaintext-only';span.dataset.editText=key;span.dataset.placeholder='タップして入力（任意）';
 span.setAttribute('role','textbox');span.setAttribute('aria-label',key+'を編集');span.tabIndex=0;
 span.addEventListener('input',()=>{const value=plain(span).slice(0,2000);send({type:'text',key,index,value});if(index===undefined)document.querySelectorAll('[data-edit-text]').forEach(other=>{if(other!==span&&other.dataset.editText===key)other.textContent=value;});});
 span.addEventListener('blur',()=>send({type:'commit'}));
 span.addEventListener('keydown',e=>{if(e.key==='Escape')span.blur();});
}
Object.entries(c.targets||{}).forEach(([key,selector])=>document.querySelectorAll(selector).forEach(el=>{
 if(key!=='comments'){edit(el,key);return;}
 let ps=Array.from(el.querySelectorAll('p'));
 if(!ps.length){const p=document.createElement('p');el.append(p);ps=[p];}
 ps.forEach(p=>{p.contentEditable='plaintext-only';p.dataset.editText='comment-line';p.dataset.placeholder='コメントを入力（任意）';p.setAttribute('aria-label','コメントを編集');p.oninput=()=>send({type:'text',key:'comments',value:ps.map(plain).join('\\n')});});
}));
const rows=document.querySelectorAll(c.mode==='file'?'.gf-row':'.yt-rel');
rows.forEach((row,index)=>edit(row.querySelector(c.mode==='file'?'.gf-nm':'.yt-rel-t'),c.mode==='file'?'name':'title',index));
function pick(kind,index){const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;document.body.append(input);input.addEventListener('change',()=>{const file=input.files[0];if(file)send({type:'image',kind,index,file});input.remove();});input.click();}
const imageSelectors={news:'.v-media',instagram:'.ig-bg','instagram-live':'.il-v',live:'.lv-v',x:'.x-media',youtube:'.yt-v',file:'.editor-no-background'};
const avatars='.ig-av,.il-av,.lv-av,.x-av,.yt-av';
document.querySelectorAll(imageSelectors[c.mode]+','+avatars).forEach(el=>{el.dataset.editImage='true';el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','画像を変更');const open=()=>pick(el.matches(avatars)?'avatar':'background');el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();});el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
rows.forEach((row,index)=>{const el=row.querySelector(c.mode==='file'?'.gf-th':'.yt-rel-th');if(el){el.dataset.editImage='true';el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','サムネイルを変更');el.onclick=e=>{e.preventDefault();e.stopPropagation();pick('row',index);};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick('row',index);}};}});
document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();},true);
document.querySelectorAll('.ig-in').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)pick('background');}));
})();</script>`;
}
