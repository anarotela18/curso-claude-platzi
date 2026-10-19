import * as THREE from 'three';

export function createSky(sunDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: sunDir.clone().normalize() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 sunDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 horizon = vec3(0.80, 0.38, 0.14);
        vec3 mid     = vec3(0.62, 0.26, 0.09);
        vec3 zenith  = vec3(0.34, 0.14, 0.08);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, zenith, smoothstep(0.2, 0.9, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        // polvo cálido muy amplio + halo azulado cerca del sol
        col += vec3(1.0, 0.65, 0.35) * pow(s, 6.0) * 0.35;
        col = mix(col, vec3(0.45, 0.58, 0.72), pow(s, 80.0) * 0.55);
        col += vec3(1.0, 0.7, 0.4) * pow(s, 400.0) * 0.8;
        float disc = smoothstep(0.9993, 0.9998, s);
        col = mix(col, vec3(1.0, 0.8, 0.5) * 6.0, disc);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
  mesh.renderOrder = -1;
  return mesh;
}
