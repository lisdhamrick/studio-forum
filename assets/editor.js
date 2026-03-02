const storageKeys = {
  draft: "studioForumDraft"
};

const createScene = (index = 1) => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: `Scene ${index}`,
  narrative: "",
  rationale: "",
  imageDataUrl: "",
  hotspots: []
});

const defaultProject = () => ({
  title: "Untitled Design Story",
  subtitle: "",
  scenes: [createScene(1)],
  updatedAt: new Date().toISOString()
});

const state = {
  project: defaultProject(),
  activeSceneIndex: 0,
  selectedHotspotId: "",
  placingHotspot: false
};

const els = {
  sceneList: document.getElementById("sceneList"),
  addScene: document.getElementById("addScene"),
  removeScene: document.getElementById("removeScene"),
  moveSceneUp: document.getElementById("moveSceneUp"),
  moveSceneDown: document.getElementById("moveSceneDown"),
  projectTitle: document.getElementById("projectTitle"),
  projectSubtitle: document.getElementById("projectSubtitle"),
  sceneTitle: document.getElementById("sceneTitle"),
  sceneNarrative: document.getElementById("sceneNarrative"),
  sceneRationale: document.getElementById("sceneRationale"),
  sceneImage: document.getElementById("sceneImage"),
  imageStage: document.getElementById("imageStage"),
  placementHint: document.getElementById("placementHint"),
  hotspotList: document.getElementById("hotspotList"),
  hotspotCount: document.getElementById("hotspotCount"),
  placeHotspot: document.getElementById("placeHotspot"),
  clearHotspots: document.getElementById("clearHotspots"),
  loadJson: document.getElementById("loadJson"),
  exportJson: document.getElementById("exportJson"),
  clearDraft: document.getElementById("clearDraft"),
  jsonFile: document.getElementById("jsonFile")
};

const getActiveScene = () => state.project.scenes[state.activeSceneIndex];

const saveDraft = () => {
  state.project.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKeys.draft, JSON.stringify(state.project));
};

const loadDraft = async () => {
  const params = new URLSearchParams(window.location.search);
  const src = params.get("src");

  if (src) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.scenes)) {
          state.project = normalizeProject(data);
          return;
        }
      }
    } catch (_err) {
      // ignore src load errors and fall back to local
    }
  }

  const saved = localStorage.getItem(storageKeys.draft);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.project = normalizeProject(parsed);
  } catch (_err) {
    state.project = defaultProject();
  }
};

