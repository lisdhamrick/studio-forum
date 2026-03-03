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
  timerId: null,
  observer: null
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

const detailCount = (scene) => (scene && Array.isArray(scene.hotspots) ? scene.hotspots.length : 0);

const buildProgressMarkup = () => {
  const totalScenes = state.project ? state.project.scenes.length : 0;
  const labels = ["Context", "Direction", "Options", "Decision"];
  return labels
    .map((label, index) => {
      const threshold = Math.ceil(((index + 1) / labels.length) * Math.max(totalScenes, 1));
      const active = state.sceneIndex + 1 >= threshold;
      return `<div class="hybrid-chip ${active ? "hybrid-chip-active" : ""}">${label}</div>`;
    })
    .join("");
};

const render = () => {
  clampIndex();

  if (!state.project) {
    app.innerHTML = '<p class="lede">No presentation data found.</p>';
    return;
  }

  const scene = activeScene();
  const hotspot = activeHotspot();
  const totalScenes = state.project.scenes.length;
  const totalHotspots = detailCount(scene);

  const notesMarkup = totalHotspots
    ? scene.hotspots
        .map((item, index) => {
          const isActive = index === state.hotspotIndex;
          return `
            <div class="hybrid-note reveal ${isActive ? "hybrid-note-active" : ""}" data-note-index="${index}">
              <strong>${index + 1} · ${escapeHtml(item.title)}</strong>
              <p>${toText(item.note)}</p>
            </div>
          `;
        })
        .join("")
    : '<div class="hybrid-note reveal"><strong>No callouts yet</strong><p>Add hotspots from the editor to guide client attention.</p></div>';

  app.innerHTML = `
    <div class="hybrid-viewer">
      <header class="hybrid-topbar reveal">
        <div class="hybrid-brand">Studio Forum · Client Review</div>
        <div class="hybrid-status">Scene ${state.sceneIndex + 1}/${totalScenes}${hotspot ? ` · Detail ${state.hotspotIndex + 1}/${totalHotspots}` : ""}</div>
      </header>

      <section class="hybrid-hero reveal">
        <h1 class="hybrid-title">${escapeHtml(state.project.title)}</h1>
        <p class="hybrid-subtitle">${toText(scene ? scene.title : "")}${scene && scene.narrative ? `<br />${toText(scene.narrative)}` : ""}</p>
      </section>

      <article class="hybrid-frame reveal" id="sceneWrap">
        <div class="hybrid-beam"></div>
        <div class="hybrid-image-wrap">
          ${scene && scene.imageDataUrl ? `<img id="sceneImage" src="${scene.imageDataUrl}" alt="${escapeHtml(scene.title || "Scene")}" />` : '<div class="hybrid-placeholder">No scene image yet.</div>'}
        </div>
        <div class="hybrid-vignette"></div>
        <div id="tooltip" class="tooltip hidden"></div>

        <aside class="hybrid-note-panel" id="notePanel">${notesMarkup}</aside>

        <div class="hybrid-dock reveal">
          <span>${hotspot ? escapeHtml(hotspot.title) : "No detail selected"}</span>
          <div class="hybrid-progress">${buildProgressMarkup()}</div>
        </div>
      </article>

      <div class="hybrid-controls reveal">
        <button class="btn" id="prevScene">Previous Scene</button>
        <button class="btn" id="nextScene">Next Scene</button>
        <button class="btn" id="prevHotspot">Previous Detail</button>
        <button class="btn" id="nextHotspot">Next Detail</button>
        <button class="btn" id="toggleFlow">Flow ${state.flowMode ? "On" : "Off"}</button>
        <button class="btn primary" id="toggleAuto">Autoplay ${state.autoPlay ? "On" : "Off"}</button>
      </div>

      <section class="hybrid-sections">
        <div class="hybrid-section reveal">
          <h3>Decision Rationale</h3>
          <p>${toText(scene ? scene.rationale : "") || "No rationale text for this scene yet."}</p>
        </div>
        <div class="hybrid-section reveal">
          <h3>Audience Clarity</h3>
          <p>Subtle motion and callouts reveal one detail at a time so stakeholders can review asynchronously without confusion.</p>
        </div>
        <div class="hybrid-section reveal">
          <h3>Presentation Flow</h3>
          <p>Keyboard and button controls keep the review sequence intentional while preserving a polished client-facing destination.</p>
        </div>
      </section>
    </div>
  `;

  wireViewEvents();
  drawHotspots();
  wireScrollReveal();
};

const drawHotspots = () => {
  const scene = activeScene();
  const wrap = document.getElementById("sceneWrap");
  if (!scene || !wrap || !scene.hotspots || !scene.hotspots.length) return;

  const tooltip = document.getElementById("tooltip");

  scene.hotspots.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const isActive = index === state.hotspotIndex;
    const dimmed = state.flowMode && !isActive;
    button.className = `hybrid-hotspot ${isActive ? "hybrid-hotspot-active" : ""} ${dimmed ? "hybrid-hotspot-dim" : ""}`;
    button.style.left = `${item.x}%`;
    button.style.top = `${item.y}%`;
    button.textContent = String(index + 1);
    button.setAttribute("aria-label", item.title);

    button.onclick = () => {
      state.hotspotIndex = index;
      render();
    };

    button.onmouseenter = () => {
      tooltip.classList.remove("hidden");
      tooltip.textContent = item.title;
      tooltip.style.left = `${Math.min(84, item.x + 2)}%`;
      tooltip.style.top = `${Math.max(5, item.y - 6)}%`;
    };

    button.onmouseleave = () => {
      tooltip.classList.add("hidden");
    };

    wrap.appendChild(button);
  });

  const image = document.getElementById("sceneImage");
  if (image) {
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

const wireScrollReveal = () => {
  if (state.observer) {
    state.observer.disconnect();
  }

  const reveals = document.querySelectorAll(".reveal");
  state.observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-visible");
          state.observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -30px 0px" }
  );

  reveals.forEach((node) => state.observer.observe(node));
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
