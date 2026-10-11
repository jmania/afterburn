import * as THREE from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {type Fix, MAX_GAP, sample, renderPosition} from './flight';

export function makeTrails(points: Fix[], width: number, height: number) {
  const positions: number[] = [], times: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i][0], b = points[i + 1][0];
    if (b - a > MAX_GAP) continue;
    const steps = Math.max(1, Math.ceil((b - a) / 1));
    for (let j = 0; j < steps; j++) {
      const t0 = a + (b-a)*j/steps, t1 = a + (b-a)*(j+1)/steps;
      positions.push(...renderPosition(sample(points,t0,true).p),
        ...renderPosition(sample(points,t1,true).p));
      times.push(t0,t1);
    }
  }
  const group = new THREE.Group();
  const clock = {value: 0}, full = {value: 0};
  const layers = [{width: 12, opacity: .13, recent: 1}, {width: 6, opacity: .34, recent: 1},
    {width: 2.4, opacity: .95, recent: 1}, {width: 5, opacity: .10, recent: 0}, {width: 1.5, opacity: .50, recent: 0}];
  const materials = layers.map(layer => {
    const geometry = new LineSegmentsGeometry().setPositions(positions);
    const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(times), 2);
    geometry.setAttribute('instanceTimeStart',new THREE.InterleavedBufferAttribute(buffer,1,0));
    geometry.setAttribute('instanceTimeEnd',new THREE.InterleavedBufferAttribute(buffer,1,1));
    const material = new LineMaterial({color: layer.recent ? 0xffc875 : 0xe79748, linewidth: layer.width,
      transparent: true, opacity: layer.opacity, depthWrite: false, blending: THREE.AdditiveBlending});
    material.resolution.set(width,height);
    material.uniforms.replayTime = clock;
    material.uniforms.showFull = full;
    material.uniforms.recentTrail = {value: layer.recent};
    material.vertexShader = 'attribute float instanceTimeStart; attribute float instanceTimeEnd; varying float trackTime;\n' + material.vertexShader;
    material.vertexShader = material.vertexShader.replace('void main() {', 'void main() {\n trackTime = mix(instanceTimeStart, instanceTimeEnd, clamp(position.y, 0.0, 1.0));');
    material.fragmentShader = 'uniform float replayTime; uniform float showFull; uniform float recentTrail; varying float trackTime;\n' + material.fragmentShader;
    material.fragmentShader = material.fragmentShader.replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', `
      float age = replayTime - trackTime;
      if (age < 0.0 && (recentTrail > 0.5 || showFull < 0.5)) discard;
      float fade = recentTrail > 0.5 ? pow(clamp(1.0 - age / 90.0, 0.0, 1.0), 1.7) : (age < 0.0 ? 0.25 : 1.0);
      gl_FragColor = vec4(diffuseColor.rgb, alpha * fade);`);
    // Tone mapping would flatten the additive halo's warm colour.
    material.toneMapped = false;
    group.add(new LineSegments2(geometry,material));
    return material;
  });
  return {group, update(t: number, showAll: boolean) {clock.value=t; full.value=showAll?1:0;},
    resize(w: number,h: number) {materials.forEach(m=>m.resolution.set(w,h));}};
}
