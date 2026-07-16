"use strict";

document.documentElement.classList.add("js");

const LOADED = {
  header: {
    init: false,
    settled: false,
    func: init_header
  },
  footer: {
    init: false,
    settled: false,
    func: init_footer
  }
};

const SITE_STATE = {
  menuOpen: false,
  currentMedia: 0,
  initStarted: false
};

let componentsneeded = 0;
let componentssettled = 0;
let revealObserver = null;
let sectionObserver = null;
let pendingMediaMetadataHandler = null;

function load_components(components) {
  componentsneeded = components.length;

  if (componentsneeded === 0) {
    on_dom_ready(init);
    return;
  }

  components.forEach(function (component) {
    fetchHTML("components/" + component + ".html", component);
  });
}

async function fetchHTML(url, id) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const value = await response.text();
    loadElement(id, value);
  } catch (error) {
    console.error("Komponente konnte nicht geladen werden:", id, error);
    settle_component(id, false);
  }
}

function loadElement(id, html) {
  if (document.readyState === "loading") {
    window.setTimeout(loadElement, 20, id, html);
    return;
  }

  const target = document.getElementById(id);

  if (!target) {
    settle_component(id, false);
    return;
  }

  target.innerHTML = html;
  settle_component(id, true);
}

function settle_component(id, loaded) {
  if (!LOADED[id]) {
    LOADED[id] = {
      init: false,
      settled: false,
      func: function () {}
    };
  }

  if (LOADED[id].settled) {
    return;
  }

  LOADED[id].settled = true;
  LOADED[id].init = loaded;
  componentssettled += 1;

  if (componentssettled >= componentsneeded) {
    on_dom_ready(init);
  }
}

function init() {
  if (SITE_STATE.initStarted) {
    return;
  }

  SITE_STATE.initStarted = true;

  if (typeof pre_init === "function") {
    pre_init();
  }

  Object.keys(LOADED).forEach(function (key) {
    if (LOADED[key].init) {
      LOADED[key].func();
    }
  });

  init_content_scroll();
  init_reveals();
  init_section_navigation();

  if (typeof post_init === "function") {
    post_init();
  }

  update_header_height();
  show_body();
}

function init_header() {
  const toggle = document.getElementById("menu-toggle");
  const navigation = document.getElementById("site-navigation");
  const headerbox = document.getElementById("headerbox");

  if (toggle && navigation) {
    toggle.addEventListener("click", function () {
      toggle_menu(!SITE_STATE.menuOpen);
    });

    navigation.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle_menu(false);
      });
    });
  }

  if (headerbox && "ResizeObserver" in window) {
    const headerObserver = new ResizeObserver(update_header_height);
    headerObserver.observe(headerbox);
  }

  window.addEventListener("resize", function () {
    update_header_height();
    if (SITE_STATE.menuOpen && !window.matchMedia("(max-width: 800px)").matches) {
      toggle_menu(false);
    }
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && SITE_STATE.menuOpen) {
      toggle_menu(false);
      if (toggle) {
        toggle.focus();
      }
    }
  });

  update_header_height();
}

function toggle_menu(open) {
  const header = document.getElementById("header");
  const toggle = document.getElementById("menu-toggle");
  const navigation = document.getElementById("site-navigation");

  SITE_STATE.menuOpen = Boolean(open);

  if (header) {
    header.classList.toggle("menu-open", SITE_STATE.menuOpen);
  }

  if (navigation) {
    navigation.classList.toggle("is-open", SITE_STATE.menuOpen);
  }

  if (toggle) {
    toggle.setAttribute("aria-expanded", String(SITE_STATE.menuOpen));
    const label = toggle.querySelector(".menu-toggle__label");
    if (label) {
      label.textContent = SITE_STATE.menuOpen ? "Schließen" : "Menü";
    }
  }
}

function update_header_height() {
  const headerbox = document.getElementById("headerbox");

  if (headerbox) {
    document.documentElement.style.setProperty("--header-box-height", headerbox.offsetHeight + "px");
  }
}

function init_footer() {
  const year = document.getElementById("current-year");
  const topButton = document.getElementById("to-top");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  if (topButton) {
    topButton.addEventListener("click", function () {
      const content = document.getElementById("content");
      if (content) {
        content.scrollTo({
          top: 0,
          behavior: prefers_reduced_motion() ? "auto" : "smooth"
        });
        content.focus({ preventScroll: true });
      }
    });
  }
}

function init_content_scroll() {
  const content = document.getElementById("content");

  if (!content) {
    return;
  }

  content.addEventListener("scroll", update_scroll_state, { passive: true });
  update_scroll_state();
}

function update_scroll_state() {
  const content = document.getElementById("content");
  const header = document.getElementById("header");
  const topButton = document.getElementById("to-top");
  const progress = document.getElementById("scroll-progress-bar");

  if (!content) {
    return;
  }

  const scrollable = Math.max(content.scrollHeight - content.clientHeight, 1);
  const ratio = Math.min(content.scrollTop / scrollable, 1);

  if (progress) {
    progress.style.transform = "scaleX(" + ratio + ")";
  }

  if (header) {
    header.classList.toggle("is-scrolled", content.scrollTop > 24);
  }

  if (topButton) {
    topButton.classList.toggle("is-visible", content.scrollTop > content.clientHeight * 0.75);
  }
}

