const app = document.getElementById("app");

const storageKeys = {
  draft: "studioForumDraft"
};

const state = {
  project: null,
  sceneIndex: 0,
  hotspotIndex: 0,
  flowMode: true,
  autoPlay: false,
  timerId: null
};

const getParams = () => new URLSearchParams(window.location.search);

const ensureLightbox = () => {
  let box = document.querySelector(".lightbox");
  if (box) return box;

  box = document.createElement("div");
  box.className = "lightbox hidden";
  box.innerHTML = '<button class="btn lightbox-close" aria-label="Close zoom">x</button><img alt="Zoomed design" />';
  document.body.appendChild(box);

  const close = () => box.classList.add("hidden");
  box.onclick = (event) => {
    if (event.target === box) close();
  };
  box.querySelector("button").onclick = close;
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return box;
};

const openLightbox = (src, alt) => {
  const box = ensureLightbox();
  const img = box.querySelector("img");
  img.src = src;
  img.alt = alt || "Zoomed design";
  box.classList.remove("hidden");
};

const normalizedProject = (project) => {
  if (!project || !Array.isArray(project.scenes)) return null;

  return {
    title: project.title || "Untitled Design Story",
    subtitle: project.subtitle || "",
    scenes: project.scenes.map((scene, sceneIndex) => ({
      title: scene.title || `Scene ${sceneIndex + 1}`,
      narrative: scene.narrative || "",
      rationale: scene.rationale || "",
      imageDataUrl: scene.imageDataUrl || "",
      hotspots: Array.isArray(scene.hotspots)
        ? scene.hotspots
            .map((hotspot, hotspotIndex) => ({
              id: hotspot.id || `h-${sceneIndex}-${hotspotIndex}`,
              title: hotspot.title || "Design detail",
              note: hotspot.note || "",
              x: Number.isFinite(hotspot.x) ? hotspot.x : 50,
              y: Number.isFinite(hotspot.y) ? hotspot.y : 50,
              flowOrder: Number.isFinite(hotspot.flowOrder) ? hotspot.flowOrder : hotspotIndex + 1
            }))
            .sort((a, b) => a.flowOrder - b.flowOrder)
        : []
    }))
  };
};

const loadProject = async () => {
  const params = getParams();
  const src = params.get("src");

  if (src) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const data = await res.json();
        return normalizedProject(data);
      }
    } catch (_err) {
      return null;
    }
  }

  const saved = localStorage.getItem(storageKeys.draft);
  if (saved) {
    try {
      return normalizedProject(JSON.parse(saved));
    } catch (_err) {
      return null;
    }
  }

  try {
    const fallback = await fetch("guides/sample-design-review.json");
    const data = await fallback.json();
    return normalizedProject(data);
  } catch (_err) {
    return null;
  }
};

const activeScene = () => {
  if (!state.project) return null;
  return state.project.scenes[state.sceneIndex] || null;
};

const activeHotspot = () => {
  const scene = activeScene();
  if (!scene || !scene.hotspots.length) return null;
  return scene.hotspots[state.hotspotIndex] || scene.hotspots[0];
};

const clampIndex = () => {
  if (!state.project || !state.project.scenes.length) {
    state.sceneIndex = 0;
    state.hotspotIndex = 0;
    return;
  }

  state.sceneIndex = Math.min(Math.max(0, state.sceneIndex), state.project.scenes.length - 1);
  const scene = activeScene();
  if (!scene || !scene.hotspots.length) {
    state.hotspotIndex = 0;
    return;
  }
  state.hotspotIndex = Math.min(Math.max(0, state.hotspotIndex), scene.hotspots.length - 1);
};

