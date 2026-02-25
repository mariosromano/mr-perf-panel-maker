import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PanelState, LightingPreset } from '../engine/types';
import { LIGHTING_PRESETS } from '../engine/panelEngine';

interface Viewport3DProps {
  panelState: PanelState;
  lightingPreset: LightingPreset;
  floorEnabled: boolean;
  scaleFigureEnabled: boolean;
  rendererRef: React.MutableRefObject<unknown>;
  sceneRef: React.MutableRefObject<unknown>;
  cameraRef: React.MutableRefObject<unknown>;
}

export default function Viewport3D({
  panelState,
  lightingPreset,
  floorEnabled,
  scaleFigureEnabled,
  rendererRef,
  sceneRef,
  cameraRef,
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const wallGroupRef = useRef<THREE.Group | null>(null);
  const lightsInSceneRef = useRef<THREE.Light[]>([]);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const scaleFigureRef = useRef<THREE.Mesh | null>(null);
  const scaleFigureTextureRef = useRef<THREE.Texture | null>(null);
  const animFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const floorYRef = useRef<number>(0);
  const cameraSetRef = useRef(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 0, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    // Grid helper (positioned at floor level in wall rebuild)
    const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x333333);
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;
    gridHelper.visible = true;

    // Scale figure drag
    setupScaleFigureDrag(renderer.domElement, camera, controls);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      initializedRef.current = false;
    };
  }, []);

  // Scale figure drag setup
  const setupScaleFigureDrag = useCallback((
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
  ) => {
    let isDragging = false;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    canvas.addEventListener('pointerdown', (e) => {
      if (!scaleFigureRef.current) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(scaleFigureRef.current, true);
      if (intersects.length > 0) {
        isDragging = true;
        controls.enabled = false;
        canvas.style.cursor = 'grabbing';
        const figureBottom = scaleFigureRef.current.position.y - (scaleFigureRef.current.geometry as THREE.PlaneGeometry).parameters.height / 2;
        dragPlane.set(new THREE.Vector3(0, 1, 0), -figureBottom);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!scaleFigureRef.current) { canvas.style.cursor = ''; return; }
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        raycaster.setFromCamera(mouse, camera);
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
          scaleFigureRef.current.position.x = intersection.x;
          scaleFigureRef.current.position.z = intersection.z;
        }
      } else {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(scaleFigureRef.current, true);
        canvas.style.cursor = intersects.length > 0 ? 'grab' : '';
      }
    });

    canvas.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        controls.enabled = true;
        canvas.style.cursor = '';
      }
    });
  }, []);

  // Build wall meshes when panelState changes
  useEffect(() => {
    const scene = sceneRef.current as THREE.Scene | null;
    const camera = cameraRef.current as THREE.PerspectiveCamera | null;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    // Clear existing wall
    if (wallGroupRef.current) {
      wallGroupRef.current.traverse(ch => {
        if ((ch as THREE.Mesh).isMesh) {
          const mesh = ch as THREE.Mesh;
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material;
          mat.dispose();
        }
      });
      scene.remove(wallGroupRef.current);
    }

    const wallGroup = new THREE.Group();
    wallGroupRef.current = wallGroup;

    const wW = panelState.wallW, wH = panelState.wallH;
    const scale = 80 / Math.max(wW, wH);
    const texSize = panelState.panels.length > 20 ? 512 : 1024;

    for (const panel of panelState.panels) {
      const pw = panel.w, ph = panel.h;

      // Create alpha map from holes
      const tc = document.createElement('canvas');
      tc.width = texSize;
      tc.height = texSize;
      const tcx = tc.getContext('2d')!;
      tcx.fillStyle = '#ffffff';
      tcx.fillRect(0, 0, texSize, texSize);
      tcx.fillStyle = '#000000';
      for (const hole of panel.holes) {
        const px = (hole.x / pw) * texSize;
        const py = (hole.y / ph) * texSize;
        const pr = (hole.d / 2 / Math.max(pw, ph)) * texSize;
        tcx.beginPath();
        tcx.arc(px, py, pr, 0, Math.PI * 2);
        tcx.fill();
      }

      const atex = new THREE.CanvasTexture(tc);
      atex.colorSpace = THREE.SRGBColorSpace;
      const sW = pw * scale, sH = ph * scale;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(panelState.panelColor),
        alphaMap: atex,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0.6,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sW, sH), mat);
      const cx = (panel.x + pw / 2) * scale - (wW * scale) / 2;
      const cy = -(panel.y + ph / 2) * scale + (wH * scale) / 2;
      mesh.position.set(cx, cy, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      // Backlight plane
      if (panelState.backlight) {
        const blMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(panelState.backlightColor).multiplyScalar(panelState.backlightIntensity),
          side: THREE.FrontSide,
        });
        const blMesh = new THREE.Mesh(new THREE.PlaneGeometry(sW * 0.98, sH * 0.98), blMat);
        blMesh.position.set(cx, cy, -0.3);
        wallGroup.add(blMesh);
      }
    }

    scene.add(wallGroup);

    // Compute actual panel bottom Y (panels are centered in wall, so bottom != wall bottom)
    let panelBottomY = -(wH * scale) / 2;  // fallback to wall bottom
    if (panelState.panels.length > 0) {
      panelBottomY = Math.min(...panelState.panels.map(p => {
        return -(p.y + p.h) * scale + (wH * scale) / 2;
      }));
    }
    floorYRef.current = panelBottomY;

    // Move grid to panel base level
    if (gridHelperRef.current) {
      gridHelperRef.current.position.y = panelBottomY;
    }

    // Position camera only on first build (don't reset user's orbit)
    if (!cameraSetRef.current) {
      cameraSetRef.current = true;
      const dist = Math.max(wW, wH) * scale / (2 * Math.tan(Math.PI * camera.fov / 360));
      camera.position.set(0, 0, dist * 1.15);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [panelState]);

  // Lighting
  useEffect(() => {
    const scene = sceneRef.current as THREE.Scene | null;
    if (!scene) return;

    lightsInSceneRef.current.forEach(l => scene.remove(l));
    lightsInSceneRef.current = [];

    const config = LIGHTING_PRESETS[lightingPreset];
    scene.background = new THREE.Color(config.background);

    const hemi = config.hemisphere;
    const hemiLight = new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity);
    scene.add(hemiLight);
    lightsInSceneRef.current.push(hemiLight);

    config.lights.forEach(lc => {
      const light = new THREE.DirectionalLight(lc.color, lc.intensity);
      light.position.set(...lc.position);
      if (lc.castShadow) {
        light.castShadow = true;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.bias = -0.0005;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 200;
      }
      scene.add(light);
      lightsInSceneRef.current.push(light);
    });
  }, [lightingPreset]);

  // Floor
  useEffect(() => {
    const scene = sceneRef.current as THREE.Scene | null;
    if (!scene) return;

    let cancelled = false;

    if (floorMeshRef.current) {
      scene.remove(floorMeshRef.current);
      floorMeshRef.current.geometry.dispose();
      (floorMeshRef.current.material as THREE.MeshStandardMaterial).dispose();
      floorMeshRef.current = null;
    }

    if (floorEnabled) {
      const loader = new THREE.TextureLoader();
      loader.load('/floors/wood-flooring.jpg', (texture) => {
        if (cancelled) return;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(6, 6);
        texture.colorSpace = THREE.SRGBColorSpace;

        const floorGeo = new THREE.PlaneGeometry(200, 200);
        const floorMat = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0.0,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = floorYRef.current - 0.01;
        floor.receiveShadow = true;
        scene.add(floor);
        floorMeshRef.current = floor;
      });
    }

    if (gridHelperRef.current) gridHelperRef.current.visible = !floorEnabled;

    return () => { cancelled = true; };
  }, [floorEnabled, panelState.wallH, panelState.wallW]);

  // Scale figure
  useEffect(() => {
    const scene = sceneRef.current as THREE.Scene | null;
    if (!scene) return;

    // Always remove existing figure first
    if (scaleFigureRef.current) {
      scene.remove(scaleFigureRef.current);
      scaleFigureRef.current.geometry.dispose();
      (scaleFigureRef.current.material as THREE.Material).dispose();
      scaleFigureRef.current = null;
    }

    // Cancellation flag for async texture load
    let cancelled = false;

    if (scaleFigureEnabled) {
      const wW = panelState.wallW, wH = panelState.wallH;
      const wallScale = 80 / Math.max(wW, wH);
      const figH = 66 * wallScale;  // 5'6" in same units as wall
      const figW = figH * (390 / 1420);  // preserve image aspect ratio

      // Compute floor Y: bottom of lowest panel
      let floorY = -(wH * wallScale) / 2;
      if (panelState.panels.length > 0) {
        floorY = Math.min(...panelState.panels.map(p =>
          -(p.y + p.h) * wallScale + (wH * wallScale) / 2
        ));
      }

      const addFigure = (texture: THREE.Texture) => {
        if (cancelled) return;
        const planeGeo = new THREE.PlaneGeometry(figW, figH);
        const planeMat = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          alphaTest: 0.1,
        });
        const figure = new THREE.Mesh(planeGeo, planeMat);
        figure.position.set(
          (wW * wallScale) / 2 + figW,
          floorY + figH / 2,
          0
        );
        scene.add(figure);
        scaleFigureRef.current = figure;
      };

      // Use cached texture if available, otherwise load and cache
      if (scaleFigureTextureRef.current) {
        addFigure(scaleFigureTextureRef.current);
      } else {
        const loader = new THREE.TextureLoader();
        loader.load('/figures/scale-person.png', (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          scaleFigureTextureRef.current = texture;
          addFigure(texture);
        });
      }
    }

    return () => {
      cancelled = true;
      // Clean up figure on unmount or before next effect run
      if (scaleFigureRef.current && scene) {
        scene.remove(scaleFigureRef.current);
        scaleFigureRef.current.geometry.dispose();
        (scaleFigureRef.current.material as THREE.Material).dispose();
        scaleFigureRef.current = null;
      }
    };
  }, [scaleFigureEnabled, panelState]);

  return (
    <div ref={containerRef} className="absolute inset-0" />
  );
}
