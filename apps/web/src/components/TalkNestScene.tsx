import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function TalkNestScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      canvas,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });

    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      mount.appendChild(renderer.domElement);
    } catch {
      setFallback(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const group = new THREE.Group();
    const clock = new THREE.Clock();

    camera.position.set(0, 1.1, 7.4);
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.7));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const materials = [
      new THREE.MeshStandardMaterial({ color: "#143f37", roughness: 0.42 }),
      new THREE.MeshStandardMaterial({ color: "#e87054", roughness: 0.46 }),
      new THREE.MeshStandardMaterial({ color: "#e0b84e", roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: "#4b88a2", roughness: 0.44 })
    ];
    const nodeGeometry = new THREE.SphereGeometry(0.24, 32, 18);
    const positions: Array<[number, number, number]> = [
      [-2.2, 0.9, 0.1],
      [-1.25, -0.85, 0.75],
      [0.15, 0.15, -0.15],
      [1.35, 1.05, 0.6],
      [2.3, -0.45, -0.15],
      [0.95, -1.2, 0.95]
    ];
    const nodes = positions.map((position, index) => {
      const node = new THREE.Mesh(nodeGeometry, materials[index % materials.length]);
      node.position.set(...position);
      node.userData.phase = index * 0.7;
      group.add(node);
      return node;
    });

    const lineMaterial = new THREE.LineBasicMaterial({
      color: "#2a695d",
      transparent: true,
      opacity: 0.34
    });
    const connections = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [5, 4]
    ] as const;

    for (const [from, to] of connections) {
      const fromNode = nodes[from];
      const toNode = nodes[to];

      if (!fromNode || !toNode) {
        continue;
      }

      const geometry = new THREE.BufferGeometry().setFromPoints([
        fromNode.position,
        toNode.position
      ]);
      group.add(new THREE.Line(geometry, lineMaterial));
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.9, 0.01, 8, 96),
      new THREE.MeshBasicMaterial({
        color: "#d4e7df",
        transparent: true,
        opacity: 0.8
      })
    );
    ring.rotation.x = Math.PI / 2.9;
    group.add(ring);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frameId = 0;
    const render = () => {
      const elapsed = clock.getElapsedTime();

      if (!reduceMotion) {
        group.rotation.y = elapsed * 0.16;
        group.rotation.x = Math.sin(elapsed * 0.22) * 0.08;
        for (const node of nodes) {
          node.position.y += Math.sin(elapsed + node.userData.phase) * 0.0009;
        }
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
      nodeGeometry.dispose();
      ring.geometry.dispose();
      lineMaterial.dispose();
      for (const material of materials) {
        material.dispose();
      }
      canvas.remove();
    };
  }, []);

  return (
    <div className="scene-wrap" aria-hidden="true" ref={mountRef}>
      {fallback ? (
        <div className="scene-fallback">
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  );
}