const toText = (value) => escapeHtml(value || "").replaceAll("\n", "<br />");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const render = () => {
  clampIndex();

  if (!state.project) {
    app.innerHTML = '<p class="lede">No presentation data found.</p>';
    return;
  }

  const scene = activeScene();
  const hotspot = activeHotspot();
  const totalScenes = state.project.scenes.length;
  const totalHotspots = scene && scene.hotspots ? scene.hotspots.length : 0;

  app.innerHTML = `
    <div class="viewer-header">
      <div>
        <p class="eyebrow">Design Review Flow</p>
        <h1>${escapeHtml(state.project.title)}</h1>
        <p class="lede">${toText(state.project.subtitle)}</p>
      </div>
      <div class="actions">
        <a class="btn" href="index.html">Home</a>
        <a class="btn" href="editor.html">Edit</a>
        <button class="btn" id="toggleFlow">Flow ${state.flowMode ? "On" : "Off"}</button>
        <button class="btn primary" id="toggleAuto">Autoplay ${state.autoPlay ? "On" : "Off"}</button>
      </div>
    </div>

    <section class="viewer-grid">
      <article class="viewer-card">
        <p class="flow-label">Scene ${state.sceneIndex + 1} of ${totalScenes}</p>
        <h2>${escapeHtml(scene ? scene.title : "Untitled scene")}</h2>
        <p class="lede">${toText(scene ? scene.narrative : "")}</p>

        <div class="scene-image-wrap" id="sceneWrap">
          ${scene && scene.imageDataUrl ? `<img id="sceneImage" src="${scene.imageDataUrl}" alt="${escapeHtml(scene.title || "Scene")}" />` : '<p class="empty-stage">No image for this scene.</p>'}
          <div id="tooltip" class="tooltip hidden"></div>
        </div>

        <div class="flow-section">
          <p class="flow-label">Decision rationale</p>
          <p class="lede">${toText(scene ? scene.rationale : "")}</p>
        </div>
      </article>

      <aside class="flow-panel">
        <p class="flow-label">Scene controls</p>
        <div class="step-actions">
          <button class="btn" id="prevScene">Previous scene</button>
          <button class="btn" id="nextScene">Next scene</button>
        </div>

        <div class="flow-section">
          <p class="flow-label">Detail flow (${totalHotspots})</p>
          <div class="step-actions">
            <button class="btn" id="prevHotspot">Previous detail</button>
            <button class="btn" id="nextHotspot">Next detail</button>
          </div>
          <p class="lede compact">${hotspot ? `Detail ${state.hotspotIndex + 1}: ${escapeHtml(hotspot.title)}` : "No hotspots in this scene."}</p>
          <div class="note-card">${hotspot ? toText(hotspot.note) : "Add hotspot notes in the editor."}</div>
        </div>
      </aside>
    </section>
  `;

  wireViewEvents();
  drawHotspots();
};

const drawHotspots = () => {
  const scene = activeScene();
  const wrap = document.getElementById("sceneWrap");
  if (!scene || !wrap || !scene.hotspots || !scene.hotspots.length) return;

  const tooltip = document.getElementById("tooltip");

  scene.hotspots.forEach((hotspot, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const isActive = index === state.hotspotIndex;
    const dimmed = state.flowMode && !isActive;
    button.className = `hotspot ${isActive ? "active" : ""} ${dimmed ? "dimmed" : ""}`;
    button.style.left = `${hotspot.x}%`;
    button.style.top = `${hotspot.y}%`;
    button.textContent = String(index + 1);
    button.setAttribute("aria-label", hotspot.title);

    button.onclick = () => {
      state.hotspotIndex = index;
      render();
    };

    button.onmouseenter = () => {
      tooltip.classList.remove("hidden");
      tooltip.textContent = hotspot.title;
      tooltip.style.left = `${Math.min(84, hotspot.x + 2)}%`;
      tooltip.style.top = `${Math.max(5, hotspot.y - 6)}%`;
    };

    button.onmouseleave = () => {
      tooltip.classList.add("hidden");
    };

    wrap.appendChild(button);
  });

  const image = document.getElementById("sceneImage");
  if (image) {
    image.style.cursor = "zoom-in";
    image.onclick = () => openLightbox(scene.imageDataUrl, scene.title || "Design");
  }
};

const nextScene = () => {
  if (!state.project) return;
  state.sceneIndex = (state.sceneIndex + 1) % state.project.scenes.length;
  state.hotspotIndex = 0;
  render();
};

const prevScene = () => {
  if (!state.project) return;
  state.sceneIndex = (state.sceneIndex - 1 + state.project.scenes.length) % state.project.scenes.length;
  state.hotspotIndex = 0;
  render();
};

const nextHotspot = () => {
  const scene = activeScene();
  if (!scene || !scene.hotspots.length) {
    nextScene();
    return;
  }

  if (state.hotspotIndex < scene.hotspots.length - 1) {
    state.hotspotIndex += 1;
    render();
    return;
  }

  nextScene();
};

const prevHotspot = () => {
  const scene = activeScene();
  if (!scene || !scene.hotspots.length) {
    prevScene();
    return;
  }

  if (state.hotspotIndex > 0) {
    state.hotspotIndex -= 1;
    render();
    return;
  }

  prevScene();
  const newScene = activeScene();
  if (newScene && newScene.hotspots.length) {
    state.hotspotIndex = newScene.hotspots.length - 1;
  }
  render();
};

const stopAuto = () => {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
};

const startAuto = () => {
  stopAuto();
  state.timerId = setInterval(() => {
    nextHotspot();
  }, 5500);
};

const wireViewEvents = () => {
  document.getElementById("prevScene").onclick = prevScene;
  document.getElementById("nextScene").onclick = nextScene;
  document.getElementById("prevHotspot").onclick = prevHotspot;
  document.getElementById("nextHotspot").onclick = nextHotspot;

  document.getElementById("toggleFlow").onclick = () => {
    state.flowMode = !state.flowMode;
    render();
  };

  document.getElementById("toggleAuto").onclick = () => {
    state.autoPlay = !state.autoPlay;
    if (state.autoPlay) startAuto();
    else stopAuto();
    render();
  };
};

const init = async () => {
  state.project = await loadProject();
  render();

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") nextHotspot();
    if (event.key === "ArrowLeft") prevHotspot();
    if (event.key === "ArrowUp") prevScene();
    if (event.key === "ArrowDown") nextScene();
  });
};

init();
