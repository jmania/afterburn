import * as THREE from 'three';
import {world, tileAt, tileLon, tileLat, elevation} from './flight';

export const IMAGERY_ZOOM = 13;
const ELEVATION_ZOOM = 12;
const BOUNDS = {west: -122.56, east: -122.10, north: 38.04, south: 37.69};
type Raster = {data: Uint8ClampedArray; width: number; height: number};
export type MapStatus = {imagery: number; terrain: number; total: number; done: boolean};
async function image(url: string, signal: AbortSignal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Tile HTTP ${response.status}`);
  return createImageBitmap(await response.blob());
}
function readRaster(bitmap: ImageBitmap): Raster {
  const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d', {willReadFrequently: true})!; ctx.drawImage(bitmap,0,0);
  const raster=ctx.getImageData(0,0,canvas.width,canvas.height); bitmap.close(); return raster;
}
function heightAt(raster: Raster, u: number, v: number) {
  const x=Math.min(raster.width-1,Math.max(0,u*raster.width)), y=Math.min(raster.height-1,Math.max(0,v*raster.height));
  const x0=Math.floor(x), y0=Math.floor(y), x1=Math.min(x0+1,raster.width-1), y1=Math.min(y0+1,raster.height-1);
  const value=(a: number,b: number)=>{const k=(b*raster.width+a)*4;return elevation(raster.data[k],raster.data[k+1],raster.data[k+2]);};
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(value(x0,y0),value(x1,y0),x-x0),
    THREE.MathUtils.lerp(value(x0,y1),value(x1,y1),x-x0),y-y0);
}
function tileGeometry(x: number,y: number,raster: Raster|null) {
  const size=32, vertices: number[]=[], uvs: number[]=[], indices: number[]=[];
  for(let j=0;j<=size;j++) for(let i=0;i<=size;i++) {
    const u=i/size,v=j/size;
    const metres=raster?Math.max(0,heightAt(raster,(x%2+u)/2,(y%2+v)/2)):0;
    const p=world(tileLon(x+u,IMAGERY_ZOOM),tileLat(y+v,IMAGERY_ZOOM),metres);
    vertices.push(p[0],p[1]+.006,p[2]);uvs.push(u,1-v);
    if(i<size&&j<size){const a=j*(size+1)+i,b=a+1,c=a+size+1,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
// Independent tiles avoid canvas texture limits and retain successful imagery after partial failures.
export async function loadTerrain(scene: THREE.Scene, renderer: THREE.WebGLRenderer, signal: AbortSignal, report: (s:MapStatus)=>void) {
  const a=tileAt(BOUNDS.west,BOUNDS.north,IMAGERY_ZOOM),b=tileAt(BOUNDS.east,BOUNDS.south,IMAGERY_ZOOM);
  const jobs: {x:number;y:number}[]=[];
  for(let y=a.y;y<=b.y;y++)for(let x=a.x;x<=b.x;x++) jobs.push({x,y});
  // Centre-first progressive loading puts the waterfront on screen first.
  const centre=tileAt(-122.42,37.83,IMAGERY_ZOOM);
  jobs.sort((a,b)=>Math.hypot(a.x-centre.x,a.y-centre.y)-Math.hypot(b.x-centre.x,b.y-centre.y));
  const status:MapStatus={imagery:0,terrain:0,total:jobs.length,done:false};report({...status});
  const rasters=new Map<string,Promise<Raster|null>>();
  const getRaster=(x:number,y:number)=>{
    const key=`${x}/${y}`;
    if(!rasters.has(key))rasters.set(key,image(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ELEVATION_ZOOM}/${x}/${y}.png`,AbortSignal.any([signal,AbortSignal.timeout(12000)])).then(readRaster).catch(()=>null));
    return rasters.get(key)!;
  };
  let cursor=0;
  async function worker(){
    while(cursor<jobs.length&&!signal.aborted){
      const {x,y}=jobs[cursor++];
      const timeout=new AbortController();
      const abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,12000);
      const [bitmap,raster]=await Promise.all([
        image(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${IMAGERY_ZOOM}/${y}/${x}`,timeout.signal).catch(()=>null),
        getRaster(Math.floor(x/2),Math.floor(y/2))]);
      clearTimeout(timer);signal.removeEventListener('abort',abort);
      if(signal.aborted){bitmap?.close();return;}
      if(!bitmap&&!raster)continue;
      let texture:THREE.CanvasTexture|undefined;
      if(bitmap){
        // CanvasTexture preserves the conventional top-left image origin for WebGL UVs.
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        canvas.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();
        texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
        texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
        status.imagery++;
      }
      if(raster)status.terrain++;
      const material=new THREE.MeshStandardMaterial({map:texture,color:texture?0xffffff:0x284c46,roughness:.96,metalness:0});
      const mesh=new THREE.Mesh(tileGeometry(x,y,raster),material);mesh.name=`geography-${x}-${y}`;scene.add(mesh);
      report({...status});
    }
  }
  await Promise.all(Array.from({length:6},worker));
  if(!signal.aborted){status.done=true;report({...status});}
}

export function makeBridges(scene:THREE.Scene){
  // Georeferenced bridge spans, simplified architectural details (dimensions in km).
  const bridges=[{a:[-122.4786,37.8107],b:[-122.4770,37.8324],color:0xc25435,height:.227,deck:.067},
    {a:[-122.3883,37.7894],b:[-122.3667,37.8064],color:0xaeb8bf,height:.16,deck:.058}];
  for(const bridge of bridges){
    const a=new THREE.Vector3(...world(bridge.a[0],bridge.a[1])),b=new THREE.Vector3(...world(bridge.b[0],bridge.b[1]));
    const length=a.distanceTo(b),g=new THREE.Group();g.position.copy(a.clone().lerp(b,.5));
    g.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
    const steel=new THREE.MeshStandardMaterial({color:bridge.color,roughness:.6});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.035,.016,length),steel);deck.position.y=bridge.deck*2;g.add(deck);
    for(const z of [-length*.23,length*.23]){
      for(const x of [-.026,.026]){const tower=new THREE.Mesh(new THREE.BoxGeometry(.016,bridge.height*2,.025),steel);tower.position.set(x,bridge.height,z);g.add(tower);}
      for(const h of [.1,.17]){const cross=new THREE.Mesh(new THREE.BoxGeometry(.068,.012,.018),steel);cross.position.set(0,h*2,z);g.add(cross);}
    }
    for(const x of [-.025,.025]){
      const cable:THREE.Vector3[]=[];
      for(let j=0;j<=64;j++){
        const z=-length/2+length*j/64;
        const nearest=Math.min(Math.abs(z-length*.23),Math.abs(z+length*.23));
        const h=Math.max(bridge.deck+.012,bridge.height-(bridge.height-bridge.deck)*Math.min(1,nearest/(length*.25))**.6);
        cable.push(new THREE.Vector3(x,h*2,z));
        if(j%3===0)g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,bridge.deck*2,z),new THREE.Vector3(x,h*2,z)]),new THREE.LineBasicMaterial({color:bridge.color})));
      }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cable),new THREE.LineBasicMaterial({color:bridge.color})));
    }
    scene.add(g);
  }
}
