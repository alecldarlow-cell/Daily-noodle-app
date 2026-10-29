/**
 * The outlines, drawn as the page draws them: engines/borders.js fitBox, graticule,
 * scaleBar, worldSVG and tileSVG, run inside a small page of their own (an SVG
 * renderer is not among the app's dependencies; react-native-webview, which the
 * bridge already uses, draws them). Only pictures go through it: every rule of the
 * game is the native model's.
 */
import type { BordersQ } from '../model';
import { colourOf } from '../model';
import { WORLD } from '../world';
import type { BordersColors } from './colors';

const css = (c: BordersColors) => `
html,body{margin:0;padding:0;background:transparent;overflow:hidden;-webkit-user-select:none;user-select:none}
svg{display:block}
.grat line{stroke:${c.grat};stroke-width:1}
.gl{fill:${c.ink2};font:12px -apple-system,Roboto,sans-serif;opacity:.8}
.land{stroke:${c.ink};stroke-linejoin:round}
#scale{position:absolute;left:12px;bottom:10px;font:12px -apple-system,Roboto,sans-serif;color:${c.ink}}
.segs{display:flex}.segs i{display:block;height:5px;border:1.25px solid ${c.ink};margin-left:-1.25px}
.segs i:nth-child(odd){background:${c.ink}}
.lab{display:flex;justify-content:space-between;margin-top:2px}
#inset{position:absolute;right:10px;top:10px;width:46%;border:1.5px solid ${c.edge};border-radius:3px;background:${c.globe}}
#inset svg{width:100%;height:auto}
.ring{fill:none;stroke:${c.pin};stroke-width:2}
.dot{fill:${c.pin}}
svg path[fill="#E4F1F1"]{fill:${c.globe};stroke:${c.landEdge}}
svg path[fill="#E9DCAE"]{fill:${c.wland};stroke:${c.landEdge}}
`;

/** The engine's drawing code, verbatim but for the svg's size (the page's own box). */
const DRAW = `
var SVGNS='http://www.w3.org/2000/svg',VB={w:600,h:600,x:0,y:0};
function el(tag,attrs,parent){var e=document.createElementNS(SVGNS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function fitBox(svg){var r=svg.getBoundingClientRect();var rw=r.width||1,rh=Math.max(1,r.height||1);var ar=rw/rh;
 var w=Math.max(600,600*ar),h=Math.max(600,600/ar);VB.w=w;VB.h=h;VB.x=(600-w)/2;VB.y=(600-h)/2;VB.px=rw/w;
 svg.setAttribute('viewBox',VB.x+' '+VB.y+' '+w+' '+h);}
function graticule(c,g){
 var deg=Math.PI/180,spanDeg=VB.w/(c.K*deg);
 var step=[1,2,5,10,15,20,30,45].find(function(s){return spanDeg/s<=5.5})||60;
 var yOf=function(p){return c.ty-c.K*Math.log(Math.tan(Math.PI/4+p*deg/2))};
 var latOf=function(y){return (2*Math.atan(Math.exp((c.ty-y)/c.K))-Math.PI/2)/deg};
 var x0=VB.x,x1=VB.x+VB.w,y0=VB.y,y1=VB.y+VB.h;
 var l0=c.lo+(x0-c.tx)/(c.K*deg),l1=c.lo+(x1-c.tx)/(c.K*deg);
 for(var L=Math.ceil(l0/step)*step;L<=l1;L+=step){var x=c.tx+c.K*(L-c.lo)*deg;el('line',{x1:x,x2:x,y1:y0,y2:y1},g);
  var w=((L+540)%360)-180;var t=el('text',{x:x+6,y:y0+30,'class':'gl'},g);t.textContent=w===0?'0°':Math.abs(w)+'°'+(w>0?'E':'W');if(Math.abs(w)===180)t.textContent='180°';}
 var pa=Math.max(-84,latOf(y1)),pb=Math.min(84,latOf(y0));
 for(var Q=Math.ceil(pa/step)*step;Q<=pb;Q+=step){var y=yOf(Q);el('line',{x1:x0,x2:x1,y1:y,y2:y},g);
  var t2=el('text',{x:x0+14,y:y-7,'class':'gl'},g);t2.textContent=Q===0?'0°':Math.abs(Q)+'°'+(Q>0?'N':'S');}
}
function scaleBar(c){
 var host=document.getElementById('scale');host.innerHTML='';
 var kmPerPx=c.km/(VB.px||1);
 var target=kmPerPx*110;var mag=Math.pow(10,Math.floor(Math.log10(target)));
 var nice=[1,2,2.5,5,10].map(function(m){return m*mag}).filter(function(v){return v<=target}).pop()||mag;
 var px=nice/kmPerPx;var segs=document.createElement('div');segs.className='segs';
 for(var i=0;i<4;i++){var s=document.createElement('i');s.style.width=(px/4+1.25)+'px';segs.appendChild(s);}
 var lab=document.createElement('div');lab.className='lab';lab.style.width=px+'px';
 lab.innerHTML='<span>0</span><span>'+(nice>=1000?nice.toLocaleString('en-GB'):nice)+' km</span>';
 host.appendChild(segs);host.appendChild(lab);
}
function drawLand(svg,c){
 svg.innerHTML='';fitBox(svg);
 var g=el('g',{'class':'grat'},svg);graticule(c,g);
 var p=el('path',{d:c.d,'class':'land',fill:c.fill},svg);
 p.style.strokeWidth=(1.9/(VB.px||0.5))+'px';
}
function worldSVG(s,pin){
 var h=Math.min(W.wh*2,270);s.setAttribute('viewBox','0 0 600 '+h);s.innerHTML='';
 el('path',{d:W.s,fill:'#E4F1F1',stroke:'#1F3A4A','stroke-width':1.5},s);
 el('path',{d:W.w,fill:'#E9DCAE',stroke:'#1F3A4A','stroke-width':1},s);
 if(pin){el('circle',{cx:pin.x*2,cy:pin.y*2,r:6,'class':'ring'},s);el('circle',{cx:pin.x*2,cy:pin.y*2,r:6,'class':'dot',stroke:'#fff','stroke-width':2},s);}
 return s;
}
`;

