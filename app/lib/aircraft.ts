import * as THREE from 'three';
import {clamp} from './flight';

/** Stylized F/A-18 silhouette: nose is local -Z, starboard is +X, up is +Y. */
export function makeAircraft(){
  const jet=new THREE.Group();jet.name='Blue Angels F/A-18';jet.rotation.order='YXZ';
  const blue=new THREE.MeshStandardMaterial({color:0x063a86,metalness:.48,roughness:.27});
  const gold=new THREE.MeshStandardMaterial({color:0xffcb32,metalness:.35,roughness:.3});
  const dark=new THREE.MeshStandardMaterial({color:0x111b25,metalness:.65,roughness:.3});
  function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0){
    const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);jet.add(object);return object;
  }
  // Tapered fuselage with an elongated pointed nose and broad twin-engine aft section.
  const profile=[[-.43,.075],[-.28,.115],[0,.1],[.25,.065],[.45,.005]].map(([y,r])=>new THREE.Vector2(r,y));
  const fuselage=mesh(new THREE.LatheGeometry(profile,24),blue);fuselage.rotation.x=-Math.PI/2;fuselage.scale.x=.8;
  function surface(vertices:number[][],material:THREE.Material,thickness=.012,y=0){
    const shape=new THREE.Shape();vertices.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});geo.rotateX(-Math.PI/2);
    return mesh(geo,material,0,y,0);
  }
  for(const sign of [-1,1]){
    surface([[sign*.06,-.2],[sign*.39,.10],[sign*.39,.19],[sign*.09,.16]],blue);
    surface([[sign*.35,.09],[sign*.39,.10],[sign*.39,.19],[sign*.35,.185]],gold,.013);
    surface([[sign*.075,.25],[sign*.22,.34],[sign*.22,.41],[sign*.07,.38]],blue);
    surface([[sign*.035,-.31],[sign*.13,-.04],[sign*.065,.04]],blue,.014,.018);
    // Twin canted vertical stabilizers.
    const finShape=new THREE.Shape();finShape.moveTo(.16,0);finShape.lineTo(.30,.23);finShape.lineTo(.40,.20);finShape.lineTo(.40,0);finShape.closePath();
    const finGeo=new THREE.ExtrudeGeometry(finShape,{depth:.012,bevelEnabled:false});
    finGeo.rotateY(-Math.PI/2);
    const fin=mesh(finGeo,blue,sign*.071,.065,0);fin.rotation.z=-sign*.24;
    const cap=mesh(new THREE.BoxGeometry(.018,.028,.11),gold,sign*.12,.27,.34);cap.rotation.z=-sign*.24;
    const nacelle=mesh(new THREE.CylinderGeometry(.048,.055,.27,20),blue,sign*.057,-.035,.28);nacelle.rotation.x=Math.PI/2;
    const exhaust=mesh(new THREE.CylinderGeometry(.036,.041,.042,20),dark,sign*.057,-.035,.43);exhaust.rotation.x=Math.PI/2;
    const intake=mesh(new THREE.BoxGeometry(.052,.065,.075),dark,sign*.089,-.035,-.055);
    intake.rotation.y=sign*.12;
  }
  const canopy=mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshPhysicalMaterial({color:0x89b3c9,metalness:.6,roughness:.08,clearcoat:1}),0,.095,-.17);
  canopy.scale.set(.048,.058,.13);
  surface([[-.014,-.44],[.014,-.44],[.018,-.03],[-.018,-.03]],gold,.006,.07);
  // Reusable decal texture keeps the model recognizable without a remote model asset.
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;const ctx=cv.getContext('2d')!;
  ctx.fillStyle='#ffd23e';ctx.font='bold 68px Arial';ctx.textAlign='center';ctx.fillText('U.S. NAVY',256,88);
  const decal=new THREE.CanvasTexture(cv);decal.colorSpace=THREE.SRGBColorSpace;
  const marking=mesh(new THREE.PlaneGeometry(.25,.063),new THREE.MeshBasicMaterial({map:decal,transparent:true,depthWrite:false}),.21,.025,.095);
  marking.rotation.x=-Math.PI/2;
  const effects=new THREE.Group();jet.add(effects);
  const flameMaterial=new THREE.MeshBasicMaterial({color:0xffb364,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const flames=[-1,1].map(sign=>{
    const plume=new THREE.Mesh(new THREE.ConeGeometry(.039,.3,20,1,true),flameMaterial);
    plume.rotation.x=Math.PI/2;plume.position.set(sign*.057,-.035,.60);effects.add(plume);return plume;
  });
  const vaporMaterial=new THREE.MeshBasicMaterial({color:0xe4f6ff,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const vapors=[-1,1].map(sign=>{
    const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sign*.35,.01,.16),new THREE.Vector3(sign*.38,.01,1.1),new THREE.Vector3(sign*.32,.01,1.1)]);
    geo.setIndex([0,1,2]);const vapor=new THREE.Mesh(geo,vaporMaterial);effects.add(vapor);return vapor;
  });
  jet.scale.setScalar(.85); // Oversized for legibility at regional map scale.
  return {jet,update(speed:number,bank:number,gap:boolean){
    const strength=clamp((speed-100)/220,0,1);effects.visible=!gap&&strength>.02;
    flameMaterial.opacity=.15+.55*strength;
    flames.forEach(f=>{f.scale.y=.4+strength*1.8;f.position.z=.45+.15*f.scale.y;});
    vaporMaterial.opacity=strength*(.025+Math.abs(bank)*.18);
    vapors.forEach(v=>v.scale.z=.5+strength*.9);
  }};
}
