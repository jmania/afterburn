import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderFixes,sample,motion,world,MAX_GAP,tileAt,tileLon,tileLat,elevation} from '../app/lib/flight.ts';
const recording=JSON.parse(readFileSync(new URL('../public/flight.json',import.meta.url),'utf8'));
const points=renderFixes(recording.points);
test('rendering preserves every distinct recorded fix and leaves the raw recording unchanged',()=>{
  const before=JSON.stringify(recording);
  for(const fix of points)assert.deepEqual(sample(points,fix[0],true).p,fix);
  assert.equal(JSON.stringify(recording),before);
  assert.equal(points.length,new Set(recording.points.map(p=>p[0])).size);
  assert.notEqual(points[0],recording.points[0]);
});
test('smooth playback never overshoots coordinate or altitude bounds between source fixes',()=>{
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];if(b[0]-a[0]>MAX_GAP)continue;
    for(let f=.05;f<1;f+=.05){const p=sample(points,a[0]+(b[0]-a[0])*f,true).p;
      for(let j=1;j<4;j++)assert.ok(p[j]>=Math.min(a[j],b[j])-1e-9&&p[j]<=Math.max(a[j],b[j])+1e-9);
    }
  }
});
test('long gaps hold the previous source fix, flag uncertainty and suppress derived speed',()=>{
  const gap=points.findIndex((p,i)=>i<points.length-1&&points[i+1][0]-p[0]>MAX_GAP);
  const a=points[gap],b=points[gap+1],t=(a[0]+b[0])/2,s=sample(points,t,true);
  assert.equal(s.gap,true);assert.deepEqual(s.p.slice(1),a.slice(1));assert.equal(motion(points,t).speed,0);
  assert.deepEqual(sample(points,b[0],true).p,b);
});
test('heading aligns local -Z nose for all four cardinal directions',()=>{
  for(const [lon,lat,expected] of [[0,.01,0],[.01,0,-Math.PI/2],[0,-.01,Math.PI],[-.01,0,Math.PI/2]]){
    const p=[[0,-122,38,100],[10,-122+lon,38+lat,100]];
    const {heading,speed}=motion(p,5);
    assert.ok(Math.abs(Math.cos(heading)-Math.cos(expected))<1e-8);
    assert.ok(Math.abs(Math.sin(heading)-Math.sin(expected))<1e-8);assert.ok(speed>0);
  }
});
test('source telemetry remains linear while rendered motion is smooth at fixes',()=>{
  const p=[[0,0,0,100],[10,1,1,200],[20,3,2,300],[30,4,3,400]];
  assert.equal(sample(p,5).p[1],.5);
  const left=motion(p,9.999).velocity,right=motion(p,10.001).velocity;
  assert.ok(Math.abs(left[0]-right[0])<.01);
  assert.notEqual(sample(p,5,true).p[1],sample(p,5).p[1]);
});
test('tile boundaries, shared projection and elevation decode use documented geographic units',()=>{
  const z=13,t=tileAt(-122.42,37.83,z);
  assert.ok(tileLon(t.x,z)<=-122.42&&tileLon(t.x+1,z)>-122.42);
  assert.ok(tileLat(t.y,z)>=37.83&&tileLat(t.y+1,z)<37.83);
  assert.equal(elevation(128,0,0),0);assert.equal(elevation(128,100,128),100.5);
  assert.equal(world(-122.337,37.845,1000)[1],2);
});