const esc = (s: string) => s.replace(/</g, '\\u003c');

/** The question's map: its outline on the graticule, the scale bar, and the inset when shown. */
export function mapHtml(q: BordersQ, inset: boolean, c: BordersColors): string {
  const data = { ...q, fill: colourOf(q) };
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${css(c)}
#qmap{position:absolute;inset:0;width:100%;height:100%;background:${c.sea}}</style></head><body>
<svg id="qmap" role="img" aria-label="Country outline"></svg><div id="scale"></div>${inset ? '<div id="inset"><svg></svg></div>' : ''}
<script>var W=${esc(JSON.stringify(WORLD))},C=${esc(JSON.stringify(data))};${DRAW}
function go(){drawLand(document.getElementById('qmap'),C);scaleBar(C);var i=document.querySelector('#inset svg');if(i)worldSVG(i,C);}
go();addEventListener('resize',go);</script></body></html>`;
}

/** The world map on the start card (no pin). */
export function worldHtml(c: BordersColors): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css(c)}</style></head><body>
<svg id="w" style="width:100%;height:auto"></svg><script>var W=${esc(JSON.stringify(WORLD))};${DRAW}worldSVG(document.getElementById('w'),null);</script></body></html>`;
}

/** The finish sheet's ten outlines (the engine's tileSVG), each with its name. */
/** The finish sheet's colours for the outlines (finish.css --f-paper, --f-actT, --f-ink, --f-ink2). */
export interface SheetOutline {
  tile: string;
  fill: string;
  ink: string;
  soft: string;
}

const SHEET_LIGHT: SheetOutline = {
  tile: '#FFFFFF',
  fill: '#DCE4FF',
  ink: '#141726',
  soft: '#545A6E',
};

/**
 * The finish sheet's ten outlines (finish.css .fin-outl): every outline the same pale blue
 * with an ink edge on a white tile, a miss left unfilled with a dashed soft edge and a soft
 * caption, not each country in its map colour.
 */
