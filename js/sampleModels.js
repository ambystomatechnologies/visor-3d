import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export const SAMPLE_MODELS = [
  // --- AVES ---
  {
    id: 'vertebra_ave',
    name: 'Vértebra de Ave',
    category: 'Aves',
    subtitle: 'Vértebra de ave con foramen vertebral y tejido óseo ligero/neumatizado',
    file: 'Muestras/vertebra de ave.glb',
    size: '830 KB',
    tag: 'Aves / Ornitología',
    color: '#06b6d4'
  },
  {
    id: 'condor',
    name: 'Cóndor Andino',
    category: 'Aves',
    subtitle: 'Espécimen de cóndor andino en vuelo con envergadura alar y estructura anatómica',
    file: 'Condor.stl',
    size: '8.0 MB',
    tag: 'Aves / Fauna Andina',
    color: '#06b6d4',
    defaultPose: {
      position: { x: -7.98746, y: 2.46282, z: 1.81975 },
      target: { x: 0.11756, y: 0.70313, z: 0.22103 },
      up: { x: 0.15532, y: -0.07979, z: 0.98464 }
    }
  },
  {
    id: 'craneo_pajaro',
    name: 'Cráneo de Pájaro',
    category: 'Aves',
    subtitle: 'Cráneo aviar con órbita ocular amplia, pico córneo y caja craneal ligera',
    file: 'Muestras/Cráneo de pájaro.glb',
    size: '869 KB',
    tag: 'Aves / Ornitología',
    color: '#0284c7'
  },

  // --- MAMÍFEROS ---
  {
    id: 'craneo_perro',
    name: 'Cráneo de Perro',
    category: 'Mamíferos',
    subtitle: 'Cráneo canino con cresta sagital, arco cigomático y fosa temporal',
    file: 'Muestras/Cráneo de perro.glb',
    size: '2.47 MB',
    tag: 'Mamífero / Cánido',
    color: '#3b82f6'
  },
  {
    id: 'craneo_cabras',
    name: 'Cráneo de Cabra',
    category: 'Mamíferos',
    subtitle: 'Cráneo de rumiante caprino con pedículos y base cornual',
    file: 'Muestras/Cráneo de cabras.glb',
    size: '2.57 MB',
    tag: 'Mamífero / Rumiante',
    color: '#8b5cf6'
  },
  {
    id: 'craneo_oveja',
    name: 'Cráneo de Oveja',
    category: 'Mamíferos',
    subtitle: 'Estructura craneal ovina con dentición molar herbívora y fosa nasal',
    file: 'Muestras/Cráneo de oveja.glb',
    size: '2.38 MB',
    tag: 'Mamífero / Rumiante',
    color: '#a855f7'
  },
  {
    id: 'vertebra_caballo',
    name: 'Vértebra de Caballo',
    category: 'Mamíferos',
    subtitle: 'Vértebra equina de gran volumen con apófisis espinosa y carillas articulares',
    file: 'Muestras/Vértebra caballo.glb',
    size: '2.23 MB',
    tag: 'Mamífero / Équido',
    color: '#ec4899'
  },

  // --- PECES ---
  {
    id: 'vertebra_pez',
    name: 'Vértebra de Pez',
    category: 'Peces',
    subtitle: 'Vértebra anfitélica de pez óseo con espinas neurales y hemales',
    file: 'Muestras/Vertebra pez.glb',
    size: '651 KB',
    tag: 'Ictiología / Pez',
    color: '#10b981'
  },
  {
    id: 'vertebra_corbina',
    name: 'Vértebra de Corvina',
    category: 'Peces',
    subtitle: 'Estructura axial densa de pez teleósteo marino',
    file: 'Muestras/vertebra corbina.glb',
    size: '1.16 MB',
    tag: 'Ictiología / Corvina',
    color: '#f59e0b'
  }
];

// Generador de miniaturas 3D en Offscreen Canvas para vista previa fotográfica
const thumbnailCache = new Map();

export async function generateThumbnail(modelPath) {
  if (thumbnailCache.has(modelPath)) {
    return thumbnailCache.get(modelPath);
  }

  return new Promise((resolve) => {
    const width = 280;
    const height = 180;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);

    // Luces de estudio
    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xfff5ea, 1.9);
    dir.position.set(8, 10, 10);
    scene.add(dir);

    const rim = new THREE.DirectionalLight(0x06b6d4, 0.9);
    rim.position.set(-8, -6, -8);
    scene.add(rim);

    const onModelLoaded = (obj) => {
      // Doble cara para visualización limpia
      obj.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material.side = THREE.DoubleSide;
        }
      });

      // Centrar y escalar
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      obj.position.sub(center);
      if (maxDim > 0) {
        obj.scale.multiplyScalar(7.5 / maxDim);
      }

      // Rotación agradable isométrica
      obj.rotation.x = 0.3;
      obj.rotation.y = 0.6;

      scene.add(obj);
      renderer.render(scene, camera);

      const dataUrl = canvas.toDataURL('image/png');
      thumbnailCache.set(modelPath, dataUrl);

      // Limpiar memoria
      renderer.dispose();
      resolve(dataUrl);
    };

    const cleanPath = modelPath.split('?')[0].toLowerCase();
    if (cleanPath.endsWith('.stl')) {
      const loader = new STLLoader();
      loader.load(
        modelPath,
        (geometry) => {
          geometry.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({
            color: 0xc4c7cb,
            roughness: 0.65,
            metalness: 0.0,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, mat);
          const grp = new THREE.Group();
          grp.add(mesh);
          onModelLoaded(grp);
        },
        undefined,
        (err) => {
          console.warn(`No se pudo generar miniatura STL para ${modelPath}:`, err);
          renderer.dispose();
          resolve(null);
        }
      );
    } else {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          onModelLoaded(gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`No se pudo generar miniatura para ${modelPath}:`, err);
          renderer.dispose();
          resolve(null);
        }
      );
    }
  });
}
