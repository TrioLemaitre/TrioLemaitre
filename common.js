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
  let value;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    value = await response.text();
  } catch (error) {
    console.error("Komponente konnte nicht geladen werden:", id, error);
    settle_component(id, false);
    return;
  }
  loadElement(id, value);
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
  init_custom_cursor();
  init_hero_spotlight();
  init_reveals();
  init_section_navigation();
  init_booking_form();

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
  const hero = document.querySelector(".hero");
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

  let threshold = content.clientHeight * 0.75;
  const isHomePage = document.body.classList.contains("home");
  if (isHomePage && hero) {
    threshold = hero.offsetHeight;
  }

  const showWidgets = content.scrollTop >= threshold;

  if (header) {
    header.classList.toggle("is-scrolled", content.scrollTop > 24);
    if (isHomePage && hero) {
      header.classList.toggle("is-visible", showWidgets);
    }
  }

  if (topButton) {
    topButton.classList.toggle("is-visible", showWidgets);
  }
}

function init_hero_spotlight() {
  const hero = document.querySelector(".hero");
  const content = document.getElementById("content");
  const portrait = document.querySelector(".hero-portrait");

  if (!hero || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };

  function set_spotlight() {
    const bounds = hero.getBoundingClientRect();
    const x = ((pointer.x - bounds.left) / bounds.width) * 100;
    const y = ((pointer.y - bounds.top) / bounds.height) * 100;

    hero.style.setProperty("--spotlight-x", x + "%");
    hero.style.setProperty("--spotlight-y", y + "%");
    hero.style.setProperty("--spotlight-size", "clamp(8rem, 15vw, 15rem)");

    if (portrait) {
      portrait.classList.add("has-spotlight");
      const pBounds = portrait.getBoundingClientRect();
      const px = ((pointer.x - pBounds.left) / pBounds.width) * 100;
      const py = ((pointer.y - pBounds.top) / pBounds.height) * 100;
      portrait.style.setProperty("--spotlight-x", px + "%");
      portrait.style.setProperty("--spotlight-y", py + "%");
    }
  }

  function sync_spotlight() {
    set_spotlight();
  }

  document.addEventListener("pointermove", function (event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    sync_spotlight();
  }, { passive: true });

  if (content) {
    content.addEventListener("scroll", sync_spotlight, { passive: true });
  }

  window.addEventListener("resize", sync_spotlight, { passive: true });
  sync_spotlight();
}