export function tilesHtml(
  tiles: { q: BordersQ; ok: boolean; caption: string }[],
  c: BordersColors,
  s: SheetOutline = SHEET_LIGHT,
): string {
  const fig = tiles
    .map(
      (t) =>
        `<figure class="${t.ok ? 'ok' : 'x'}"><div class="t"><svg viewBox="0 0 600 600" aria-hidden="true"><path class="land" d="${t.q.d}"/></svg></div><figcaption>${t.caption.replace(/</g, '&lt;')}</figcaption></figure>`,
    )
    .join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${css(c)}
body{display:grid;grid-template-columns:repeat(5,1fr);gap:12px 8px;font:12px -apple-system,Roboto,sans-serif;color:${s.ink}}
figure{margin:0;text-align:center;min-width:0}.t{aspect-ratio:1;background:${s.tile};border-radius:8px;overflow:hidden}
.t svg{width:100%;height:100%;display:block}
.t path{fill:${s.fill};stroke:${s.ink};stroke-width:1.5;vector-effect:non-scaling-stroke}
.x .t path{fill:transparent;stroke:${s.soft};stroke-dasharray:3 2}
figcaption{margin-top:5px;line-height:1.25;overflow-wrap:anywhere}.x figcaption{color:${s.soft}}</style></head><body>${fig}</body></html>`;
}

/**
 * The big locator map (engines/borders.js bigMap, AF-016, website S4): the world inset
 * zoomed to the country's region, the country's outline carried from the question's
 * Mercator frame onto the inset's Equal Earth map point by point and pinned on its own
 * (x, y), drawn in the pin colour, with the pin and (once answered) the name. The page's
 * code, verbatim but for its box.
 */
const BIG = `
var EE={a1:1.340264,a2:-0.081106,a3:0.000893,a4:0.003796,m:Math.sqrt(3)/2,kx:112.4375,ky:-101.3006};
function eqEarth(lon,lat){var r=Math.PI/180,t=Math.asin(EE.m*Math.sin(lat*r)),t2=t*t,t6=t2*t2*t2;
 return [EE.kx*lon*r*Math.cos(t)/(EE.m*(EE.a1+3*EE.a2*t2+t6*(7*EE.a3+9*EE.a4*t2))),EE.ky*t*(EE.a1+EE.a2*t2+t6*(EE.a3+EE.a4*t2))];}
function onWorld(c){
 if(!/^[Mlz0-9 .,-]+$/.test(c.d))return null;
 var r=Math.PI/180,pin=eqEarth(c.lo,c.la),ox=c.x*2-pin[0],oy=c.y*2-pin[1],rings=[];
 var x=0,y=0,ring=null,re=/([Mlz])([^Mlz]*)/g,m;
 var put=function(){var lon=c.lo+(x-c.tx)/(c.K*r),lat=(2*Math.atan(Math.exp((c.ty-y)/c.K))-Math.PI/2)/r,w=eqEarth(lon,lat);ring.push([w[0]+ox,w[1]+oy]);};
 while((m=re.exec(c.d))){var n=(m[2].match(/-?[\\d.]+/g)||[]).map(Number);
  if(m[1]==='M'){x=n[0];y=n[1];ring=[];rings.push(ring);put();for(var i=2;i+1<n.length;i+=2){x+=n[i];y+=n[i+1];put();}}
  else if(m[1]==='l'&&ring){for(var j=0;j+1<n.length;j+=2){x+=n[j];y+=n[j+1];put();}}}
 return rings.filter(function(g){return g.length>1});
}
function bigMap(svg,c,named){
 var rings=onWorld(c)||[];svg.innerHTML='';
 var H=Math.min(W.wh*2,270);
 el('path',{d:W.s,fill:'#E4F1F1',stroke:'#1F3A4A','stroke-width':1.5,'vector-effect':'non-scaling-stroke'},svg);
 el('path',{d:W.w,fill:'#E9DCAE',stroke:'#1F3A4A','stroke-width':1,'vector-effect':'non-scaling-stroke'},svg);
 var x0=c.x*2,x1=c.x*2,y0=c.y*2,y1=c.y*2;
 rings.forEach(function(g){g.forEach(function(p){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];});});
 if(rings.length)el('path',{d:rings.map(function(g){return 'M'+g.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1)}).join('L')+'Z'}).join(''),'class':'bm-land','vector-effect':'non-scaling-stroke'},svg);
 var ar=0.66,cx=(x0+x1)/2,cy=(y0+y1)/2;
 var w=Math.max(84,(x1-x0)*3,(y1-y0)*3/ar);w=Math.min(600,w);var h=Math.min(H,w*ar);w=h/ar>w?w:Math.min(600,h/ar);
 var vx=Math.max(0,Math.min(600-w,cx-w/2)),vy=Math.max(0,Math.min(H-h,cy-h/2));
 svg.setAttribute('viewBox',vx.toFixed(1)+' '+vy.toFixed(1)+' '+w.toFixed(1)+' '+h.toFixed(1));
 var u=w/600;
 el('circle',{cx:c.x*2,cy:c.y*2,r:(9*u).toFixed(2),'class':'ring'},svg).style.strokeWidth=(3*u)+'px';
 el('circle',{cx:c.x*2,cy:c.y*2,r:(5*u).toFixed(2),'class':'dot',stroke:'#fff','stroke-width':(2*u).toFixed(2)},svg);
 if(named){var fs=Math.max(16*u,w*0.05),below=cy+(y1-y0)/2+fs*1.35,ty=below<vy+h-fs*0.4?below:Math.max(vy+fs*1.1,cy-(y1-y0)/2-fs*0.5);
  var t=el('text',{x:Math.max(vx+w*0.2,Math.min(vx+w*0.8,cx)).toFixed(1),y:ty.toFixed(1),'class':'bm-name','text-anchor':'middle','font-size':fs.toFixed(2)},svg);t.textContent=c.n;
  t.style.strokeWidth=(fs*0.22)+'px';}
}
`;

/** The big map for question `q`: named once it has been answered (borders.css #bigMap). */
export function bigMapHtml(q: BordersQ, named: boolean, c: BordersColors): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${css(c)}
#bm{display:block;width:100%;height:100%;background:${c.sea}}
.bm-land{fill:${c.pin};fill-opacity:.85;stroke:${c.ink};stroke-width:1.25px}
.bm-name{font-family:Georgia,serif;font-style:italic;fill:${c.ink};stroke:${c.paper};paint-order:stroke;stroke-linejoin:round}
#bm .ring{stroke:${c.pin}}</style></head><body>
<svg id="bm" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>
<script>var W=${esc(JSON.stringify(WORLD))},C=${esc(JSON.stringify(q))};${DRAW}${BIG}
bigMap(document.getElementById('bm'),C,${named ? 'true' : 'false'});</script></body></html>`;
}
