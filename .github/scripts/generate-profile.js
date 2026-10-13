#!/usr/bin/env node
// Builds a single animated GitHub profile dashboard SVG from live public GitHub data.
const fs = require('node:fs');
const path = require('node:path');
const USER = process.env.GITHUB_USER || 'ABHI2412-debug';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error('GITHUB_TOKEN is required. Pass the METRICS_TOKEN Actions secret.');

const QUERY = `query ($login: String!) {
  user(login: $login) {
    login name bio
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes { name description stargazerCount forkCount primaryLanguage { name color } url isFork }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar { totalContributions weeks { contributionDays { contributionCount date weekday } } }
    }
  }
}`;

async function fetchUser() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'abhi-profile-dashboard' },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } })
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length || !json.data?.user) throw new Error(json.errors?.map(e => e.message).join('; ') || `User ${USER} not found`);
  return json.data.user;
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fmt = n => Number(n || 0).toLocaleString('en-US');
const truncate = (s,n) => String(s || '').length > n ? String(s).slice(0,n-1).trimEnd()+'…' : String(s || '');

function render(user) {
  const W = 900;
  const reposAll = user.repositories.nodes;
  const repos = reposAll.filter(r => !r.isFork);
  const stars = reposAll.reduce((s,r) => s + r.stargazerCount,0);
  const forks = reposAll.reduce((s,r) => s + r.forkCount,0);
  const cc = user.contributionsCollection.contributionCalendar;
  const languagesMap = {};
  repos.forEach(r => { if (r.primaryLanguage) { const n=r.primaryLanguage.name; languagesMap[n] ||= {name:n,color:r.primaryLanguage.color || '#7ee7ff',count:0}; languagesMap[n].count++; }});
  let languages = Object.values(languagesMap).sort((a,b)=>b.count-a.count).slice(0,8);
  if (!languages.length) languages = [{name:'JavaScript',color:'#f1e05a',count:1},{name:'Dart',color:'#00B4AB',count:1},{name:'TypeScript',color:'#3178c6',count:1},{name:'Python',color:'#3572A5',count:1}];
  const totalLang = languages.reduce((s,l)=>s+l.count,0);
  languages = languages.map(l=>({...l,pct:Math.round(l.count/totalLang*100)}));
  if (languages.length) languages[languages.length-1].pct += 100-languages.reduce((s,l)=>s+l.pct,0);

  let projects = repos.filter(r=>r.description).slice(0,3);
  for (const r of repos) if (projects.length<3 && !projects.some(p=>p.name===r.name)) projects.push(r);
  const fallback = [
    {name:'ZenTrade',description:'Digital trading platform focused on real-time market data, WebSockets, Redis and PostgreSQL.',primaryLanguage:{name:'TypeScript',color:'#3178c6'},stargazerCount:0,forkCount:0,url:`https://github.com/${USER}`},
    {name:'Location-Based Meta Game',description:'Flutter and Flame mobile game with maps and location-aware gameplay.',primaryLanguage:{name:'Dart',color:'#00B4AB'},stargazerCount:0,forkCount:0,url:`https://github.com/${USER}`},
    {name:'FPS Bodycam Game',description:'First-person bodycam-style game developed using Unreal Engine 5 and Blueprints.',primaryLanguage:{name:'Unreal Engine 5',color:'#d5adff'},stargazerCount:0,forkCount:0,url:`https://github.com/${USER}`}
  ];
  while (projects.length<3) projects.push(fallback[projects.length]);

  let chips='', cx=36, cy=332;
  for (const t of ['Flutter','Dart','React','Node.js','PostgreSQL','MongoDB','Firebase','Docker','Redis','Unreal Engine 5','Flame','Python']) {
    const w=Math.max(74,t.length*7.1+25);
    if (cx+w>W-32) {cx=36;cy+=36;}
    chips+=`<g><rect x="${cx}" y="${cy}" width="${w}" height="27" rx="13.5" fill="#fff" fill-opacity=".035" stroke="#b6a0ff" stroke-opacity=".28"/><text x="${cx+w/2}" y="${cy+17.5}" text-anchor="middle" class="chip">${esc(t)}</text></g>`;
    cx+=w+8;
  }
  const techEnd=cy+45, statsY=techEnd+23;
  const statItems=[['PUBLIC REPOS',fmt(user.repositories.totalCount),'#7ee7ff'],['TOTAL STARS',fmt(stars),'#ffcc66'],['FORKS',fmt(forks),'#d5adff'],['COMMITS THIS YEAR',fmt(user.contributionsCollection.totalCommitContributions),'#ff8bc8']];
  const stats=statItems.map((s,i)=>{const x=34+i*212;return `<g><rect x="${x}" y="${statsY}" width="198" height="88" rx="13" fill="#0b0b19" stroke="#a794ff" stroke-opacity=".18"/><text x="${x+16}" y="${statsY+37}" class="statValue">${esc(s[1])}</text><text x="${x+16}" y="${statsY+63}" font-size="10" letter-spacing="1.5" fill="${s[2]}" font-weight="700">${esc(s[0])}</text></g>`}).join('');

  const langY=statsY+111, barX=36, barY=langY+43, barW=828;
  let bx=barX, bar='';
  languages.forEach((l,i)=>{const w=i===languages.length-1?barX+barW-bx:barW*l.pct/100;bar+=`<rect x="${bx.toFixed(1)}" y="${barY}" width="${Math.max(0,w).toFixed(1)}" height="10" rx="4" fill="${esc(l.color)}"/>`;bx+=w;});
  const legend=languages.map((l,i)=>{const x=42+(i%4)*210,y=langY+88+Math.floor(i/4)*30;return `<g><circle cx="${x}" cy="${y-4}" r="4.5" fill="${esc(l.color)}"/><text x="${x+13}" y="${y}" class="body">${esc(l.name)}</text><text x="${x+197}" y="${y}" text-anchor="end" class="muted">${l.pct}%</text></g>`}).join('');

  const calY=langY+167, weeks=cc.weeks.slice(-53), gridX=49, gridY=calY+41, step=14, cell=10;
  const levels=['#151525','#263554','#365b90','#4d91c9','#7ee7ff'];
  let cells='',monthMarks='',lastMonth='';
  weeks.forEach((week,wi)=>{
    const sunday=week.contributionDays.find(d=>d.weekday===0)||week.contributionDays[0];
    const month=sunday?.date?.slice(0,7);
    if(month && month!==lastMonth){ monthMarks+=`<text x="${gridX+wi*step}" y="${gridY-12}" class="muted" font-size="10">${new Date(sunday.date+'T00:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'})}</text>`;lastMonth=month; }
    week.contributionDays.forEach(d=>{const n=d.contributionCount||0,lv=n===0?0:n<=2?1:n<=5?2:n<=9?3:4;cells+=`<rect x="${gridX+wi*step}" y="${gridY+(d.weekday||0)*step}" width="${cell}" height="${cell}" rx="2" fill="${levels[lv]}"><title>${esc(d.date)}: ${n} contributions</title></rect>`;});
  });
  const calCells=monthMarks+cells;
  const projectY=calY+169;
  const cards=projects.slice(0,3).map((p,i)=>{
    const x=34+i*282,y=projectY+32,w=268,h=145,accent=['#7ee7ff','#d5adff','#ff8bc8'][i];
    const title=truncate(p.name,25),desc=truncate(p.description||'Explore this repository for source code and project details.',82);
    const lines=[];for(let j=0;j<desc.length;j+=34) lines.push(desc.slice(j,j+34));
    const descSvg=lines.slice(0,3).map((line,j)=>`<text x="${x+16}" y="${y+58+j*15}" class="muted">${esc(line)}</text>`).join('');
    const language=p.primaryLanguage?.name||'Project';
    return `<a xlink:href="${esc(p.url)}"><g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#0b0b19" stroke="${accent}" stroke-opacity=".34"/><rect x="${x+16}" y="${y+16}" width="3" height="22" rx="1.5" fill="${accent}"/><text x="${x+28}" y="${y+31}" class="projectTitle">${esc(title)}</text>${descSvg}<line x1="${x+16}" y1="${y+108}" x2="${x+w-16}" y2="${y+108}" stroke="#fff" stroke-opacity=".08"/><circle cx="${x+21}" cy="${y+125}" r="4" fill="${esc(p.primaryLanguage?.color||accent)}"/><text x="${x+32}" y="${y+129}" class="small">${esc(language)}</text><text x="${x+w-16}" y="${y+129}" text-anchor="end" class="small">★ ${fmt(p.stargazerCount)}  ⑂ ${fmt(p.forkCount)}</text></g></a>`;
  }).join('');
  const H=projectY+221, name=user.name||user.login, bio=user.bio||'Building mobile apps, full-stack products and interactive digital experiences.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub profile dashboard for ${esc(name)}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080812"/><stop offset=".55" stop-color="#0a0a16"/><stop offset="1" stop-color="#090714"/></linearGradient><radialGradient id="glowA"><stop offset="0" stop-color="#713cff" stop-opacity=".48"/><stop offset="1" stop-color="#713cff" stop-opacity="0"/></radialGradient><radialGradient id="glowB"><stop offset="0" stop-color="#00c8dd" stop-opacity=".34"/><stop offset="1" stop-color="#00c8dd" stop-opacity="0"/></radialGradient><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#9c83ff" stroke-opacity=".045" stroke-width=".8"/></pattern></defs>
<style>text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}.chip{font-size:11px;fill:#d9d4ed}.section{font-size:10px;fill:#9b8be6;letter-spacing:3px;font-weight:800}.body{font-size:12px;fill:#e8e7f2}.muted{font-size:10.5px;fill:#9a9aaf}.small{font-size:10px;fill:#9b9bb2}.statValue{font-size:27px;font-weight:800;fill:#fff;letter-spacing:-.6px}.projectTitle{font-size:13px;font-weight:800;fill:#f7f5ff}@keyframes floatA{0%,100%{transform:translate(0,0);opacity:.55}50%{transform:translate(26px,-16px);opacity:.9}}@keyframes floatB{0%,100%{transform:translate(0,0);opacity:.45}50%{transform:translate(-22px,18px);opacity:.8}}@keyframes pulse{0%,100%{opacity:.22}50%{opacity:.58}}@keyframes scan{0%{transform:translateX(-450px)}100%{transform:translateX(1100px)}}.orbA{animation:floatA 9s ease-in-out infinite}.orbB{animation:floatB 11s ease-in-out infinite}.ring{animation:pulse 7s ease-in-out infinite}.scan{animation:scan 10s linear infinite}a{text-decoration:none}</style>
<rect width="${W}" height="${H}" rx="22" fill="url(#bg)" stroke="#9180d9" stroke-opacity=".25"/><rect width="${W}" height="${H}" rx="22" fill="url(#grid)"/><ellipse class="orbA" cx="145" cy="105" rx="245" ry="160" fill="url(#glowA)"/><ellipse class="orbB" cx="765" cy="82" rx="210" ry="145" fill="url(#glowB)"/><ellipse class="orbA" cx="520" cy="210" rx="180" ry="95" fill="url(#glowA)" opacity=".3"/><circle class="ring" cx="450" cy="135" r="96" fill="none" stroke="#b8a4ff" stroke-opacity=".3"/><circle class="ring" cx="450" cy="135" r="134" fill="none" stroke="#7ee7ff" stroke-opacity=".19" style="animation-delay:1.7s"/><path d="M34 30h24M34 30v24M866 30h-24M866 30v24" stroke="#7ee7ff" stroke-opacity=".65" stroke-width="2" fill="none"/><rect class="scan" x="-300" y="0" width="300" height="280" fill="#fff" opacity=".025"/>
<text x="42" y="58" fill="#7ee7ff" font-size="10" letter-spacing="4" font-weight="800">DEVELOPER PROFILE / 01</text><text x="42" y="111" fill="#fff" font-size="42" font-weight="850" letter-spacing="-1.6">${esc(truncate(name.toUpperCase(),23))}</text><text x="44" y="143" fill="#d5adff" font-size="12" letter-spacing="2.1" font-weight="750">SOFTWARE DEVELOPER · MOBILE · FULL STACK</text><text x="44" y="169" fill="#b4b3ca" font-size="12">${esc(truncate(bio,88))}</text><text x="44" y="205" fill="#797992" font-size="10" letter-spacing="2">MOBILE SYSTEMS / REAL-TIME APPS / INTERACTIVE EXPERIENCES</text><text x="44" y="246" fill="#7ee7ff" font-size="10" letter-spacing="1.5">github.com/${esc(user.login)}</text><text x="858" y="246" text-anchor="end" fill="#7e7b95" font-size="10">PROFILE DASHBOARD · LIVE DATA</text>
<text x="36" y="${techEnd-11}" class="section">TECHNOLOGY STACK</text>${chips}
<text x="36" y="${statsY-16}" class="section">GITHUB AT A GLANCE</text>${stats}
<text x="36" y="${langY+17}" class="section">LANGUAGE SIGNAL</text><text x="863" y="${langY+17}" text-anchor="end" class="muted">Public repositories · primary language</text><rect x="${barX}" y="${barY}" width="${barW}" height="10" rx="4" fill="#1c1c2b"/>${bar}${legend}
<text x="36" y="${calY+20}" class="section">ACTIVITY PULSE</text><text x="864" y="${calY+20}" text-anchor="end" class="muted">${fmt(cc.totalContributions)} contributions this year</text>${calCells}<text x="36" y="${calY+145}" class="muted">Less</text>${levels.map((c,i)=>`<rect x="72" y="${calY+135}" width="10" height="10" rx="2" fill="${c}" transform="translate(${i*15},0)"/>`).join('')}<text x="158" y="${calY+145}" class="muted">More</text>
<text x="36" y="${projectY+18}" class="section">PROJECTS / SELECTED REPOSITORIES</text>${cards}<text x="450" y="${H-17}" text-anchor="middle" fill="#62617b" font-size="9" letter-spacing="2">BUILD · EXPERIMENT · IMPROVE — ${esc(user.login.toUpperCase())}</text></svg>`;
}
(async()=>{
  const user=await fetchUser();
  const svg=render(user);
  const outDir=path.join(process.cwd(),'.github','assets');
  fs.mkdirSync(outDir,{recursive:true});
  const out=path.join(outDir,'profile.svg');
  fs.writeFileSync(out,svg,'utf8');
  console.log(`Generated ${out} (${Math.round(Buffer.byteLength(svg)/1024)} KB)`);
})();
