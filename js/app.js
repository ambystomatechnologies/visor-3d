import { Viewer } from './viewer.js?v=4.3';
import { Slicer } from './slicer.js?v=4.3';
import { ModelLoader } from './loader.js?v=4.3';
import { createSampleBone } from './sampleBone.js?v=4.3';
import { SAMPLE_MODELS, generateThumbnail } from './sampleModels.js?v=4.3';

class App {
  constructor() {
    this.initDOM();
    this.viewer = new Viewer(this.dom.canvas);
    this.slicer = new Slicer(this.viewer);
    this.loader = new ModelLoader();
    this.currentSampleId = 'vertebra_ave';

    // Exponer instancias para inspección global
    window.app = this;
    window.viewer = this.viewer;
    window.slicer = this.slicer;

    this.bindEvents();
    this.setupDragAndDrop();
    this.initSampleModelsGallery();

    // Activar estado visual de Mesa Giratoria por defecto
    this.updateTurntableButtonUI(true);

    // Activar modo de transparencia dinámica al manipular sliders
    this.setupSliderTransparencyMode();

    // Cargar modelo inicial de Vértebra de Ave en vista Realista
    this.loadSampleBoneModel();

    // Iniciar bucle de renderizado fluido a 60fps
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initDOM() {
    this.dom = {
      canvas: document.getElementById('webgl-canvas'),
      fileInput: document.getElementById('file-input'),
      btnSampleModel: document.getElementById('btn-sample-model'),
      btnResetView: document.getElementById('btn-reset-view'),
      btnScreenshot: document.getElementById('btn-screenshot'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      btnHelp: document.getElementById('btn-help'),
      btnCloseHelp: document.getElementById('btn-close-help'),
      btnDismissHelp: document.getElementById('btn-dismiss-help'),
      helpModal: document.getElementById('help-modal'),
      dropZone: document.getElementById('drop-zone-overlay'),

      // Modal de Modelos de Muestra
      sampleModelsModal: document.getElementById('sample-models-modal'),
      sampleModelsGrid: document.getElementById('sample-models-grid'),
      btnCloseSampleModels: document.getElementById('btn-close-sample-models'),
      btnDismissSampleModels: document.getElementById('btn-dismiss-sample-models'),

      // Slicer UI
      toggleSlicer: document.getElementById('toggle-slicer'),
      slicerControls: document.getElementById('slicer-controls'),
      planeButtons: document.querySelectorAll('.btn-plane'),
      slicePosition: document.getElementById('slice-position'),
      slicePosVal: document.getElementById('slice-pos-val'),
      btnInvertSlice: document.getElementById('btn-invert-slice'),
      btnStepPrev: document.getElementById('btn-step-prev'),
      btnStepNext: document.getElementById('btn-step-next'),
      customAngleSection: document.getElementById('custom-angle-section'),
      sliceAngleX: document.getElementById('slice-angle-x'),
      sliceAngleXVal: document.getElementById('slice-angle-x-val'),
      sliceAngleZ: document.getElementById('slice-angle-z'),
      toggleHelperPlane: document.getElementById('toggle-helper-plane'),
      helperOpacity: document.getElementById('helper-opacity'),
      helperOpacityVal: document.getElementById('helper-opacity-val'),
      btnPlayScan: document.getElementById('btn-play-scan'),
      btnTurntable: document.getElementById('btn-turntable'),

      // Acordeones Desplegables
      groupSlicer: document.getElementById('group-slicer'),
      btnToggleGroupSlicer: document.getElementById('btn-toggle-group-slicer'),
      groupRotation: document.getElementById('group-rotation'),
      btnToggleGroupRotation: document.getElementById('btn-toggle-group-rotation'),

      // Rotación del Modelo 3D (Eje X y Eje Z)
      btnResetModelRot: document.getElementById('btn-reset-model-rot'),
      modelRotX: document.getElementById('model-rot-x'),
      modelRotXVal: document.getElementById('model-rot-x-val'),
      modelRotZ: document.getElementById('model-rot-z'),
      modelRotZVal: document.getElementById('model-rot-z-val'),
      btnRotSteps: document.querySelectorAll('.btn-rot-step'),

      // Visual Modes & Lighting
      pillButtons: document.querySelectorAll('.btn-pill'),
      lightIntensity: document.getElementById('light-intensity'),

      // Info HUD
      infoModelName: document.getElementById('info-model-name'),
      infoPolyCount: document.getElementById('info-poly-count'),
      infoFps: document.getElementById('info-fps'),
      toastContainer: document.getElementById('toast-container'),

      // Controles Móviles (Panel Desplegable en Celulares)
      slicerPanel: document.getElementById('slicer-panel'),
      btnOpenMobilePanel: document.getElementById('btn-open-mobile-panel'),
      btnCloseMobilePanel: document.getElementById('btn-close-mobile-panel'),
      mobilePanelBackdrop: document.getElementById('mobile-panel-backdrop')
    };
  }

  bindEvents() {
    // 0. Panel Móvil Desplegable (Drawer para celulares)
    if (this.dom.btnOpenMobilePanel && this.dom.slicerPanel) {
      const openMobile = () => {
        this.dom.slicerPanel.classList.add('mobile-open');
        if (this.dom.mobilePanelBackdrop) this.dom.mobilePanelBackdrop.classList.add('active');
        this.dom.btnOpenMobilePanel.classList.add('hidden');
      };

      const closeMobile = () => {
        this.dom.slicerPanel.classList.remove('mobile-open');
        if (this.dom.mobilePanelBackdrop) this.dom.mobilePanelBackdrop.classList.remove('active');
        this.dom.btnOpenMobilePanel.classList.remove('hidden');
      };

      this.dom.btnOpenMobilePanel.addEventListener('click', openMobile);
      if (this.dom.btnCloseMobilePanel) this.dom.btnCloseMobilePanel.addEventListener('click', closeMobile);
      if (this.dom.mobilePanelBackdrop) this.dom.mobilePanelBackdrop.addEventListener('click', closeMobile);
    }

    // Redirección infalible al hacer clic en el logotipo o marca oficial
    document.querySelectorAll('.logo-group, .header-center-branding, .header-brand-logo, .company-author-logo').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        window.location.href = 'https://ambystomatechnologies.github.io/';
      });
    });

    // 1. Selector de archivos
    this.dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFiles(e.target.files);
      }
    });

    // 2. Botón de Modelos de Muestra (Abre la galería con vista preliminar)
    this.dom.btnSampleModel.addEventListener('click', () => {
      this.openSampleModelsModal();
    });

    this.dom.btnCloseSampleModels.addEventListener('click', () => {
      this.closeSampleModelsModal();
    });

    this.dom.btnDismissSampleModels.addEventListener('click', () => {
      this.closeSampleModelsModal();
    });

    this.dom.sampleModelsModal.addEventListener('click', (e) => {
      if (e.target === this.dom.sampleModelsModal) {
        this.closeSampleModelsModal();
      }
    });

    // 3. Reset de vista (botón y barra espaciadora)
    this.dom.btnResetView.addEventListener('click', () => this.viewer.resetView());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.viewer.resetView();
      } else if (e.code === 'KeyF' && e.target.tagName !== 'INPUT') {
        this.toggleFullscreen();
      }
    });

    // 4. Captura de pantalla de alta resolución
    this.dom.btnScreenshot.addEventListener('click', () => {
      this.viewer.captureScreenshot();
      this.showToast("Captura guardada en alta resolución.", "success");
    });

    // 5. Pantalla completa
    this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // 6. Modal de ayuda
    this.dom.btnHelp.addEventListener('click', () => this.dom.helpModal.classList.remove('hidden'));
    this.dom.btnCloseHelp.addEventListener('click', () => this.dom.helpModal.classList.add('hidden'));
    this.dom.btnDismissHelp.addEventListener('click', () => this.dom.helpModal.classList.add('hidden'));
    this.dom.helpModal.addEventListener('click', (e) => {
      if (e.target === this.dom.helpModal) this.dom.helpModal.classList.add('hidden');
    });

    // 7. Toggle del Slicer
    this.dom.toggleSlicer.addEventListener('change', (e) => {
      const active = e.target.checked;
      this.slicer.setEnabled(active);
      this.showToast(active ? "Herramienta de corte activada." : "Herramienta de corte desactivada.", "info");
    });

    // 8. Botones de planos anatómicos
    this.dom.planeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dom.planeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const plane = btn.dataset.plane;
        this.slicer.setPlaneType(plane);

        if (plane === 'custom') {
          this.dom.customAngleSection.classList.remove('hidden');
        } else {
          this.dom.customAngleSection.classList.add('hidden');
        }

        // Si el slicer estaba apagado, encenderlo automáticamente al elegir un plano
        if (!this.dom.toggleSlicer.checked) {
          this.dom.toggleSlicer.checked = true;
          this.slicer.setEnabled(true);
        }
      });
    });

    // 9. Slider de posición de corte
    this.dom.slicePosition.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.dom.slicePosVal.textContent = `${Math.round(val)}%`;
      this.slicer.setProgress(val / 100);

      if (!this.dom.toggleSlicer.checked) {
        this.dom.toggleSlicer.checked = true;
        this.slicer.setEnabled(true);
      }
    });

    // Navegación de corte paso a paso
    this.dom.btnStepPrev.addEventListener('click', () => {
      let val = Math.max(0, parseFloat(this.dom.slicePosition.value) - 5);
      this.dom.slicePosition.value = val;
      this.dom.slicePosVal.textContent = `${Math.round(val)}%`;
      this.slicer.setProgress(val / 100);
    });

    this.dom.btnStepNext.addEventListener('click', () => {
      let val = Math.min(100, parseFloat(this.dom.slicePosition.value) + 5);
      this.dom.slicePosition.value = val;
      this.dom.slicePosVal.textContent = `${Math.round(val)}%`;
      this.slicer.setProgress(val / 100);
    });

    // 10. Invertir vista de corte
    this.dom.btnInvertSlice.addEventListener('click', () => {
      this.slicer.toggleInvert();
      this.showToast("Vista de corte invertida.", "info");
    });

    // 10.b Acordeones Desplegables de Herramientas
    if (this.dom.btnToggleGroupSlicer) {
      this.dom.btnToggleGroupSlicer.addEventListener('click', () => {
        const isCollapsed = this.dom.groupSlicer.classList.toggle('collapsed');
        this.dom.groupSlicer.classList.toggle('expanded', !isCollapsed);
        this.dom.btnToggleGroupSlicer.setAttribute('aria-expanded', !isCollapsed);
      });
    }

    if (this.dom.btnToggleGroupRotation) {
      this.dom.btnToggleGroupRotation.addEventListener('click', () => {
        const isCollapsed = this.dom.groupRotation.classList.toggle('collapsed');
        this.dom.groupRotation.classList.toggle('expanded', !isCollapsed);
        this.dom.btnToggleGroupRotation.setAttribute('aria-expanded', !isCollapsed);
        if (!isCollapsed) {
          setTimeout(() => {
            const panel = document.getElementById('slicer-controls');
            if (panel) {
              panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
            }
          }, 100);
        }
      });
    }

    // 10.c Rotación de la Pieza (Eje X e Eje Z independientes de la cámara y escena)
    if (this.dom.modelRotX) {
      const handleRotX = () => {
        const xVal = parseFloat(this.dom.modelRotX.value) || 0;
        const zVal = parseFloat(this.dom.modelRotZ ? this.dom.modelRotZ.value : 0) || 0;
        if (this.dom.modelRotXVal) this.dom.modelRotXVal.textContent = `${Math.round(xVal)}°`;
        this.viewer.setModelRotation(xVal, 0, zVal);
        this.slicer.onModelRotated();
      };
      this.dom.modelRotX.addEventListener('input', handleRotX);
      this.dom.modelRotX.addEventListener('change', handleRotX);
    }

    if (this.dom.modelRotZ) {
      const handleRotZ = () => {
        const zVal = parseFloat(this.dom.modelRotZ.value) || 0;
        const xVal = parseFloat(this.dom.modelRotX ? this.dom.modelRotX.value : 0) || 0;
        if (this.dom.modelRotZVal) this.dom.modelRotZVal.textContent = `${Math.round(zVal)}°`;
        this.viewer.setModelRotation(xVal, 0, zVal);
        this.slicer.onModelRotated();
      };
      this.dom.modelRotZ.addEventListener('input', handleRotZ);
      this.dom.modelRotZ.addEventListener('change', handleRotZ);
    }

    // Botones para girar grados puntuales (-90°, -45°, +45°, +90°)
    if (this.dom.btnRotSteps && this.dom.btnRotSteps.length > 0) {
      this.dom.btnRotSteps.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const axis = btn.dataset.axis; // 'x' o 'z'
          const deg = parseFloat(btn.dataset.deg) || 0;
          const newRot = this.viewer.rotateModelAxis(axis, deg);
          this.syncModelRotationUI(newRot);
          this.slicer.onModelRotated();
        });
      });
    }

    // Botón de restablecer rotación del modelo a 0°
    if (this.dom.btnResetModelRot) {
      this.dom.btnResetModelRot.addEventListener('click', (e) => {
        e.preventDefault();
        const newRot = this.viewer.resetModelRotation();
        this.syncModelRotationUI(newRot);
        this.slicer.onModelRotated();
        this.showToast("Orientación de la pieza restablecida (0°).", "info");
      });
    }

    // 11. Ángulos de corte libre
    this.dom.sliceAngleX.addEventListener('input', (e) => {
      const x = parseFloat(e.target.value);
      this.dom.sliceAngleXVal.textContent = `${x}°`;
      this.slicer.setAngles(x, parseFloat(this.dom.sliceAngleZ.value));
    });

    this.dom.sliceAngleZ.addEventListener('input', (e) => {
      const z = parseFloat(e.target.value);
      this.dom.sliceAngleZVal.textContent = `${z}°`;
      this.slicer.setAngles(parseFloat(this.dom.sliceAngleX.value), z);
    });

    // 12. Opciones de visualización y transparencia del plano de corte
    this.dom.toggleHelperPlane.addEventListener('change', (e) => {
      this.slicer.setShowHelper(e.target.checked);
    });

    this.dom.helperOpacity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.dom.helperOpacityVal.textContent = `${val}%`;
      this.slicer.setHelperOpacity(val / 100);
    });

    // 13. Animación de escaneo continuo
    this.dom.btnPlayScan.addEventListener('click', () => {
      if (!this.dom.toggleSlicer.checked) {
        this.dom.toggleSlicer.checked = true;
        this.slicer.setEnabled(true);
      }
      const isScanning = this.slicer.toggleContinuousScan();
      this.dom.btnPlayScan.innerHTML = isScanning ? `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        <span>Pausar Escaneo</span>
      ` : `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>Reproducir Escaneo Continuo</span>
      `;
    });

    // 14. Mesa Giratoria (Auto-rotación 360°)
    this.dom.btnTurntable.addEventListener('click', (e) => {
      e.stopPropagation();
      const active = this.viewer.toggleTurntable();
      this.updateTurntableButtonUI(active);
    });

    // Detener la mesa giratoria al hacer clic en el canvas 3D
    // NOTA: El zoom con el scroll de la rueda (evento 'wheel') NO dispara 'pointerdown',
    // por lo que el aumento/reducción del scroll NO detiene la mesa giratoria.
    this.dom.canvas.addEventListener('pointerdown', () => {
      if (this.viewer.isTurntableActive()) {
        this.viewer.setTurntable(false);
        this.updateTurntableButtonUI(false);
      }
    });

    // 15. Modos de visualización
    this.dom.pillButtons.forEach((pill) => {
      pill.addEventListener('click', () => {
        this.dom.pillButtons.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.viewer.setVisualMode(pill.dataset.mode);
        this.slicer.applyClippingToMaterials();
      });
    });

    // 16. Control de luz
    this.dom.lightIntensity.addEventListener('input', (e) => {
      this.viewer.setLightIntensity(parseFloat(e.target.value));
    });
  }

  updateTurntableButtonUI(active) {
    if (active) {
      this.dom.btnTurntable.classList.add('active');
      this.dom.btnTurntable.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        <span>Detener Mesa Giratoria</span>
      `;
    } else {
      this.dom.btnTurntable.classList.remove('active');
      this.dom.btnTurntable.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>Mesa Giratoria</span>
      `;
    }
  }

  setupDragAndDrop() {
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      this.dom.dropZone.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        this.dom.dropZone.classList.add('hidden');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      this.dom.dropZone.classList.add('hidden');

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFiles(e.dataTransfer.files);
      }
    });
  }

  async handleFiles(files) {
    try {
      const result = await this.loader.loadFiles(files);
      this.applyNewModel(result.object, result.name);
    } catch (err) {
      console.error(err);
      this.showToast(`Error al cargar modelo: ${err.message}`, "error");
    }
  }

  openSampleModelsModal() {
    this.dom.sampleModelsModal.classList.remove('hidden');
  }

  closeSampleModelsModal() {
    this.dom.sampleModelsModal.classList.add('hidden');
  }

  initSampleModelsGallery() {
    const grid = this.dom.sampleModelsGrid;
    grid.innerHTML = '';

    // Renderizar tarjetas de los 8 modelos anatómicos
    SAMPLE_MODELS.forEach((model) => {
      const card = document.createElement('div');
      card.className = `sample-card ${this.currentSampleId === model.id ? 'active-model' : ''}`;
      card.dataset.id = model.id;
      card.dataset.category = model.category;

      card.innerHTML = `
        <div class="sample-card-preview" id="preview-${model.id}">
          <div class="preview-spinner" title="Generando vista previa 3D..."></div>
        </div>
        <div class="sample-card-info">
          <div class="sample-card-header">
            <span class="sample-tag" style="color: ${model.color}; border-color: ${model.color}55; background: ${model.color}18;">${model.tag}</span>
            <span class="sample-size">${model.size}</span>
          </div>
          <h4 class="sample-title">${model.name}</h4>
          <span class="sample-category" style="color: ${model.color};">${model.category}</span>
          <p class="sample-desc">${model.subtitle}</p>
          <div class="sample-card-footer">
            <button class="btn btn-primary" style="font-size: 0.8rem; padding: 8px 12px;">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Examinar esta muestra</span>
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.loadSampleModel(model);
      });

      grid.appendChild(card);

      // Generar miniatura fotográfica 3D asíncrona en alta calidad
      generateThumbnail(model.file).then((thumbUrl) => {
        const previewContainer = document.getElementById(`preview-${model.id}`);
        if (previewContainer && thumbUrl) {
          previewContainer.innerHTML = `<img src="${thumbUrl}" alt="Vista previa de ${model.name}">`;
        } else if (previewContainer) {
          previewContainer.innerHTML = `<div style="font-size: 2.2rem;">🦴</div>`;
        }
      });
    });

    // Conectar botones de filtro de categorías
    const filterButtons = this.dom.sampleModelsModal.querySelectorAll('.btn-filter');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const cat = btn.dataset.category;
        const allCards = grid.querySelectorAll('.sample-card');
        allCards.forEach((card) => {
          if (cat === 'all' || card.dataset.category === cat) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  async loadSampleModel(model) {
    this.closeSampleModelsModal();
    this.currentSampleId = model.id;

    // Actualizar clase activa en la galería
    const cards = this.dom.sampleModelsGrid.querySelectorAll('.sample-card');
    cards.forEach((c) => {
      c.classList.toggle('active-model', c.dataset.id === model.id);
    });

    try {
      if (model.defaultPose) {
        this.viewer.setDefaultCameraPose(model.defaultPose);
      } else {
        this.viewer.setDefaultCameraPose(null);
      }
      const result = await this.loader.loadUrl(model.file, `${model.name} (${model.category})`);
      this.applyNewModel(result.object, result.name);
    } catch (err) {
      console.error(err);
      this.showToast(`Error al cargar ${model.name}: ${err.message}`, "error");
    }
  }

  async loadSampleBoneModel() {
    const defaultModel = SAMPLE_MODELS.find((m) => m.id === 'vertebra_ave') || SAMPLE_MODELS[0];
    this.loadSampleModel(defaultModel);
  }

  applyNewModel(model, name) {
    if (name.toLowerCase().includes('condor') && !this.viewer.defaultCameraPose) {
      this.viewer.setDefaultCameraPose({
        position: { x: -7.98746, y: 2.46282, z: 1.81975 },
        target: { x: 0.11756, y: 0.70313, z: 0.22103 },
        up: { x: 0.15532, y: -0.07979, z: 0.98464 }
      });
    }

    this.viewer.setModel(model);
    this.slicer.updateModelBounds();
    this.slicer.applyClippingToMaterials();

    // Actualizar UI
    this.dom.infoModelName.textContent = `Modelo: ${name}`;
    const stats = this.viewer.getModelStats();
    this.dom.infoPolyCount.textContent = `Polígonos: ${stats.polygons.toLocaleString()}`;

    // Resetear slider de corte al 50%
    this.dom.slicePosition.value = 50;
    this.dom.slicePosVal.textContent = "50%";
    this.slicer.setProgress(0.5);

    // Resetear UI de rotación de la pieza a 0°
    this.syncModelRotationUI({ x: 0, y: 0, z: 0 });
  }

  syncModelRotationUI(rot) {
    if (!rot) rot = this.viewer.getModelRotation();
    if (this.dom.modelRotX) {
      this.dom.modelRotX.value = Math.round(rot.x);
      this.dom.modelRotXVal.textContent = `${Math.round(rot.x)}°`;
    }
    if (this.dom.modelRotZ) {
      this.dom.modelRotZ.value = Math.round(rot.z);
      this.dom.modelRotZVal.textContent = `${Math.round(rot.z)}°`;
    }
  }

  /**
   * Hace transparente el panel y el fondo mientras se arrastra cualquier slider
   * de corte o giro, permitiendo ver la pieza anatómica claramente en tiempo real.
   */
  setupSliderTransparencyMode() {
    if (!this.dom.slicerPanel) return;
    const sliders = this.dom.slicerPanel.querySelectorAll('input[type="range"]');
    if (!sliders || sliders.length === 0) return;

    let activeSliderSection = null;
    let activeGroup = null;

    const startTransparency = (slider) => {
      // Exclusivo para celulares (en PC se mantiene la visibilidad intacta como solicitado)
      if (window.innerWidth > 768) return;

      this.dom.slicerPanel.classList.add('slider-active-mode');
      if (this.dom.mobilePanelBackdrop) {
        this.dom.mobilePanelBackdrop.classList.add('slider-active-mode');
      }

      activeSliderSection = slider.closest('.control-section') || slider.parentElement;
      if (activeSliderSection) {
        activeSliderSection.classList.add('slider-dragging-active');
      }

      activeGroup = slider.closest('.accordion-group');
      if (activeGroup) {
        activeGroup.classList.add('has-active-slider');
      }
    };

    const endTransparency = () => {
      this.dom.slicerPanel.classList.remove('slider-active-mode');
      if (this.dom.mobilePanelBackdrop) {
        this.dom.mobilePanelBackdrop.classList.remove('slider-active-mode');
      }

      if (activeSliderSection) {
        activeSliderSection.classList.remove('slider-dragging-active');
        activeSliderSection = null;
      }

      if (activeGroup) {
        activeGroup.classList.remove('has-active-slider');
        activeGroup = null;
      }
    };

    sliders.forEach((slider) => {
      slider.addEventListener('pointerdown', () => startTransparency(slider));
      slider.addEventListener('touchstart', () => startTransparency(slider), { passive: true });
      slider.addEventListener('change', endTransparency);
    });

    window.addEventListener('pointerup', endTransparency);
    window.addEventListener('pointercancel', endTransparency);
    window.addEventListener('touchend', endTransparency);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen no permitido:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Animación de escaneo si está activa
    const animProgress = this.slicer.updateAnimation();
    if (animProgress !== null) {
      const pct = Math.round(animProgress * 100);
      this.dom.slicePosition.value = pct;
      this.dom.slicePosVal.textContent = `${pct}%`;
    }

    // Actualizar controles y renderizar Three.js
    this.viewer.update();
    this.viewer.render();

    // Actualizar medidor de FPS
    const fps = this.viewer.calculateFPS();
    if (fps !== null) {
      this.dom.infoFps.textContent = `${fps} FPS`;
    }
  }
}

// Inicialización de la aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