function init_reveals() {
  const elements = document.querySelectorAll("[data-reveal]");

  if (!elements.length) {
    return;
  }

  if (prefers_reduced_motion() || !("IntersectionObserver" in window)) {
    elements.forEach(function (element) {
      element.classList.add("is-visible");
    });
    return;
  }

  revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    root: document.getElementById("content"),
    threshold: 0.12
  });

  elements.forEach(function (element) {
    revealObserver.observe(element);
  });
}

function init_section_navigation() {
  const content = document.getElementById("content");
  const sections = document.querySelectorAll("[data-nav-section]");

  if (!content || !sections.length || !("IntersectionObserver" in window)) {
    return;
  }

  sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        set_active_navigation(entry.target.id);
      }
    });
  }, {
    root: content,
    rootMargin: "-28% 0px -58% 0px",
    threshold: 0
  });

  sections.forEach(function (section) {
    sectionObserver.observe(section);
  });
}

function set_active_navigation(id) {
  document.querySelectorAll(".site-navigation a").forEach(function (link) {
    const href = link.getAttribute("href") || "";
    const active = href.endsWith("#" + id);
    link.classList.toggle("is-active", active);

    if (active) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function init_video_showcase() {
  if (typeof MEDIA_LIST === "undefined" || !MEDIA_LIST.length) {
    return;
  }

  const player = document.getElementById("session-player");
  const buttons = document.querySelectorAll("[data-media-index]");
  const storedIndex = Number(storage_get("triolemaitre_media_index", "0"));
  const storedVolume = Number(storage_get("triolemaitre_media_volume", "0.85"));

  if (!player) {
    return;
  }

  player.volume = Number.isFinite(storedVolume) ? Math.min(Math.max(storedVolume, 0), 1) : 0.85;

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.getAttribute("data-media-index"));
      select_media(index, true);
    });
  });

  player.addEventListener("volumechange", function () {
    storage_set("triolemaitre_media_volume", String(player.volume));
  });

  window.addEventListener("beforeunload", save_media_position);

  const initialIndex = Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < MEDIA_LIST.length ? storedIndex : 0;
  select_media(initialIndex, false);
}

function select_media(index, shouldPlay) {
  if (typeof MEDIA_LIST === "undefined" || !MEDIA_LIST[index]) {
    return;
  }

  const player = document.getElementById("session-player");
  const source = player ? player.querySelector("source") : null;
  const title = document.getElementById("session-title");
  const counter = document.getElementById("session-counter");
  const item = MEDIA_LIST[index];

  if (!player || !source) {
    return;
  }

  if (pendingMediaMetadataHandler) {
    player.removeEventListener("loadedmetadata", pendingMediaMetadataHandler);
    pendingMediaMetadataHandler = null;
  }

  save_media_position();
  SITE_STATE.currentMedia = index;
  storage_set("triolemaitre_media_index", String(index));

  function restorePosition() {
    pendingMediaMetadataHandler = null;
    if (SITE_STATE.currentMedia !== index) {
      return;
    }

    const saved = Number(storage_get("triolemaitre_media_time_" + index, "0"));
    if (Number.isFinite(saved) && saved > 0 && saved < player.duration - 2) {
      player.currentTime = saved;
    }
  }

  if (source.getAttribute("src") !== item.src) {
    player.pause();
    source.setAttribute("src", item.src);
    pendingMediaMetadataHandler = restorePosition;
    player.addEventListener("loadedmetadata", pendingMediaMetadataHandler, { once: true });
    player.load();

    if (shouldPlay) {
      player.play().catch(function () {});
    }
  } else {
    if (player.readyState >= 1) {
      restorePosition();
    } else {
      pendingMediaMetadataHandler = restorePosition;
      player.addEventListener("loadedmetadata", pendingMediaMetadataHandler, { once: true });
    }

    if (shouldPlay) {
      player.play().catch(function () {});
    }
  }

  if (title) {
    title.textContent = item.title;
  }

  player.setAttribute("aria-label", "Live Session: " + item.title);

  if (counter) {
    counter.textContent = pad_number(index + 1) + " / " + pad_number(MEDIA_LIST.length);
  }

  document.querySelectorAll("[data-media-index]").forEach(function (button) {
    const active = Number(button.getAttribute("data-media-index")) === index;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function save_media_position() {
  const player = document.getElementById("session-player");

  if (player && Number.isFinite(player.currentTime) && player.currentTime > 0) {
    storage_set("triolemaitre_media_time_" + SITE_STATE.currentMedia, String(player.currentTime));
  }
}

function storage_get(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function storage_set(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    return;
  }
}

function pad_number(number) {
  return String(number).padStart(2, "0");
}

function prefers_reduced_motion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function show_body() {
  document.body.classList.remove("is-loading");
  document.body.classList.add("is-ready");
}

function on_dom_ready(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}
