'use client';
import {useState,useEffect,useRef,useCallback,useMemo} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Play,Pause,RotateCcw,Compass,Clapperboard,Map,ChevronRight,Maximize,Navigation2} from 'lucide-react';
import {type Fix as P,type Flight,world,clamp,sample,renderFixes,motion} from './lib/flight';
import {loadTerrain,makeBridges} from './lib/terrain';
import {makeTrails} from './lib/trails';
import {makeAircraft} from './lib/aircraft';
const XYZ=(p:P)=>new THREE.Vector3(...world(p[1],p[2],Math.max(6,p[3])));
const POS=(lo:number,la:number,y=.02)=>{const [x,,z]=world(lo,la);return new THREE.Vector3(x,y,z);};
function timeLabel(sec:number,start='2026-10-08T19:58:02.290Z'){return new Date(Date.parse(start)+sec*1000).toLocaleTimeString('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit',second:'2-digit'});}
const landmarks:[string,number,number][]=[['GOLDEN GATE',-122.4783,37.8199],['ALCATRAZ',-122.423,37.8267],['FISHERMAN’S WHARF',-122.416,37.809],['CRISSY FIELD',-122.466,37.805],['TREASURE ISLAND',-122.371,37.823],['BAY BRIDGE',-122.376,37.793],['MARINA GREEN',-122.441,37.807],['SF',-122.449,37.77],['OAKLAND',-122.271,37.804]];
const candidates=[{t:1020,label:'01 / LOW APPROACH',note:'~1:15 PM · altitude readings unreliable'},{t:2710,label:'02 / WATERFRONT RUN',note:'~1:43 PM · potential low fast segment'},{t:3360,label:'03 / EASTBOUND PASS',note:'~1:54 PM · potential low pass'}];
function makeGround(scene:THREE.Scene){
 const water=new THREE.Mesh(new THREE.PlaneGeometry(110,110),new THREE.MeshStandardMaterial({color:0x071c2c,roughness:.83,metalness:.2}));water.rotation.x=-Math.PI/2;water.position.y=-.075;scene.add(water);
 const grid=new THREE.GridHelper(110,110,0x24536b,0x17384c);grid.position.y=-.07;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.16;scene.add(grid);
 const shore=[
 [[-122.525,37.70],[-122.525,37.94],[-122.49,37.91],[-122.48,37.87],[-122.478,37.82],[-122.467,37.807],[-122.445,37.805],[-122.417,37.812],[-122.395,37.807],[-122.388,37.79],[-122.39,37.77],[-122.37,37.746],[-122.39,37.70]],
 [[-122.29,38.07],[-122.12,38.07],[-122.12,37.67],[-122.16,37.70],[-122.21,37.73],[-122.22,37.755],[-122.25,37.785],[-122.275,37.798],[-122.286,37.827],[-122.29,37.856],[-122.32,37.88],[-122.37,37.90],[-122.42,37.94]],
 [[-122.421,37.831],[-122.418,37.828],[-122.42,37.823],[-122.427,37.824],[-122.428,37.828]],
 [[-122.38,37.841],[-122.365,37.839],[-122.355,37.81],[-122.373,37.806],[-122.38,37.821]]
 ];
 shore.forEach((ring,n)=>{const s=new THREE.Shape();ring.forEach(([lo,la],i)=>{const v=POS(lo,la);if(!i)s.moveTo(v.x,-v.z);else s.lineTo(v.x,-v.z)});s.closePath();const geo=new THREE.ShapeGeometry(s,4);geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:n>1?0x183d45:0x143841,roughness:1,side:THREE.DoubleSide}));mesh.position.y=-.04;scene.add(mesh);const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring.map(([lo,la])=>POS(lo,la,-.025))),new THREE.LineBasicMaterial({color:0x3d8a95,transparent:true,opacity:.5}));scene.add(border)});
}
export default function Page(){
 const mount=useRef<HTMLDivElement>(null);
 const state=useRef({t:0,playing:true,speed:35,director:true,showAll:false,seekVersion:0});
 const [flight,setFlight]=useState<Flight|null>(null),[error,setError]=useState('');
 const [playing,setPlaying]=useState(true),[director,setDirector]=useState(true),[speed,setSpeed]=useState(35),[time,setTime]=useState(0);
 const [sat,setSat]=useState('LOADING'),[geo,setGeo]=useState('Elevation loading'),[showAll,setShowAll]=useState(false);
 const pts=useMemo(()=>flight?renderFixes(flight.points):null,[flight]);
 useEffect(()=>{
   const abort=new AbortController();
   fetch('/flight.json',{signal:abort.signal}).then(response=>{if(!response.ok)throw new Error('Recording unavailable');return response.json();}).then((data:Flight)=>{
     if(!data.points||renderFixes(data.points).length<2)throw new Error('Invalid recording');setFlight(data);
   }).catch(()=>{if(!abort.signal.aborted)setError('Flight recording could not load. Refresh to retry.');});
   return()=>abort.abort();
 },[]);
 useEffect(()=>{Object.assign(state.current,{playing,speed,director,showAll});},[playing,speed,director,showAll]);
 const seek=useCallback((t:number)=>{state.current.t=t;state.current.seekVersion++;setTime(t);},[]);
 useEffect(()=>{
   if(!pts||!mount.current)return;
   const host=mount.current,scene=new THREE.Scene();scene.background=new THREE.Color(0x061220);scene.fog=new THREE.FogExp2(0x061220,.006);
   const camera=new THREE.PerspectiveCamera(55,host.clientWidth/host.clientHeight,.03,250);camera.position.set(-10,19,24);
   const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setSize(host.clientWidth,host.clientHeight);
   renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.appendChild(renderer.domElement);
   scene.add(new THREE.HemisphereLight(0xd5eaff,0x44526b,2));const sun=new THREE.DirectionalLight(0xffe8cb,2.2);sun.position.set(-25,32,10);scene.add(sun);
   makeGround(scene);makeBridges(scene);
   const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;
   controls.maxPolarAngle=Math.PI*.495;controls.minDistance=.8;controls.maxDistance=95;
   const duration=pts.at(-1)![0],trails=makeTrails(pts,host.clientWidth,host.clientHeight);scene.add(trails.group);
   const aircraft=makeAircraft(),jet=aircraft.jet;scene.add(jet);
   const groundRing=new THREE.Mesh(new THREE.RingGeometry(.16,.2,48),new THREE.MeshBasicMaterial({color:0xffd9a0,side:THREE.DoubleSide,transparent:true,opacity:.65}));groundRing.rotation.x=-Math.PI/2;scene.add(groundRing);
   const drops=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
   const drop=new THREE.Line(drops,new THREE.LineDashedMaterial({color:0x95d6f8,transparent:true,opacity:.48,dashSize:.13,gapSize:.11}));scene.add(drop);
   const rings=candidates.map(c=>{const obj=new THREE.Mesh(new THREE.TorusGeometry(.36,.018,8,64),new THREE.MeshBasicMaterial({color:0xff7730,transparent:true,opacity:.78}));obj.rotation.x=Math.PI/2;obj.position.copy(XYZ(sample(pts,c.t,true).p));scene.add(obj);return obj;});
   const labels=landmarks.map(([label,lo,la])=>{const node=document.createElement('div');node.className='world-label';node.textContent=label;host.appendChild(node);return {node,p:POS(lo,la,.1),screen:new THREE.Vector3()};});
   const abort=new AbortController();
   void loadTerrain(scene,renderer,abort.signal,status=>{
     setSat(status.done?(status.imagery===status.total?'SATELLITE ON':status.imagery?`PARTIAL ${status.imagery}/${status.total}`:'CHART MODE'):`TILES ${status.imagery}/${status.total}`);
     setGeo(status.terrain?`3D elevation ${status.terrain}/${status.total}`:status.done?'Elevation unavailable':'Elevation loading');
   });
   let alive=true,frame=0,prev=performance.now(),ui=0,lastSeek=-1,lastHeading=0,bank=0,wasGap=false;
   const focus=new THREE.Vector3(),targetCamera=new THREE.Vector3(),targetRotation=new THREE.Quaternion(),euler=new THREE.Euler(0,0,0,'YXZ');
   function tick(now:number){
     if(!alive)return;frame=requestAnimationFrame(tick);
     const dt=Math.min((now-prev)/1000,.08);prev=now;const s=state.current;
     if(s.playing){s.t+=dt*s.speed;if(s.t>=duration){s.t=duration;s.playing=false;setPlaying(false);}}
     const {p,gap}=sample(pts!,s.t,true),point=XYZ(p),movement=motion(pts!,s.t);
     jet.position.copy(point);jet.visible=!gap;
     const jumped=lastSeek!==s.seekVersion||wasGap;lastSeek=s.seekVersion;wasGap=gap;
     if(movement.speed>.01){
       const turn=THREE.MathUtils.euclideanModulo(movement.heading-lastHeading+Math.PI,2*Math.PI)-Math.PI;
       const desiredBank=jumped?0:clamp(-turn/Math.max(.01,dt*s.speed)*movement.speed/100,-.6,.6);
       bank=jumped?0:THREE.MathUtils.lerp(bank,desiredBank,1-Math.exp(-dt*6));lastHeading=movement.heading;
       euler.set(clamp(movement.pitch,-.65,.65),movement.heading,bank);targetRotation.setFromEuler(euler);
       // Position is sampled directly; only attitude/camera ease in wall-clock time.
       if(jumped||!s.playing)jet.quaternion.copy(targetRotation);else jet.quaternion.slerp(targetRotation,1-Math.exp(-dt*12));
     }
     aircraft.update(movement.speed,bank,gap);trails.update(s.t,s.showAll);
     groundRing.position.set(point.x,.025,point.z);
     const attr=drops.getAttribute('position') as THREE.BufferAttribute;attr.setXYZ(0,point.x,point.y,point.z);attr.setXYZ(1,point.x,0,point.z);attr.needsUpdate=true;drops.computeBoundingSphere();drop.computeLineDistances();
     rings.forEach((r,j)=>r.scale.setScalar(1+.12*Math.sin(now/350+j)));
     controls.enabled=!s.director;
     if(s.director){
       const phase=s.t/90,cinematic=Math.sin(phase*.43)*.5+.5,sweep=Math.sin(phase*.22)*1.4+Math.PI*.12;
       const dist=clamp(5.5+19*cinematic+7*Math.sin(phase*.17)**2,5,33);
       const next=sample(pts!,Math.min(duration,s.t+12),true);
       focus.copy(point);if(!gap&&!next.gap)focus.lerp(XYZ(next.p),.18);
       targetCamera.set(focus.x+Math.sin(sweep)*dist,focus.y+3.3+dist*(.26+.18*Math.sin(phase*.27)),focus.z+Math.cos(sweep)*dist);
       camera.position.lerp(targetCamera,1-Math.exp(-dt*1.05));controls.target.lerp(focus,1-Math.exp(-dt*1.3));
     }
     controls.update();labels.forEach(({node,p,screen})=>{
       screen.copy(p).project(camera);node.style.transform=`translate(-50%,-50%) translate(${(screen.x*.5+.5)*host.clientWidth}px,${(-screen.y*.5+.5)*host.clientHeight}px)`;
       node.style.opacity=screen.z<1&&screen.z>-1?String(clamp(1-Math.hypot(screen.x,screen.y)*.26,.18,.85)):'0';
     });
     renderer.render(scene,camera);ui+=dt;if(ui>.12){ui=0;setTime(s.t);}
   }
   frame=requestAnimationFrame(tick);
   const resize=()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);trails.resize(host.clientWidth,host.clientHeight);};
   const observer=new ResizeObserver(resize);observer.observe(host);
   return()=>{
     alive=false;abort.abort();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
     const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
     scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>materials.add(m));});
     materials.forEach(m=>{for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);m.dispose();});
     textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();labels.forEach(x=>x.node.remove());
   };
 },[pts]);
 const dur=pts?.at(-1)?.[0]||3920.16,source=pts?sample(pts,time):null,alt=source?.p[3]??0,gap=source?.gap??false;
 return <main className="app"><div className="canvas" ref={mount}/><div className="grain"/>{error&&<div className="replay-alert" role="alert">{error}</div>}{gap&&<div className="replay-alert" role="status">DATA GAP · holding last recorded fix</div>}<div className="topline"><div className="brandmark">BA<span> / </span>06</div><div className="topcenter">AFTERBURN <span> / SAN FRANCISCO 2026</span></div><div className="topright"><span className="signal"/> ADS-B RECONSTRUCTION <span className="topsep">•</span> 08 OCT 2026</div></div>
 <div className="sidecopy"><div className="eyebrow"><span className="dash"/> THE BAY FROM ABOVE</div><h1>FLIGHT<br/><em>REIMAGINED.</em></h1><p>65 minutes. One aircraft.<br/>An entirely different perspective.</p><div className="dividerline"/><div className="minilabel">TRACKED AIRCRAFT</div><div className="code">~2B1518 <span> / BLUE ANGELS</span></div><div className="statgrid"><div><b>{Math.round(alt*3.28084).toLocaleString()}</b><small>FEET · SOURCE ALTITUDE</small></div><div><b>{flight?.points.length||'—'}</b><small>RECORDED POINTS</small></div></div></div>
 <div className="rightpanel"><div className="panel-eyebrow">01 — EXPERIENCE</div><button className={'mode '+(director?'selected':'')} aria-pressed={director} onClick={()=>setDirector(true)}><Clapperboard size={17}/><span><b>CINEMATIC</b><small>Automated camera direction</small></span><ChevronRight size={16}/></button><button className={'mode '+(!director?'selected':'')} aria-pressed={!director} onClick={()=>setDirector(false)}><Compass size={17}/><span><b>FREE EXPLORE</b><small>Drag to orbit · scroll to zoom</small></span><ChevronRight size={16}/></button><div className="panelrule"/><div className="panel-eyebrow">02 — PASS CANDIDATES</div><p className="note">Potential low passes from one aircraft’s track. Not confirmed sneak passes.</p>{candidates.map(c=><button key={c.t} className="pass" onClick={()=>{seek(c.t);setDirector(true);setPlaying(false)}}><span className="passdot"/><span><b>{c.label}</b><small>{c.note}</small></span><ChevronRight size={14}/></button>)}<div className="panelrule"/><div className="panel-eyebrow">03 — TERRAIN</div><div className="terrain" aria-live="polite"><Map size={17}/><span>{sat}</span><span className="terrain-dot"/></div><p className="note">{geo} · satellite imagery draped over elevation. Missing tiles retain the fallback chart.</p><button className="subtoggle" aria-pressed={showAll} onClick={()=>setShowAll(x=>!x)}>{showAll?'◉':'○'} &nbsp; Show entire route</button></div>
 <div className="altbadge"><Navigation2 size={14}/> <span>3D TRACK • HEIGHT ×2 • AIRCRAFT ENLARGED</span></div>
 <div className="bottom"><div className="bottomleft"><span className="live"><span/> FLIGHT REPLAY</span><div className="bigclock">{timeLabel(time,flight?.start)}</div><span className="smalltime">PDT · THURSDAY, OCT 08</span></div><div className="playarea"><div className="playrow"><button className="playbtn" aria-label={playing?'Pause replay':'Play replay'} onClick={()=>setPlaying(x=>!x)}>{playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</button><button className="ghostbtn" title="Restart" aria-label="Restart replay" onClick={()=>{seek(0);setPlaying(true)}}><RotateCcw size={17}/></button><span className="elapsed">{String(Math.floor(time/60)).padStart(2,'0')}:{String(Math.floor(time%60)).padStart(2,'0')}</span><input aria-label="Flight timeline" type="range" min="0" max={dur} step=".5" value={time} onChange={e=>{seek(Number(e.target.value));setPlaying(false)}} style={{'--progress':`${time/dur*100}%`} as React.CSSProperties}/><span className="elapsed end">{String(Math.floor(dur/60)).padStart(2,'0')}:{String(Math.floor(dur%60)).padStart(2,'0')}</span><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,5,15,35,60,120,240].map(x=><option key={x} value={x}>{x}×</option>)}</select></div><div className="marks"><span>TAKEOFF TRACK</span><span>PASS CANDIDATES <i/> <i/> <i/></span><span>END OF RECORDING</span></div></div><button className="fullscreen" title="Fullscreen" aria-label="Toggle fullscreen" onClick={()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()}}><Maximize size={18}/></button></div>
 <div className="map-credit">Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community · Elevation: Mapzen / AWS Open Data</div><div className="footnote">EXPERIMENTAL FLIGHT VISUALIZATION <span> / </span> POSITION DATA: ADS-B EXCHANGE KML <span> / </span> ONE AIRCRAFT ONLY <span> / </span> MANEUVERS UNVERIFIED</div>
 </main>}
