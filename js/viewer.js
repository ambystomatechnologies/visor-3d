import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.currentModel = null;
    this.originalMaterials = new Map();
    this.currentVisualMode = 'clay'; // Estilo de vista "Yeso" activado por defecto
    this.defaultCameraPose = null;

    // 1. Escena
    this.scene = new THREE.Scene();
    this.scene.background = null; // Canvas transparente sobre gradiente CSS

    // Pivote independiente para rotación del modelo como tal (sin mover la cámara ni la puesta en escena)
    this.modelPivot = new THREE.Group();
    this.modelPivot.name = "Model_Pivot";
    this.scene.add(this.modelPivot);
    this.modelRotation = { x: 0, y: 0, z: 0 };

    // 2. Obtener dimensiones del espacio 3D disponible a la derecha
    const container = this.canvas.parentElement;
    const initialWidth = (container && container.clientWidth) ? container.clientWidth : (window.innerWidth - 360);
    const initialHeight = (container && container.clientHeight) ? container.clientHeight : (window.innerHeight - 62);

    this.camera = new THREE.PerspectiveCamera(
      45,
      initialWidth / initialHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 22);

    // 3. Renderer con stencil buffer de hardware y local clipping activado
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      stencil: true, // CRÍTICO para hardware stencil buffer (Solid Caps)
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Permite capturas de pantalla de alta resolución
    });
    this.renderer.setSize(initialWidth, initialHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.localClippingEnabled = true; // CRÍTICO: Permite planos de corte locales
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. OrbitControls con control directo instantáneo (sin inercia residual al soltar)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false; // Sin movimiento suave al soltar: se queda quieta exactamente donde se deja
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 1.0;
    this.controls.screenSpacePanning = true; // Desplazar en el plano de la pantalla
    this.controls.minDistance = 2;
    this.controls.maxDistance = 150;

    // Configuración de botones del ratón:
    // Click Izquierdo: Rotar
    // Click del Scroll (rueda del ratón): Desplazar / Panear la vista
    // Click Derecho: Desplazar / Panear la vista
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN
    };

    // Mesa Giratoria (desactivada por defecto al abrir para preservar la postura exacta del modelo)
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.5;

    // 5. Luces de estudio anatómico
    this.setupLighting();
    this.updateLightsForMode('clay');

    // 6. Plataforma / Sombra de contacto
    this.setupContactShadow();

    // 7. Eventos de redimensionamiento
    window.addEventListener('resize', () => this.onResize());
    if (window.ResizeObserver && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    // Factor de intensidad lumínica configurable por el usuario
    this.lightIntensityFactor = 1.0;

    // FPS Meter
    this.fpsLastTime = performance.now();
    this.fpsFrames = 0;
    this.fps = 60;
  }

  setupLighting() {
    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = "Lighting_Rig";

    // Luz ambiental suave
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.lightsGroup.add(this.ambientLight);

    // Luz Principal (Key Light)
    this.keyLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
    this.keyLight.position.set(12, 16, 14);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.bias = -0.0001;
    this.lightsGroup.add(this.keyLight);

    // Luz de Relleno (Fill Light médica tono cian suave)
    this.fillLight = new THREE.DirectionalLight(0x94d2bd, 0.9);
    this.fillLight.position.set(-14, 8, -10);
    this.lightsGroup.add(this.fillLight);

    // Luz de Contorno (Rim Light)
    this.rimLight = new THREE.DirectionalLight(0x06b6d4, 1.1);
    this.rimLight.position.set(0, -12, -12);
    this.lightsGroup.add(this.rimLight);

    this.scene.add(this.lightsGroup);
  }

  setupContactShadow() {
    // Sombra sutil de contacto debajo del modelo
    const shadowGeo = new THREE.PlaneGeometry(24, 24);
    const shadowMat = new THREE.ShadowMaterial({
      opacity: 0.25
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = -8;
    this.contactShadow.receiveShadow = true;
    this.scene.add(this.contactShadow);
  }

  /**
   * Adapta la iluminación y sombra de piso según el modo visual seleccionado
   * (Modo Clay / Escultura utiliza iluminación de estudio neutra de alta definición)
   */
  updateLightsForMode(mode) {
    if (!this.keyLight) return;
    const factor = this.lightIntensityFactor || 1.0;

    if (mode === 'clay') {
      // Configuración de estudio neutro tipo Nomad Sculpt / ZBrush MatCap Clay
      this.keyLight.color.setHex(0xffffff);
      this.keyLight.intensity = 1.35 * factor;
      this.keyLight.position.set(10, 15, 12);

      this.fillLight.color.setHex(0xedf2f7); // Relleno blanco estudio puro (sin tinte cian)
      this.fillLight.intensity = 0.65 * factor;
      this.fillLight.position.set(-12, 6, -8);

      this.rimLight.color.setHex(0xf8fafc); // Contorno blanco neutro suave
      this.rimLight.intensity = 0.55 * factor;
      this.rimLight.position.set(0, -10, -10);

      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.55 * factor;

      // Ocultar sombra en el suelo para flotación limpia de estudio
      if (this.contactShadow) {
        this.contactShadow.visible = false;
      }
      // Fondo vignette neutro tipo escultura digital
      if (this.canvas && this.canvas.parentElement) {
        this.canvas.parentElement.classList.add('mode-clay');
      }
    } else {
      // Modo anatómico estándar con matices médicos y sombra de suelo
      this.keyLight.color.setHex(0xfff8ee);
      this.keyLight.intensity = 1.6 * factor;
      this.keyLight.position.set(12, 16, 14);

      this.fillLight.color.setHex(0x94d2bd); // Tono cian médico suave
      this.fillLight.intensity = 0.8 * factor;
      this.fillLight.position.set(-14, 8, -10);

      this.rimLight.color.setHex(0x06b6d4); // Rim light cian
      this.rimLight.intensity = 1.0 * factor;
      this.rimLight.position.set(0, -12, -12);

      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.6 * factor;

      if (this.contactShadow) {
        this.contactShadow.visible = true;
      }
      if (this.canvas && this.canvas.parentElement) {
        this.canvas.parentElement.classList.remove('mode-clay');
      }
    }
  }

  setLightIntensity(factor) {
    this.lightIntensityFactor = factor;
    this.updateLightsForMode(this.currentVisualMode);
  }

  /**
   * Crea el material de visualización médica / hueso yeso neutro
   * Superficie anatómica limpia y sedosa sin artefactos poligonales
   */
  createClayMaterial(origMat) {
    const planes = (origMat && origMat.clippingPlanes) ? origMat.clippingPlanes : [];
    return new THREE.MeshStandardMaterial({
      color: 0xc4c7cb, // Tono neutro gris piedra/yeso anatómico médico suave
      roughness: 0.65, // Rugosidad mate satinada que difumina la luz suavemente
      metalness: 0.0,  // Sin reflejo metálico (dieléctrico anatómico)
      flatShading: false, // Suavizado anatómico continuo
      clippingPlanes: planes,
      clipShadows: true,
      side: THREE.DoubleSide
    });
  }

  setModel(model) {
    // Eliminar modelo anterior del pivote
    if (this.currentModel) {
      this.modelPivot.remove(this.currentModel);
      this.disposeObject(this.currentModel);
      this.originalMaterials.clear();
    }

    // Restablecer rotación del pivote para el nuevo espécimen
    this.modelRotation = { x: 0, y: 0, z: 0 };
    this.modelPivot.rotation.set(0, 0, 0);

    this.currentModel = model;
    this.modelPivot.add(model);
    this.modelPivot.updateMatrixWorld(true);

    // Guardar materiales originales y asegurar normales de vértice suaves continuas
    model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        child.castShadow = true;
        child.receiveShadow = true;
        this.originalMaterials.set(child, child.material);
      }
    });

    // Re-aplicar el modo visual activo si es diferente al realista
    if (this.currentVisualMode !== 'realistic') {
      this.setVisualMode(this.currentVisualMode);
    }

    // Ajustar y centrar la cámara automáticamente en el modelo
    this.fitCameraToModel();
  }

  /**
   * Modifica la rotación del modelo como tal en grados (0 a 360)
   */
  setModelRotation(xDeg, yDeg, zDeg = 0) {
    const safeX = Number(xDeg) || 0;
    const safeY = Number(yDeg) || 0;
    const safeZ = Number(zDeg) || 0;

    this.modelRotation.x = ((Math.round(safeX) % 360) + 360) % 360;
    this.modelRotation.y = ((Math.round(safeY) % 360) + 360) % 360;
    this.modelRotation.z = ((Math.round(safeZ) % 360) + 360) % 360;

    if (this.modelPivot) {
      this.modelPivot.rotation.x = THREE.MathUtils.degToRad(this.modelRotation.x);
      this.modelPivot.rotation.y = THREE.MathUtils.degToRad(this.modelRotation.y);
      this.modelPivot.rotation.z = THREE.MathUtils.degToRad(this.modelRotation.z);
      this.modelPivot.updateMatrixWorld(true);
    }

    // Actualizar sombra de contacto para que descanse bajo el hueso girado
    if (this.contactShadow && this.currentModel) {
      const box = new THREE.Box3().setFromObject(this.currentModel);
      this.contactShadow.position.y = box.min.y - 0.05;
    }

    this.render();
    return { ...this.modelRotation };
  }

  /**
   * Rota el modelo un valor delta puntual (por ejemplo +90, -45, etc.)
   */
  rotateModelAxis(axis, deltaDeg) {
    if (axis === 'x') {
      return this.setModelRotation(this.modelRotation.x + deltaDeg, this.modelRotation.y, this.modelRotation.z);
    } else if (axis === 'y') {
      return this.setModelRotation(this.modelRotation.x, this.modelRotation.y + deltaDeg, this.modelRotation.z);
    } else if (axis === 'z') {
      return this.setModelRotation(this.modelRotation.x, this.modelRotation.y, this.modelRotation.z + deltaDeg);
    }
    return { ...this.modelRotation };
  }

  /**
   * Restablece la rotación del modelo a (0, 0, 0)
   */
  resetModelRotation() {
    return this.setModelRotation(0, 0, 0);
  }

  getModelRotation() {
    return { ...this.modelRotation };
  }

  setDefaultCameraPose(pose) {
    this.defaultCameraPose = pose ? {
      position: new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
      target: new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z),
      up: new THREE.Vector3(pose.up.x, pose.up.y, pose.up.z)
    } : null;
  }

  applyDefaultCameraPose() {
    if (!this.defaultCameraPose) return false;
    this.camera.up.copy(this.defaultCameraPose.up);
    this.camera.position.copy(this.defaultCameraPose.position);
    this.controls.target.copy(this.defaultCameraPose.target);
    this.camera.lookAt(this.controls.target);
    this.controls.update();

    if (this.contactShadow && this.currentModel) {
      const box = new THREE.Box3().setFromObject(this.currentModel);
      this.contactShadow.position.y = box.min.y - 0.05;
    }

    this.render();
    return true;
  }

  fitCameraToModel() {
    if (!this.currentModel) return;

    if (this.defaultCameraPose) {
      this.applyDefaultCameraPose();
      return;
    }

    this.camera.up.set(0, 1, 0);
    const box = new THREE.Box3().setFromObject(this.currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    cameraDistance = Math.max(cameraDistance, 5);

    this.camera.position.set(center.x, center.y + size.y * 0.1, center.z + cameraDistance);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();

    // Actualizar posición de la sombra debajo del hueso
    if (this.contactShadow) {
      this.contactShadow.position.y = box.min.y - 0.05;
      const shadowSize = maxDim * 1.8;
      this.contactShadow.scale.set(shadowSize / 24, shadowSize / 24, 1);
    }
  }

  resetView() {
    this.fitCameraToModel();
  }

  setVisualMode(mode) {
    this.currentVisualMode = mode;
    this.updateLightsForMode(mode);

    if (!this.currentModel) return;

    this.currentModel.traverse((child) => {
      if (child.isMesh && !child.name.startsWith("StencilCap_") && !child.name.startsWith("Stencil")) {
        const origMat = this.originalMaterials.get(child) || child.material;

        switch (mode) {
          case 'realistic':
            child.material = origMat;
            break;

          case 'clay':
            // Nuevo estilo de vista de escultura neutra con curvatura y cavidades (tipo Nomad Sculpt / ZBrush)
            if (Array.isArray(origMat)) {
              child.material = origMat.map((m) => this.createClayMaterial(m));
            } else {
              child.material = this.createClayMaterial(origMat);
            }
            break;

          case 'xray':
            // Material translúcido estilo radiografía / rayos X
            const xrayConfig = {
              color: 0x38bdf8,
              transmission: 0.75,
              opacity: 0.85,
              transparent: true,
              roughness: 0.2,
              ior: 1.3,
              clippingPlanes: (origMat && origMat.clippingPlanes) || [],
              side: THREE.DoubleSide
            };
            child.material = new THREE.MeshPhysicalMaterial(xrayConfig);
            break;

          case 'wireframe':
            // Malla de alambre técnica
            child.material = new THREE.MeshBasicMaterial({
              color: 0x06b6d4,
              wireframe: true,
              clippingPlanes: (origMat && origMat.clippingPlanes) || []
            });
            break;
        }
      }
    });
  }

  captureScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `AnatoCut_3D_Corte_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataURL;
    link.click();
  }

  onResize() {
    const container = this.canvas.parentElement;
    const width = (container && container.clientWidth) ? container.clientWidth : (window.innerWidth - 360);
    const height = (container && container.clientHeight) ? container.clientHeight : (window.innerHeight - 62);
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  calculateFPS() {
    this.fpsFrames++;
    const now = performance.now();
    if (now >= this.fpsLastTime + 1000) {
      this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsLastTime));
      this.fpsFrames = 0;
      this.fpsLastTime = now;
      return this.fps;
    }
    return null;
  }

  getModelStats() {
    if (!this.currentModel) return { polygons: 0, vertices: 0 };
    let polygons = 0;
    let vertices = 0;
    this.currentModel.traverse((child) => {
      if (child.isMesh && child.geometry) {
        if (child.geometry.index) {
          polygons += child.geometry.index.count / 3;
        } else if (child.geometry.attributes.position) {
          polygons += child.geometry.attributes.position.count / 3;
        }
        if (child.geometry.attributes.position) {
          vertices += child.geometry.attributes.position.count;
        }
      }
    });
    return { polygons: Math.round(polygons), vertices };
  }

  disposeObject(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  // Control de Mesa Giratoria
  toggleTurntable() {
    this.controls.autoRotate = !this.controls.autoRotate;
    return this.controls.autoRotate;
  }

  setTurntable(enabled) {
    this.controls.autoRotate = enabled;
  }

  isTurntableActive() {
    return this.controls.autoRotate;
  }

  update() {
    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