function init_custom_cursor() {
  const supportsCustomCursor = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (!supportsCustomCursor.matches) {
    return;
  }

  const cursor = document.createElement("div");
  const root = document.documentElement;
  const textSelector = "p, h1, h2, h3, h4, h5, h6, blockquote, li, dt, dd, figcaption, .eyebrow, .hero-kicker";
  let pendingFrame = null;
  let pointerX = -100;
  let pointerY = -100;

  cursor.className = "custom-cursor";
  cursor.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursor);
  root.classList.add("has-custom-cursor");

  function updateCursor() {
    cursor.style.setProperty("--cursor-x", pointerX + "px");
    cursor.style.setProperty("--cursor-y", pointerY + "px");
    cursor.classList.add("is-visible");
    pendingFrame = null;
  }

  function setCursorType(target) {
    if (!(target instanceof Element)) {
      return;
    }

    const overInteractive = target.closest("a, button, input, textarea, select, label, [role='button']");
    const overText = target.closest(textSelector);
    cursor.classList.toggle("is-text", Boolean(overText) && !overInteractive);
    cursor.classList.toggle("is-hover", Boolean(overInteractive));
  }

  document.addEventListener("pointermove", function (event) {
    if (event.pointerType !== "mouse") {
      return;
    }

    pointerX = event.clientX;
    pointerY = event.clientY;
    setCursorType(event.target);

    if (pendingFrame === null) {
      pendingFrame = window.requestAnimationFrame(updateCursor);
    }
  }, { passive: true });

  document.addEventListener("pointerover", function (event) {
    setCursorType(event.target);
  }, { passive: true });

  document.addEventListener("mouseout", function (event) {
    if (!event.relatedTarget) {
      cursor.classList.remove("is-visible");
    }
  }, { passive: true });

  window.addEventListener("blur", function () {
    cursor.classList.remove("is-visible");
  });
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
  const storedVolume = Number(storage_get("triolemaitre_media_volume", "0.85"));

  if (!player) {
    return;
  }

  player.volume = Number.isFinite(storedVolume) ? Math.min(Math.max(storedVolume, 0), 1) : 0.85;

  // Custom Video Controls initialization
  const wrapper = player.closest(".video-wrapper");
  const layout = player.closest(".player-layout");
  const progressContainer = layout && (layout.querySelector(".session-track") || layout.querySelector(".progress-container") || layout.querySelector(".video-meta"));
  if (wrapper && wrapper.querySelector(".custom-video-controls") && progressContainer && progressContainer.querySelector(".progress-slider") && progressContainer.querySelector(".progress-track-fill")) {
    const controls = wrapper.querySelector(".custom-video-controls");
    const startButton = wrapper.querySelector(".video-start-button");
    const playPauseBtn = controls.querySelector(".play-pause-btn");
    const playIcon = playPauseBtn.querySelector(".icon-play");
    const pauseIcon = playPauseBtn.querySelector(".icon-pause");
    
    const progressSlider = progressContainer.querySelector(".progress-slider");
    const progressFill = progressContainer.querySelector(".progress-track-fill");
    const fullscreenSlider = controls.querySelector(".fullscreen-progress-slider");
    const fullscreenFill = controls.querySelector(".fullscreen-progress-fill");
    if (fullscreenSlider) fullscreenSlider.addEventListener("input", function () {
      progressSlider.value = fullscreenSlider.value;
      progressSlider.dispatchEvent(new Event("input"));
    });
    if (fullscreenSlider) fullscreenSlider.addEventListener("change", function () {
      progressSlider.value = fullscreenSlider.value;
      progressSlider.dispatchEvent(new Event("change"));
    });
    const currentTimeDisplay = controls.querySelector(".current-time");
    const durationTimeDisplay = controls.querySelector(".duration-time");
    
    const muteBtn = controls.querySelector(".mute-btn");
    const volumeUpIcon = muteBtn.querySelector(".icon-volume-up");
    const volumeOffIcon = muteBtn.querySelector(".icon-volume-off");
    const volumeSlider = controls.querySelector(".volume-slider");
    const volumeFill = controls.querySelector(".volume-track-fill");
    
    const fullscreenBtn = controls.querySelector(".fullscreen-btn");
    const fullscreenEnterIcon = fullscreenBtn.querySelector(".icon-fullscreen-enter");
    const fullscreenExitIcon = fullscreenBtn.querySelector(".icon-fullscreen-exit");

    function formatTime(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    }

    function togglePlay() {
      if (player.paused) {
        player.play().catch(function (err) {
          console.warn("Play failed:", err);
        });
      } else {
        player.pause();
      }
    }

    playPauseBtn.addEventListener("click", togglePlay);
    if (startButton) startButton.addEventListener("click", togglePlay);
    player.addEventListener("click", togglePlay);

    player.addEventListener("play", function () {
      wrapper.classList.add("has-started");
      player.closest(".player-layout").classList.add("has-played");
      showControls();
      playPauseBtn.setAttribute("aria-label", "Pausieren");
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
      resetIdleTimer();
    });

    player.addEventListener("pause", function () {
      playPauseBtn.setAttribute("aria-label", "Abspielen");
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
      showControls();
    });

    player.addEventListener("ended", function () {
      progressSlider.value = 0;
      progressFill.style.width = "0%";
      if (fullscreenSlider) fullscreenSlider.value = "0";
      if (fullscreenFill) fullscreenFill.style.width = "0%";
      currentTimeDisplay.textContent = formatTime(0);
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
      showControls();
    });

    function updateProgress() {
      if (player.duration) {
        const percentage = (player.currentTime / player.duration) * 100;
        progressSlider.value = percentage;
        progressFill.style.width = percentage + "%";
        if (fullscreenSlider) fullscreenSlider.value = percentage;
        if (fullscreenFill) fullscreenFill.style.width = percentage + "%";
      }
      currentTimeDisplay.textContent = formatTime(player.currentTime);
    }

    player.addEventListener("timeupdate", function () {
      if (!isSeeking) {
        updateProgress();
      }
    });

    player.addEventListener("loadedmetadata", function () {
      durationTimeDisplay.textContent = formatTime(player.duration);
      updateProgress();
    });

    let isSeeking = false;
    progressSlider.addEventListener("input", function () {
      isSeeking = true;
      const percentage = Number(progressSlider.value);
      progressFill.style.width = percentage + "%";
      if (fullscreenSlider) fullscreenSlider.value = percentage;
      if (fullscreenFill) fullscreenFill.style.width = percentage + "%";
      if (player.duration) {
        currentTimeDisplay.textContent = formatTime((percentage / 100) * player.duration);
      }
    });

    progressSlider.addEventListener("change", function () {
      const percentage = Number(progressSlider.value);
      if (player.duration) {
        player.currentTime = (percentage / 100) * player.duration;
      }
      isSeeking = false;
      resetIdleTimer();
    });

    function updateVolumeUI() {
      const isMuted = player.muted || player.volume === 0;
      volumeSlider.value = isMuted ? 0 : player.volume;
      volumeFill.style.width = (isMuted ? 0 : player.volume * 100) + "%";
      
      if (isMuted) {
        volumeUpIcon.style.display = "none";
        volumeOffIcon.style.display = "block";
      } else {
        volumeUpIcon.style.display = "block";
        volumeOffIcon.style.display = "none";
      }
    }

    player.addEventListener("volumechange", updateVolumeUI);

    volumeSlider.addEventListener("input", function () {
      player.volume = Number(volumeSlider.value);
      player.muted = false;
    });

    muteBtn.addEventListener("click", function () {
      player.muted = !player.muted;
    });

    // Initialize Volume UI
    updateVolumeUI();

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(function (err) {
          console.warn("Fullscreen failed:", err);
        });
      } else {
        document.exitFullscreen();
      }
    }

    fullscreenBtn.addEventListener("click", toggleFullscreen);
    player.addEventListener("dblclick", toggleFullscreen);

    document.addEventListener("fullscreenchange", function () {
      const isFullscreen = document.fullscreenElement === wrapper;
      fullscreenEnterIcon.style.display = isFullscreen ? "none" : "block";
      fullscreenExitIcon.style.display = isFullscreen ? "block" : "none";
      wrapper.classList.toggle("is-fullscreen", isFullscreen);
      showControls();

      const customCursor = document.querySelector(".custom-cursor");
      if (customCursor) {
        if (isFullscreen) {
          wrapper.appendChild(customCursor);
        } else {
          document.body.appendChild(customCursor);
        }
      }
    });

    // Controls Auto-Hide Logic
    let idleTimeout = null;

    function showControls() {
      if (!wrapper.classList.contains("has-started")) {
        return;
      }
      controls.classList.remove("is-hidden");
      const customCursor = document.querySelector(".custom-cursor");
      if (customCursor) {
        customCursor.classList.remove("is-video-playing-idle");
      }
      resetIdleTimer();
    }

    function hideControls() {
      controls.classList.add("is-hidden");
    }

    function resetIdleTimer() {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      idleTimeout = setTimeout(hideControls, 4000);
    }

    wrapper.addEventListener("mousemove", showControls);
    wrapper.addEventListener("mouseenter", showControls);
    wrapper.addEventListener("pointerdown", showControls);
    wrapper.addEventListener("focusin", showControls);
    wrapper.addEventListener("mouseleave", function () {
      resetIdleTimer();
    });
  } else {
    player.controls = true;
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.getAttribute("data-media-index"));
      select_media(index, true);
    });
  });

  player.addEventListener("volumechange", function () {
    storage_set("triolemaitre_media_volume", String(player.volume));
  });

  select_media(0, false);
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

  SITE_STATE.currentMedia = index;
  storage_set("triolemaitre_media_index", String(index));

  if (shouldPlay) {
    storage_set("triolemaitre_media_time_" + index, "0");
    const fill = document.querySelector(".progress-track-fill");
    if (fill) fill.style.width = "0%";
    const slider = document.querySelector(".progress-slider");
    if (slider) slider.value = "0";
  }

  function restorePosition() {
    pendingMediaMetadataHandler = null;
    if (SITE_STATE.currentMedia !== index) {
      return;
    }

    player.currentTime = 0;
  }

  if (source.getAttribute("src") !== item.src) {
    player.pause();
    player.closest(".video-wrapper").classList.remove("has-started");
    const fill = document.querySelector(".progress-track-fill");
    if (fill) fill.style.width = "0%";
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
    if (active) {
      const track = button.closest(".session-track");
      const layout = button.closest(".player-layout");
      const fill = layout.querySelector(".progress-track-fill");
      const slider = layout.querySelector(".progress-slider");
      if (track && fill && slider) {
        track.appendChild(fill);
        track.appendChild(slider);
      }
    }
    button.setAttribute("aria-pressed", String(active));
  });
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