const normalizeProject = (project) => {
  const normalized = {
    title: project.title || "Untitled Design Story",
    subtitle: project.subtitle || "",
    scenes: Array.isArray(project.scenes) && project.scenes.length ? project.scenes : [createScene(1)],
    updatedAt: project.updatedAt || new Date().toISOString()
  };

  normalized.scenes = normalized.scenes.map((scene, index) => ({
    id: scene.id || createScene(index + 1).id,
    title: scene.title || `Scene ${index + 1}`,
    narrative: scene.narrative || "",
    rationale: scene.rationale || "",
    imageDataUrl: scene.imageDataUrl || "",
    hotspots: Array.isArray(scene.hotspots)
      ? scene.hotspots.map((hotspot, hotspotIndex) => ({
          id: hotspot.id || `h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          label: hotspot.label || `H${hotspotIndex + 1}`,
          title: hotspot.title || "Design detail",
          note: hotspot.note || "",
          x: Number.isFinite(hotspot.x) ? hotspot.x : 50,
          y: Number.isFinite(hotspot.y) ? hotspot.y : 50,
          flowOrder: Number.isFinite(hotspot.flowOrder) ? hotspot.flowOrder : hotspotIndex + 1
        }))
      : []
  }));

  return normalized;
};

const renderSceneList = () => {
  els.sceneList.innerHTML = "";

  state.project.scenes.forEach((scene, index) => {
    const node = document.createElement("div");
    node.className = `scene-item ${index === state.activeSceneIndex ? "active" : ""}`;
    node.textContent = `${index + 1}. ${scene.title || "Untitled scene"}`;
    node.onclick = () => {
      state.activeSceneIndex = index;
      state.selectedHotspotId = "";
      state.placingHotspot = false;
      render();
    };
    els.sceneList.appendChild(node);
  });
};

const renderStage = () => {
  const scene = getActiveScene();
  els.imageStage.innerHTML = "";

  els.placementHint.textContent = state.placingHotspot
    ? "Placement mode on: click image to add hotspot."
    : "";

  if (!scene || !scene.imageDataUrl) {
    const empty = document.createElement("p");
    empty.className = "empty-stage";
    empty.textContent = "Upload a scene image to place hotspots.";
    els.imageStage.appendChild(empty);
    return;
  }

  const img = document.createElement("img");
  img.src = scene.imageDataUrl;
  img.alt = scene.title || "Scene";
  img.onclick = (event) => {
    if (!state.placingHotspot) return;

    const rect = img.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const hotspot = {
      id: crypto.randomUUID ? crypto.randomUUID() : `hotspot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: `H${scene.hotspots.length + 1}`,
      title: `Detail ${scene.hotspots.length + 1}`,
      note: "Add presenter notes.",
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      flowOrder: scene.hotspots.length + 1
    };

    scene.hotspots.push(hotspot);
    state.selectedHotspotId = hotspot.id;
    state.placingHotspot = false;
    saveDraft();
    render();
  };

  els.imageStage.appendChild(img);

  scene.hotspots
    .slice()
    .sort((a, b) => a.flowOrder - b.flowOrder)
    .forEach((hotspot) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `hotspot ${state.selectedHotspotId === hotspot.id ? "active" : ""}`;
      node.style.left = `${hotspot.x}%`;
      node.style.top = `${hotspot.y}%`;
      node.textContent = String(hotspot.flowOrder);
      node.title = hotspot.title;
      node.onclick = (event) => {
        event.stopPropagation();
        state.selectedHotspotId = hotspot.id;
        renderHotspotList();
        renderStage();
      };
      els.imageStage.appendChild(node);
    });
};

const reorderHotspots = (scene) => {
  scene.hotspots
    .sort((a, b) => a.flowOrder - b.flowOrder)
    .forEach((hotspot, index) => {
      hotspot.flowOrder = index + 1;
      hotspot.label = `H${index + 1}`;
    });
};

const renderHotspotList = () => {
  const scene = getActiveScene();
  els.hotspotList.innerHTML = "";

  if (!scene) return;

  reorderHotspots(scene);
  els.hotspotCount.textContent = `${scene.hotspots.length} total`;

  scene.hotspots
    .slice()
    .sort((a, b) => a.flowOrder - b.flowOrder)
    .forEach((hotspot, index) => {
      const row = document.createElement("div");
      row.className = "hotspot-row";
      row.innerHTML = `
        <div class="hotspot-row-head">
          <strong>Hotspot ${hotspot.flowOrder}</strong>
          <div class="hotspot-actions">
            <button type="button" class="btn" data-action="up">Up</button>
            <button type="button" class="btn" data-action="down">Down</button>
            <button type="button" class="btn" data-action="delete">Delete</button>
          </div>
        </div>
        <label>
          Label
          <input data-field="title" value="${escapeHtml(hotspot.title)}" />
        </label>
        <label>
          Presenter note
          <textarea data-field="note">${escapeHtml(hotspot.note || "")}</textarea>
        </label>
        <label>
          Position (X / Y)
          <input data-field="position" value="${hotspot.x.toFixed(2)}, ${hotspot.y.toFixed(2)}" />
        </label>
      `;

      row.querySelector('[data-field="title"]').addEventListener("input", (event) => {
        hotspot.title = event.target.value;
        saveDraft();
      });

      row.querySelector('[data-field="note"]').addEventListener("input", (event) => {
        hotspot.note = event.target.value;
        saveDraft();
      });

      row.querySelector('[data-field="position"]').addEventListener("change", (event) => {
        const parsed = parsePosition(event.target.value);
        if (!parsed) {
          event.target.value = `${hotspot.x.toFixed(2)}, ${hotspot.y.toFixed(2)}`;
          return;
        }
        hotspot.x = parsed.x;
        hotspot.y = parsed.y;
        saveDraft();
        renderStage();
      });

      row.querySelector('[data-action="up"]').onclick = () => {
        if (index === 0) return;
        const prev = scene.hotspots.find((item) => item.flowOrder === hotspot.flowOrder - 1);
        if (!prev) return;
        prev.flowOrder += 1;
        hotspot.flowOrder -= 1;
        saveDraft();
        render();
      };

      row.querySelector('[data-action="down"]').onclick = () => {
        if (index === scene.hotspots.length - 1) return;
        const next = scene.hotspots.find((item) => item.flowOrder === hotspot.flowOrder + 1);
        if (!next) return;
        next.flowOrder -= 1;
        hotspot.flowOrder += 1;
        saveDraft();
        render();
      };

      row.querySelector('[data-action="delete"]').onclick = () => {
        const idx = scene.hotspots.findIndex((item) => item.id === hotspot.id);
        if (idx < 0) return;
        scene.hotspots.splice(idx, 1);
        if (state.selectedHotspotId === hotspot.id) state.selectedHotspotId = "";
        saveDraft();
        render();
      };

      els.hotspotList.appendChild(row);
    });
};

const renderForm = () => {
  const scene = getActiveScene();
  if (!scene) return;

  els.projectTitle.value = state.project.title || "";
  els.projectSubtitle.value = state.project.subtitle || "";

  els.sceneTitle.value = scene.title || "";
  els.sceneNarrative.value = scene.narrative || "";
  els.sceneRationale.value = scene.rationale || "";
  els.sceneImage.value = "";
};

const render = () => {
  renderSceneList();
  renderForm();
  renderStage();
  renderHotspotList();
};

const updateFromInputs = () => {
  const scene = getActiveScene();
  if (!scene) return;

  state.project.title = els.projectTitle.value.trim() || "Untitled Design Story";
  state.project.subtitle = els.projectSubtitle.value.trim();
  scene.title = els.sceneTitle.value.trim() || `Scene ${state.activeSceneIndex + 1}`;
  scene.narrative = els.sceneNarrative.value;
  scene.rationale = els.sceneRationale.value;

  saveDraft();
  renderSceneList();
};

const readImageAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const compressImage = async (file) => {
  const dataUrl = await readImageAsDataUrl(file);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxWidth = 2200;
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const webp = canvas.toDataURL("image/webp", 0.9);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.9);
};

const exportJson = () => {
  const payload = JSON.stringify(state.project, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "design-story.json";
  a.click();
  URL.revokeObjectURL(url);
};

const parsePosition = (value) => {
  const pieces = String(value)
    .split(",")
    .map((item) => Number.parseFloat(item.trim()));

  if (pieces.length !== 2 || pieces.some((item) => !Number.isFinite(item))) return null;

  const x = clamp(pieces[0], 0, 100);
  const y = clamp(pieces[1], 0, 100);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const wireEvents = () => {
  [els.projectTitle, els.projectSubtitle, els.sceneTitle, els.sceneNarrative, els.sceneRationale].forEach((el) => {
    el.addEventListener("input", updateFromInputs);
  });

  els.sceneImage.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const scene = getActiveScene();
    if (!scene) return;

    try {
      scene.imageDataUrl = await compressImage(file);
      saveDraft();
      renderStage();
    } catch (_err) {
      // ignore image failures
    }
  });

  els.addScene.onclick = () => {
    state.project.scenes.push(createScene(state.project.scenes.length + 1));
    state.activeSceneIndex = state.project.scenes.length - 1;
    state.selectedHotspotId = "";
    saveDraft();
    render();
  };

  els.removeScene.onclick = () => {
    if (state.project.scenes.length <= 1) return;
    state.project.scenes.splice(state.activeSceneIndex, 1);
    state.activeSceneIndex = Math.min(state.activeSceneIndex, state.project.scenes.length - 1);
    state.selectedHotspotId = "";
    saveDraft();
    render();
  };

  els.moveSceneUp.onclick = () => {
    if (state.activeSceneIndex <= 0) return;
    const from = state.activeSceneIndex;
    const to = from - 1;
    [state.project.scenes[to], state.project.scenes[from]] = [state.project.scenes[from], state.project.scenes[to]];
    state.activeSceneIndex = to;
    saveDraft();
    render();
  };

  els.moveSceneDown.onclick = () => {
    if (state.activeSceneIndex >= state.project.scenes.length - 1) return;
    const from = state.activeSceneIndex;
    const to = from + 1;
    [state.project.scenes[to], state.project.scenes[from]] = [state.project.scenes[from], state.project.scenes[to]];
    state.activeSceneIndex = to;
    saveDraft();
    render();
  };

  els.placeHotspot.onclick = () => {
    const scene = getActiveScene();
    if (!scene || !scene.imageDataUrl) return;
    state.placingHotspot = !state.placingHotspot;
    renderStage();
  };

  els.clearHotspots.onclick = () => {
    const scene = getActiveScene();
    if (!scene) return;
    scene.hotspots = [];
    state.selectedHotspotId = "";
    saveDraft();
    render();
  };

  els.exportJson.onclick = exportJson;

  els.loadJson.onclick = () => {
    els.jsonFile.click();
  };

  els.jsonFile.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      state.project = normalizeProject(parsed);
      state.activeSceneIndex = 0;
      state.selectedHotspotId = "";
      state.placingHotspot = false;
      saveDraft();
      render();
    } catch (_err) {
      // ignore malformed json
    }

    els.jsonFile.value = "";
  });

  els.clearDraft.onclick = () => {
    state.project = defaultProject();
    state.activeSceneIndex = 0;
    state.selectedHotspotId = "";
    state.placingHotspot = false;
    saveDraft();
    render();
  };
};

const init = async () => {
  await loadDraft();
  wireEvents();
  render();
};

init();
