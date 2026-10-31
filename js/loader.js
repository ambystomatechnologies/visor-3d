import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

export class ModelLoader {
  constructor() {
    this.blobUrls = [];
  }

  // Limpia URLs blob anteriores para liberar memoria RAM
  cleanupBlobUrls() {
    this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    this.blobUrls = [];
  }

  createBlobUrl(file) {
    const url = URL.createObjectURL(file);
    this.blobUrls.push(url);
    return url;
  }

  /**
   * Carga uno o varios archivos (drag & drop o input file).
   * Identifica el archivo principal 3D (.glb, .gltf, .obj, .stl, .ply) y
   * vincula automáticamente los archivos accesorios (.mtl, imágenes de texturas).
   */
  async loadFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) throw new Error("No se seleccionó ningún archivo.");

    this.cleanupBlobUrls();

    // Mapeo de archivos por nombre en minúsculas para resolución de texturas
    const fileMap = new Map();
    files.forEach((f) => {
      fileMap.set(f.name.toLowerCase(), f);
    });

    // Detectar archivo principal 3D
    const glbFile = files.find((f) => f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().endsWith('.gltf'));
    const objFile = files.find((f) => f.name.toLowerCase().endsWith('.obj'));
    const stlFile = files.find((f) => f.name.toLowerCase().endsWith('.stl'));
    const plyFile = files.find((f) => f.name.toLowerCase().endsWith('.ply'));

    let loadedObject = null;
    let modelName = "Modelo 3D";

    if (glbFile) {
      modelName = glbFile.name;
      loadedObject = await this.loadGLTF(glbFile, fileMap);
    } else if (objFile) {
      modelName = objFile.name;
      const mtlFile = files.find((f) => f.name.toLowerCase().endsWith('.mtl'));
      loadedObject = await this.loadOBJ(objFile, mtlFile, fileMap);
    } else if (stlFile) {
      modelName = stlFile.name;
      loadedObject = await this.loadSTL(stlFile);
    } else if (plyFile) {
      modelName = plyFile.name;
      loadedObject = await this.loadPLY(plyFile);
    } else {
      throw new Error("No se encontró ningún formato 3D compatible (.glb, .gltf, .obj, .stl, .ply).");
    }

    // Normalizar tamaño, centrar y configurar mallas para sombreado óptimo
    this.normalizeModel(loadedObject);

    return {
      object: loadedObject,
      name: modelName
    };
  }

  /**
   * Carga un modelo directamente desde una URL relativa (por ejemplo ./vertebra_muestra.glb o ./Condor.stl)
   */
  async loadUrl(url, name = "Modelo 3D") {
    const cleanUrl = url.split('?')[0].toLowerCase();

    if (cleanUrl.endsWith('.stl')) {
      const loader = new STLLoader();
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (geometry) => {
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
              color: 0xf3eee3,
              roughness: 0.6,
              metalness: 0.05,
              side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            const group = new THREE.Group();
            group.add(mesh);
            this.normalizeModel(group);
            resolve({
              object: group,
              name: name
            });
          },
          undefined,
          (err) => reject(new Error("Error al leer archivo STL médico: " + err.message))
        );
      });
    }

    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const loadedObject = gltf.scene;
          this.normalizeModel(loadedObject);
          resolve({
            object: loadedObject,
            name: name
          });
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  // Carga de GLTF/GLB
  loadGLTF(file, fileMap) {
    return new Promise((resolve, reject) => {
      const manager = new THREE.LoadingManager();

      manager.setURLModifier((url) => {
        const fileName = this.extractFileName(url);
        if (fileMap.has(fileName.toLowerCase())) {
          return this.createBlobUrl(fileMap.get(fileName.toLowerCase()));
        }
        return url;
      });

      const loader = new GLTFLoader(manager);
      const url = this.createBlobUrl(file);

      loader.load(
        url,
        (gltf) => {
          resolve(gltf.scene);
        },
        undefined,
        (err) => reject(new Error("Error al procesar archivo GLTF/GLB: " + err.message))
      );
    });
  }

  // Carga de OBJ con o sin MTL y con texturas (JPG, PNG, WebP)
  loadOBJ(objFile, mtlFile, fileMap) {
    return new Promise((resolve, reject) => {
      const manager = new THREE.LoadingManager();

      // Interceptor de URLs para asociar texturas en memoria
      manager.setURLModifier((url) => {
        const fileName = this.extractFileName(url);
        if (fileMap.has(fileName.toLowerCase())) {
          return this.createBlobUrl(fileMap.get(fileName.toLowerCase()));
        }
        return url;
      });

      const objLoader = new OBJLoader(manager);

      if (mtlFile) {
        const mtlLoader = new MTLLoader(manager);
        const mtlUrl = this.createBlobUrl(mtlFile);

        mtlLoader.load(
          mtlUrl,
          (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            
            const objUrl = this.createBlobUrl(objFile);
            objLoader.load(
              objUrl,
              (obj) => resolve(obj),
              undefined,
              (err) => reject(new Error("Error cargando OBJ con MTL: " + err.message))
            );
          },
          undefined,
          (err) => {
            console.warn("No se pudo cargar el archivo MTL, cargando OBJ sin materiales:", err);
            this.loadPlainOBJ(objFile, resolve, reject);
          }
        );
      } else {
        // Cargar OBJ básico sin MTL
        this.loadPlainOBJ(objFile, resolve, reject);
      }
    });
  }

  loadPlainOBJ(objFile, resolve, reject) {
    const objLoader = new OBJLoader();
    const objUrl = this.createBlobUrl(objFile);
    objLoader.load(
      objUrl,
      (obj) => {
        // Asignar material óseo neutro por defecto
        const defaultBoneMat = new THREE.MeshStandardMaterial({
          color: 0xf1ebe1,
          roughness: 0.65,
          metalness: 0.05,
          side: THREE.DoubleSide
        });
        obj.traverse((c) => {
          if (c.isMesh) c.material = defaultBoneMat;
        });
        resolve(obj);
      },
      undefined,
      (err) => reject(new Error("Error al leer OBJ: " + err.message))
    );
  }

  // Carga de STL (común en tomografías de huesos y medicina)
  loadSTL(stlFile) {
    return new Promise((resolve, reject) => {
      const loader = new STLLoader();
      const url = this.createBlobUrl(stlFile);

      loader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0xf3eee3,
            roughness: 0.6,
            metalness: 0.05,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
          const group = new THREE.Group();
          group.add(mesh);
          resolve(group);
        },
        undefined,
        (err) => reject(new Error("Error al leer archivo STL médico: " + err.message))
      );
    });
  }

  // Carga de PLY
  loadPLY(plyFile) {
    return new Promise((resolve, reject) => {
      const loader = new PLYLoader();
      const url = this.createBlobUrl(plyFile);

      loader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0xf3eee3,
            roughness: 0.6,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
          const group = new THREE.Group();
          group.add(mesh);
          resolve(group);
        },
        undefined,
        (err) => reject(new Error("Error al leer archivo PLY: " + err.message))
      );
    });
  }

  // Extrae el nombre simple de archivo eliminando rutas tipo ../ o C:\path\
  extractFileName(path) {
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1];
  }

  // Centra y escala el modelo para que cualquier hueso importado se visualice inmediatamente
  normalizeModel(object) {
    // 1. Asegurar dobles caras en materiales para que los cortes no muestren caras invisibles
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.side = THREE.DoubleSide;
            });
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }
      }
    });

    // 2. Calcular caja delimitadora
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // 3. Centrar en el origen (0, 0, 0)
    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;

    // 4. Escala estándar normalizada a una dimensión máxima de 12 unidades
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 12 / maxDim;
      object.scale.multiplyScalar(scale);
    }

    // Recalcular para que el centro exacto esté en 0,0,0
    const finalBox = new THREE.Box3().setFromObject(object);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    object.position.sub(finalCenter);
  }
}