function init_booking_form() {
  const form = document.getElementById("bookingForm");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const nameInput = document.getElementById("bookingName");
      const emailInput = document.getElementById("bookingEmail");
      const dateInput = document.getElementById("bookingDate");
      const locationInput = document.getElementById("bookingLocation");
      const messageInput = document.getElementById("bookingMessage");
      const acceptPrivacyInput = document.getElementById("bookingAcceptPrivacy");
      const submitBtn = form.querySelector(".btn-booking-submit");

      if (!nameInput.value.trim() || !emailInput.value.trim() || !locationInput.value.trim() || !messageInput.value.trim()) {
        alert("Bitte füllt Name, E-Mail, Ort und Details zum Event aus.");
        return;
      }

      if (!acceptPrivacyInput || !acceptPrivacyInput.checked) {
        alert("Bitte lest die Datenschutzerklärung und bestätigt die Kenntnisnahme.");
        return;
      }

      const submitText = submitBtn.querySelector("span");
      const originalText = submitText ? submitText.textContent : "Anfrage senden";
      if (submitText) {
        submitText.textContent = "Wird gesendet...";
      }
      submitBtn.disabled = true;

      const formData = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        date: dateInput ? dateInput.value.trim() : "",
        location: locationInput.value.trim(),
        message: messageInput.value.trim(),
        privacy_notice_acknowledged: "Ja"
      };

      const honeyInput = form.querySelector('input[name="website"]');
      if (honeyInput && honeyInput.value) {
        formData.website = honeyInput.value;
      }

      fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(formData)
      })
      .then(function (response) {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Form submission failed");
        }
      })
      .then(function (data) {
        const bookingBottom = document.querySelector(".booking-bottom");
        if (bookingBottom) {
          bookingBottom.innerHTML = `
            <div class="booking-success-message" style="border: 1px solid var(--color-ink); padding: 2rem; background: var(--color-paper); color: var(--color-ink); text-align: center; margin-top: 2rem;">
              <h3 style="font-family: Baskervville, serif; font-style: italic; font-size: 1.8rem; margin-top: 0; margin-bottom: 1rem;">Vielen Dank für eure Anfrage!</h3>
              <p style="margin: 0; font-size: 1rem; line-height: 1.6;">Wir haben eure Kontakt-Anfrage erhalten und melden uns so schnell wie möglich bei euch.</p>
            </div>
          `;
        }
      })
      .catch(function (error) {
        console.error("Error submitting booking form:", error);
        alert("Es gab ein Problem beim Senden des Formulars. Bitte versucht es später noch einmal oder wendet euch direkt per Mail an kontakt@trio-lemaitre.de");
        if (submitText) {
          submitText.textContent = originalText;
        }
        submitBtn.disabled = false;
      });
    });
  }
}
