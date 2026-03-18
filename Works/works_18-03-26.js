const els = {};

function initDomRefs() {
    els.html = document.documentElement;
    
    els.hamburgerBtn = document.getElementById('hamburgerToggle');
    els.leftPanel = document.querySelector('.worksLeft');
    els.leftBg = document.querySelector('.leftPanelBg');
    els.homeIcon = document.getElementById('homeIcon');

    els.topBar = document.querySelector('.topBar');
    els.titleSeparator = document.querySelector('.projectTitleSeparator');
    els.titleEl = document.getElementById("projectTitle");
}

let allProjects;
let allCategories = [];
let currentProjectId = null;
let currentCategoryId = null;

let modalCategoryList = [];
let modalScopeList = [];
let modalScopeIndex = 0;
let __modalAnimating = false;

let slideshowTimer = null;
let slideshowAbort = null;

function renderProject(project) {
    renderTitle(project);

    const mount = document.getElementById("projectMain");
    if (!mount) return;
    mount.replaceChildren();

    const frag = document.createDocumentFragment();

    (project.layout ?? []).forEach(block => {
        if (!block || !block.type) return;

        if (block.type === "separator") {
            frag.appendChild(buildSeparator());
            return;
        }

        if (block.type === "text") {
            const section = buildTextBlockFromContent(project, block.source);
            if (section) frag.appendChild(section);
            return;
        }

        if (block.type === "video") {
            const section = buildVideoBlockFromContent(project, block.source);
            if (section) frag.appendChild(section);
            return;
        }

        if (block.type === "grid") {
            const items = getBlockItems(project, block);
            const section = buildImageGridBlock({
                items,
                show: items.length > 0,
                variant: block.variant ?? "multi",
                projectTitle: project.title,
                withSeparator: false
            });
            if (section) frag.appendChild(section);
            return;
        }

        if (block.type === "slideshow") {
            const items = getBlockItems(project, block);
            const slideshow = buildSlideshowBlock(project, items, block);
            if (slideshow) {
                frag.appendChild(slideshow.fragment);
                queueMicrotask(() => initSlideshow(slideshow));
            }
        }
    });

    mount.replaceChildren(frag);
}

function getBlockItems(project, block) {
    const raw = project?.content?.[block.source];
    const items = Array.isArray(raw) ? raw : [];
    return items
        .filter(item => item?.src)
        .map(item => ({
            ...item,
            kind: "image",
            modalCaptionMode: block.captionmode ?? "separate"
        }));
}

function renderTitle(project) {
    els.titleEl.textContent = `${project.title} (${project.date})`;
    requestAnimationFrame(syncTopBarFade);
}

//==========Slideshow Rendering==========
function buildSlideshowBlock(project, items, block = {}) {
    const show = items.length > 0;
    if (!show) return null;

    const section = document.createElement("section");
    section.className = "slideshowContainer";
    section.classList.toggle("slideshow--single", (block.variant ?? "multi") === "single");

    const prevBtn = document.createElement("button");
    prevBtn.className = "slideArrow slideArrowLeft";
    prevBtn.type = "button";
    prevBtn.innerHTML = "❮";

    const nextBtn = document.createElement("button");
    nextBtn.className = "slideArrow slideArrowRight";
    nextBtn.type = "button";
    nextBtn.innerHTML = "❯";

    const track = document.createElement("div");
    track.className = "slidesTrack";

    items.forEach((item, i) => {
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = item.title ?? project.title ?? "";
        track.appendChild(img);
    });

    section.appendChild(prevBtn);
    section.appendChild(track);
    section.appendChild(nextBtn);

    const dots = document.createElement("div");
    dots.className = "slideshowDots";

    const frag = document.createDocumentFragment();
    frag.appendChild(section);
    frag.appendChild(dots);

    return { fragment: frag, section, track, prevBtn, nextBtn, dots, total: items.length, items };
}

//==========Images Rendering==========
function buildImageGridBlock({ items, show, modalIndexBase, variant, projectTitle, withSeparator }) {
    const okItems = Array.isArray(items) && items.length > 0;
    if (!show || !okItems) return null;

    const section = document.createElement("section");
    section.className = "imageGrid";

    const grid = document.createElement("div");
    grid.className = "imageGridImages";
    section.appendChild(grid);

    renderImageGrid({
        sectionEl: section,
        separatorEl: null,
        gridEl: grid,
        items,
        show: true,
        modalIndexBase,
        variant,
        projectTitle
    });

    if (!withSeparator) return section;

    const frag = document.createDocumentFragment();
    frag.appendChild(buildSeparator());
    frag.appendChild(section);
    return frag;
}

function renderImageGrid({
    sectionEl,
    separatorEl,
    gridEl,
    items,
    show,
    modalIndexBase = 0,
    variant = "multi",
    projectTitle = ""
}) {
    if (!sectionEl || !gridEl) return;

    sectionEl.hidden = !show;
    if (separatorEl) separatorEl.hidden = !show;

    // clear
    gridEl.innerHTML = "";
    if (!show) return;

    sectionEl.classList.toggle("is-single", variant === "single");
    sectionEl.classList.toggle("is-multi", variant !== "single");

    // render
    items.forEach((item, i) => {
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = item.label ?? item.title ?? projectTitle;

        wireModal(img, items, i);
        gridEl.appendChild(img);
    });
}

//==========Text Rendering==========
function buildTextBlockFromContent(project, sourceKey) {
    const section = document.createElement("section");
    section.className = "projectText";
    renderTextChunk({ [sourceKey]: project?.content?.[sourceKey] }, sourceKey, section);
    return section.hidden ? null : section;
}

function renderTextChunk(project, key, mountEl) {
    if (!mountEl) return;
    const raw = project?.[key];
    const paras = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    mountEl.innerHTML = "";
    paras
        .map(s => String(s ?? "").trim())
        .filter(Boolean)
        .forEach(par => {
            const p = document.createElement("p");
            p.textContent = par;
            mountEl.appendChild(p);
        });
    mountEl.hidden = mountEl.childElementCount === 0;
}

//==========Video rendering==========
function buildVideoBlockFromContent(project, sourceKey) {
    const video = project?.content?.[sourceKey];
    if (!video) return null;

    const proxyProject = {
        show_video: "yes",
        video_host: video.host,
        video_link: video.link
    };

    return buildVideoBlock(proxyProject);
}

function buildVideoBlock(project) {
    if (!isYes(project.show_video)) return null;

    const host = String(project.video_host ?? "").trim();
    if (host !== "YT" && host !== "Vimeo") return null;

    const embedUrl =
        host === "YT" ? toYouTubeEmbedUrl(project.video_link)
            : toVimeoEmbedUrl(project.video_link);

    if (!embedUrl) return null;

    const section = document.createElement("section");
    section.className = "videoInlay";
    section.id = "videoInlay";

    const inner = document.createElement("div");
    inner.className = "videoInlayInner";
    section.appendChild(inner);

    const iframe = document.createElement("iframe");
    iframe.title = "Project video";
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;
    iframe.src = embedUrl;

    if (host === "YT") {
        iframe.id = "projectYTiframe"; // optional
        iframe.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    } else {
        iframe.id = "projectVimeoiframe"; // optional
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow = "fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share";
    }

    inner.appendChild(iframe);
    return section;
}

//==========Inline Images Rendering==========
function buildSingleModalImageGridBlock({ item, show, variant = "single", projectTitle = "", withSeparator = false }) {
    if (!show || !item?.src) return null;

    const section = document.createElement("section");
    section.className = "imageGrid";
    section.classList.add("imageGrid--inline");

    const grid = document.createElement("div");
    grid.className = "imageGridImages";
    section.appendChild(grid);

    // reuse your styling toggles
    section.classList.toggle("is-single", variant === "single");
    section.classList.toggle("is-multi", variant !== "single");

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.label ?? item.title ?? projectTitle ?? "";

    img.draggable = false;
    img.addEventListener("dragstart", (e) => e.preventDefault());
    img.addEventListener("click", () => openSingleImageModal(item));

    grid.appendChild(img);

    if (!withSeparator) return section;

    const frag = document.createDocumentFragment();
    frag.appendChild(buildSeparator());
    frag.appendChild(section);
    return frag;
}

//==========Separators Rendering==========
function buildSeparator() {
    const sep = document.createElement("div");
    sep.className = "projectSeparator";
    return sep;
}

//==========Category Pages==========

async function loadCategories() {
    const res = await fetch("categories.json");
    return await res.json();
}

function renderCategoryPage(category) {
    els.titleEl.textContent = `${category.title}`;
    requestAnimationFrame(syncTopBarFade);

    const mount = document.getElementById("projectMain");
    if (!mount) return;

    modalCategoryList = (category.items ?? [])
        .filter(x => x && x.src)
        .map(x => ({ kind: "category", ...x }));
    const frag = document.createDocumentFragment();
    (category.items ?? []).forEach(item => {
        const unit = buildCategoryUnit(item);
        if (unit) frag.appendChild(unit);
    });

    mount.replaceChildren(frag);
}

//==========Category page units==========
function buildCategoryUnit(item) {
    if (!item) return null;

    const section = document.createElement("section");
    section.className = "categoryUnit";

    // left text
    const left = document.createElement("div");
    left.className = "categoryUnitText";

    const lines = itemLines(item);
    lines.forEach(line => {
        const p = document.createElement("p");
        p.textContent = line;
        left.appendChild(p);
    });

    // right media
    const right = document.createElement("div");
    right.className = "categoryUnitMedia";

    if (item.src) {
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = lines[0] ?? item.label ?? item.title ?? "";
        img.draggable = false;
        img.addEventListener("dragstart", (e) => e.preventDefault());
        img.addEventListener("click", () => {
            modalScopeList = modalCategoryList;
            // Prefer the index if present; fallback to src match
            modalScopeIndex =
                (typeof item._catIndex === "number")
                    ? item._catIndex
                    : modalCategoryList.findIndex(x => x.src === item.src);

            const modal = document.getElementById("imageModal");
            modal.classList.add("is-open");

            const imgEl = document.getElementById("imageModalImg");
            imgEl.style.transform = "translateX(0px)";
            imgEl.style.opacity = "1";

            showModalImageAt(modalScopeIndex);
        });
        right.appendChild(img);
    } else if (item.video_link) {
        const host = String(item.video_host ?? "").trim();
        const embedUrl =
            host === "YT" ? toYouTubeEmbedUrl(item.video_link)
                : host === "Vimeo" ? toVimeoEmbedUrl(item.video_link)
                    : null;

        if (embedUrl) {
            const iframe = document.createElement("iframe");
            iframe.title = item.title ? String(item.title) : "Video";
            iframe.frameBorder = "0";
            iframe.allowFullscreen = true;
            iframe.src = embedUrl;

            // keep parity with your project video rules
            if (host === "YT") {
                iframe.allow =
                    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
            } else {
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
                iframe.allow = "fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share";
            }

            right.appendChild(iframe);
        }
    } else {
        // unknown item type: render only left text
    }

    section.appendChild(left);
    section.appendChild(right);

    const frag = document.createDocumentFragment();
    frag.appendChild(section);
    frag.appendChild(buildSeparator());
    return frag;
}

//==========Modal Images==========
function wireModal(imgEl, scopeList, scopeIndex) {
    imgEl.draggable = false;
    imgEl.addEventListener("dragstart", (e) => e.preventDefault());

    imgEl.addEventListener("click", () => {
        if (window.__slideshowSuppressClick) return;
        openScopedImageModal(scopeList, scopeIndex);
    });
}

// Renders image + caption for a given index (wrap-safe)
function showModalImageAt(index) {
    const total = modalScopeList.length;
    if (!total) return;

    modalScopeIndex = (index + total) % total;
    const item = modalScopeList[modalScopeIndex];

    const imgEl = document.getElementById("imageModalImg");
    const captionEl = document.getElementById("imageModalCaption");
    const modal = document.getElementById("imageModal");

    imgEl.src = item.src;

    if (item.label) {
        captionEl.innerHTML = item.label;
    } else {
        captionEl.innerHTML = [item.title, item.medium, item.size, item.year]
            .filter(Boolean)
            .join("<br>");
    }

    const mode = item.modalCaptionMode ?? "separate";
    modal.classList.toggle("caption-attached", mode === "attached");
    modal.classList.toggle("caption-separate", mode !== "attached");
}

function openSingleImageModal(item) {
    if (!item?.src) return;

    modalScopeList = [{ kind: "single", ...item }];
    modalScopeIndex = 0;

    const modal = document.getElementById("imageModal");
    modal.classList.add("is-open");
    const imgEl = document.getElementById("imageModalImg");
    imgEl.style.transform = "translateX(0px)";
    imgEl.style.opacity = "1";

    showModalImageAt(0);
}

// Opens the modal at a given index
function openScopedImageModal(scopeList, scopeIndex) {
    if (!Array.isArray(scopeList) || !scopeList.length) return;

    modalScopeList = scopeList;
    modalScopeIndex = scopeIndex;

    const modal = document.getElementById("imageModal");
    const imgEl = document.getElementById("imageModalImg");
    imgEl.style.transform = "translateX(0px)";
    imgEl.style.opacity = "1";

    modal.classList.add("is-open");
    showModalImageAt(modalScopeIndex);
}


function animateModalChange(delta) {
    if (!modalScopeList || modalScopeList.length <= 1) return;
    if (__modalAnimating) return;
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("imageModalImg");
    if (!modal || !img || !modal.classList.contains("is-open")) return;

    __modalAnimating = true;

    // delta: +1 = next, -1 = prev
    // next => slide current image to LEFT; prev => slide to RIGHT
    const dir = (delta > 0) ? -1 : 1;
    const off = dir * Math.max(260, window.innerWidth * 0.35);

    // Phase 1: slide + fade OUT current image
    img.classList.remove("is-dragging");
    img.style.transform = `translateX(${off}px)`;
    img.style.opacity = "0";

    const onOutDone = (e) => {
        if (e.propertyName !== "transform") return;
        img.removeEventListener("transitionend", onOutDone);

        // Update index + swap src/caption via existing logic
        showModalImageAt(modalScopeIndex + delta); // your function wraps index [file:350]

        // Phase 2: snap back to center invisibly, then fade IN
        img.style.transition = "none";
        img.style.transform = "translateX(0px)";
        img.style.opacity = "0";

        // force style flush, then restore transition + fade in
        void img.offsetHeight;
        img.style.transition = ""; // back to CSS rule
        requestAnimationFrame(() => {
            img.style.opacity = "1";
            __modalAnimating = false;
        });
    };

    img.addEventListener("transitionend", onOutDone);
}

function showPrevModalImage() { animateModalChange(-1); }
function showNextModalImage() { animateModalChange(1); }


function closeImageModal() {
    const modal = document.getElementById('imageModal');
    const imgEl = document.getElementById('imageModalImg');
    const captionEl = document.getElementById('imageModalCaption');

    modal.classList.remove('is-open', 'caption-attached', 'caption-separate');
    imgEl.src = '';
    captionEl.innerHTML = '';
}

//==========Slideshow scrolling logic==========
function initSlideshow({ section, track, prevBtn, nextBtn, dots, total, items }) {
    if (!section || !track || !dots) return;

    if (section.__slideshowAbort) section.__slideshowAbort.abort();

    const abort = new AbortController();
    section.__slideshowAbort = abort;
    const { signal } = abort;

    const viewport = section;
    const slides = Array.from(track.children);
    if (!slides.length) return;

    const gap = parseFloat(getComputedStyle(track).gap) || 32;
    const states = total;

    let current = 0;
    let offsets = [];
    let dotEls = [];
    let timer = null;

    function measure() {
        const widths = slides.map(slide => slide.getBoundingClientRect().width);
        offsets = [];
        let acc = 0;
        widths.forEach((w, i) => {
            offsets[i] = acc;
            acc += w + gap;
        });
    }

    function setActiveDot(i) {
        dotEls.forEach((dot, idx) => dot.classList.toggle("is-active", idx === i));
    }

    function goToState(i) {
        if (!offsets.length) return;
        current = (i + states) % states;
        track.style.transform = `translateX(${-offsets[current]}px)`;
        setActiveDot(current);
    }

    function stopAuto() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function buildDots() {
        dots.innerHTML = "";
        dotEls = [];

        for (let i = 0; i < states; i++) {
            const dot = document.createElement("span");
            dot.className = "slideshowDot" + (i === 0 ? " is-active" : "");
            dot.addEventListener("click", () => {
                stopAuto();
                goToState(i);
            }, { signal });
            dots.appendChild(dot);
            dotEls.push(dot);
        }
    }

    let suppressClick = false;
    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let startTranslate = 0;
    let activePointerId = null;
    const DRAG_THRESHOLD = 10;

    function getCurrentTranslatePx() {
        const t = getComputedStyle(track).transform;
        if (!t || t === "none") return 0;
        return new DOMMatrixReadOnly(t).m41;
    }

    function setTranslatePx(x) {
        track.style.transform = `translateX(${x}px)`;
    }

    function nearestIndexForTranslate(x) {
        const pos = -x;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < offsets.length; i++) {
            const d = Math.abs(offsets[i] - pos);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        return best;
    }

    slides.forEach((img, i) => {
        img.addEventListener("click", (e) => {
            if (suppressClick) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            openScopedImageModal(items, i);
        }, { signal });
    });

    function onDown(e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;

        isDown = true;
        isDragging = false;
        suppressClick = false;

        activePointerId = e.pointerId;
        startX = e.clientX;
        startTranslate = getCurrentTranslatePx();
    }

    function onMove(e) {
        if (!isDown || e.pointerId !== activePointerId) return;

        const dx = e.clientX - startX;

        if (!isDragging && Math.abs(dx) > DRAG_THRESHOLD) {
            isDragging = true;
            suppressClick = true;

            viewport.classList.add("is-dragging");
            track.classList.add("is-dragging");

            viewport.setPointerCapture(activePointerId);
            stopAuto();
        }

        if (!isDragging) return;

        e.preventDefault();
        setTranslatePx(startTranslate + dx);
    }

    function onUp(e) {
        if (!isDown || e.pointerId !== activePointerId) return;

        isDown = false;

        if (isDragging) {
            const dx = e.clientX - startX;
            const finalX = startTranslate + dx;
            const best = nearestIndexForTranslate(finalX);

            viewport.classList.remove("is-dragging");
            track.classList.remove("is-dragging");

            requestAnimationFrame(() => goToState(best));

            try { viewport.releasePointerCapture(activePointerId); } catch (_) { }
            setTimeout(() => { suppressClick = false; }, 50);
        }

        activePointerId = null;
        isDragging = false;
    }

    viewport.addEventListener("pointerdown", onDown, { signal });
    viewport.addEventListener("pointermove", onMove, { signal, passive: false });
    viewport.addEventListener("pointerup", onUp, { signal });
    viewport.addEventListener("pointercancel", onUp, { signal });

    if (prevBtn) prevBtn.addEventListener("click", () => {
        stopAuto();
        goToState(current - 1);
    }, { signal });

    if (nextBtn) nextBtn.addEventListener("click", () => {
        stopAuto();
        goToState(current + 1);
    }, { signal });

    function setup() {
        measure();
        buildDots();
        goToState(0);
        stopAuto();
        timer = setInterval(() => goToState(current + 1), 5000);
    }

    let loaded = 0;
    slides.forEach(img => {
        if (img.complete) {
            loaded++;
        } else {
            img.addEventListener("load", () => {
                loaded++;
                if (loaded === slides.length) setup();
            }, { signal, once: true });
        }
    });
    if (loaded === slides.length) setup();

    window.addEventListener("resize", () => {
        measure();
        goToState(current);
    }, { signal });
}


function setCurrentProject(id) {
    const project = allProjects.find(p => p.id === id);
    if (!project) return;

    const details = document.querySelector('.projectDetails');
    details?.classList.add('is-fading');

    setTimeout(() => {
        currentProjectId = id;
        currentCategoryId = null;
        renderProject(project);
        updateProjectNavButtons();
        scrollToTopSmooth();

        requestAnimationFrame(() => {
            details?.classList.remove('is-fading');
        });
    }, 250);
}

function setCurrentCategory(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;

    const details = document.querySelector('.projectDetails');
    details?.classList.add('is-fading');

    setTimeout(() => {
        currentCategoryId = id;
        currentProjectId = null;
        renderCategoryPage(category);
        updateProjectNavButtons();
        scrollToTopSmooth();

        requestAnimationFrame(() => {
            details?.classList.remove('is-fading');
        });
    }, 250);
}


//==========Populate Left Panel==========
function populateProjectMenu(projects) {
    const menu = document.getElementById("projectMenu");
    if (!menu) return;

    menu.innerHTML = "";

    projects.forEach(project => {
        const link = document.createElement("a");
        link.href = `?id=${project.id}`;
        link.textContent = project.title;
        link.className = "projectLink";
        link.dataset.id = project.id;

        link.addEventListener("click", (e) => {
            e.preventDefault();
            closeLeftPanel?.();
            setRoute({ id: project.id }, { replace: false });
            handleRouteChange();
        });

        menu.appendChild(link);
    });
}

function populateCategoryMenu(categories) {
    const menu = document.getElementById("categoryMenu");
    if (!menu) return;

    menu.innerHTML = "";

    categories.forEach(cat => {
        const link = document.createElement("a");
        link.href = `?category=${encodeURIComponent(cat.id)}`;
        link.textContent = cat.title;
        link.className = "categoryLink";
        link.dataset.category = cat.id;

        link.addEventListener("click", (e) => {
            e.preventDefault();
            closeLeftPanel?.();
            setRoute({ category: cat.id }, { replace: false });
            handleRouteChange();
        });

        menu.appendChild(link);
    });
}


//==========Intro Left Panel==========
function runMenuIntro() {
    openLeftPanel();

    let timer = setTimeout(() => {
        closeLeftPanel();
    }, 4000); // setTimeout returns an id you can clear later [web:419]

    const cancel = () => {
        clearTimeout(timer);
        timer = null;
        els.hamburgerBtn?.removeEventListener("pointerdown", cancel);
        els.leftPanel?.removeEventListener("pointerdown", cancel);
    };

    els.hamburgerBtn?.addEventListener("pointerdown", cancel, { once: true });
    els.leftPanel?.addEventListener("pointerdown", cancel, { once: true });
}

//==========Project Navigation==========
function goToAdjacentProject(delta) {
    if (!Array.isArray(allProjects) || !allProjects.length || !currentProjectId) return;

    const idx = allProjects.findIndex(p => p.id === currentProjectId);
    if (idx === -1) return;

    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= allProjects.length) return; // no wrap

    closeLeftPanel?.();

    const nextId = allProjects[nextIdx].id;

    // router-driven navigation (updates URL + highlight)
    setRoute({ id: nextId }, { replace: false });
    handleRouteChange();
}

function goToAdjacentItem(delta) {
    if (delta !== 1 && delta !== -1) return;

    const { category, id } = getRoute();

    if (id && Array.isArray(allProjects) && allProjects.length) {
        const idx = allProjects.findIndex(p => p.id === id);
        if (idx === -1) return;

        const nextIdx = (idx + delta + allProjects.length) % allProjects.length;
        const nextId = allProjects[nextIdx].id;

        closeLeftPanel?.();
        setRoute({ id: nextId }, { replace: false });
        handleRouteChange();
        return;
    }

    if (category && Array.isArray(allCategories) && allCategories.length) {
        const idx = allCategories.findIndex(c => c.id === category);
        if (idx === -1) return;

        const nextIdx = (idx + delta + allCategories.length) % allCategories.length;
        const nextCategory = allCategories[nextIdx].id;

        closeLeftPanel?.();
        setRoute({ category: nextCategory }, { replace: false });
        handleRouteChange();
    }
}

function updateProjectNavButtons() {
    const prevBtn = document.getElementById("projectPrevProject");
    const nextBtn = document.getElementById("projectNextProject");
    if (!prevBtn || !nextBtn) return;

    const { category, id } = getRoute();

    if (id) {
        const enabled = Array.isArray(allProjects) && allProjects.length > 1;
        prevBtn.disabled = !enabled;
        nextBtn.disabled = !enabled;
        return;
    }

    if (category) {
        const enabled = Array.isArray(allCategories) && allCategories.length > 1;
        prevBtn.disabled = !enabled;
        nextBtn.disabled = !enabled;
        return;
    }

    prevBtn.disabled = true;
    nextBtn.disabled = true;
}


//========== Helper functions ==========

function toYouTubeEmbedUrl(url) {
    if (!url) return null;

    if (Array.isArray(url)) url = url[0];
    if (typeof url !== "string") return null;

    const m =
        url.match(/youtu\.be\/([^?&#/]+)/) ||
        url.match(/[?&]v=([^?&#/]+)/) ||
        url.match(/youtube\.com\/embed\/([^?&#/]+)/) ||
        url.match(/youtube\.com\/shorts\/([^?&#/]+)/);

    const id = m?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
}

function toVimeoEmbedUrl(url) {
    if (!url) return null;
    if (Array.isArray(url)) url = url[0];
    if (typeof url !== "string") return null;

    url = url.trim();
    const m =
        url.match(/player\.vimeo\.com\/video\/(\d+)/) ||
        url.match(/vimeo\.com\/(?:.*\/)?(\d+)(?:$|[/?#])/);

    const id = m?.[1];
    if (!id) return null;
    const hashMatch = url.match(/vimeo\.com\/(?:.*\/)?\d+\/([A-Za-z0-9]+)/);
    const h = hashMatch?.[1];

    return h
        ? `https://player.vimeo.com/video/${id}?h=${encodeURIComponent(h)}`
        : `https://player.vimeo.com/video/${id}`;
}

let scrollTopFixTimer = null;

function scrollToTopSmooth() {
    if (scrollTopFixTimer) {
        clearTimeout(scrollTopFixTimer);
        scrollTopFixTimer = null;
    }

    const kick = () => window.scrollTo({ top: 0, left: 0, behavior: "smooth" });

    kick();

    requestAnimationFrame(() => {
        kick();

        requestAnimationFrame(() => {
            kick();
        });
    });

    scrollTopFixTimer = setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        scrollTopFixTimer = null;
    }, 450);
}


function toggleLeftPanel() {
    if (!els.hamburgerBtn || !els.leftPanel) return;
    els.leftPanel.classList.toggle('closed');
    els.hamburgerBtn.classList.toggle('open');
    const isOpen = !els.leftPanel.classList.contains('closed');
    if (els.leftBg) els.leftBg.classList.toggle('is-visible', isOpen);
    if (els.homeIcon) els.homeIcon.hidden = !isOpen;   // visible only when open
}

function closeLeftPanel() {
    if (!els.hamburgerBtn || !els.leftPanel) return;
    els.leftPanel.classList.add('closed');
    els.hamburgerBtn.classList.remove('open');
    if (els.leftBg) els.leftBg.classList.remove('is-visible');
    if (els.homeIcon) els.homeIcon.hidden = true;
}

function openLeftPanel() {
    if (!els.hamburgerBtn || !els.leftPanel) return;
    els.leftPanel.classList.remove('closed');
    els.hamburgerBtn.classList.add('open');
    if (els.leftBg) els.leftBg.classList.add('is-visible');
    if (els.homeIcon) els.homeIcon.hidden = false;
    syncLeftPanelBgWidth()
}

function syncLeftPanelBgWidth() {
    if (!els.leftPanel || !els.leftBg) return;
    const panelW = Math.round(els.leftPanel.getBoundingClientRect().width);
    const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const isMobile = vw <= 900; // match your CSS breakpoint
    const w = isMobile ? 1000 : panelW;
    els.leftBg.style.setProperty('--panel-w', `${w}px`);
}

function syncLeftPanelActiveLinks() {
    const { category, id } = getRoute();

    document.querySelectorAll(".projectLink").forEach(a => {
        a.classList.toggle("is-active", !!id && a.dataset.id === id);
    });

    document.querySelectorAll(".categoryLink").forEach(a => {
        a.classList.toggle("is-active", !!category && a.dataset.category === category);
    });
}

function syncTopBarFade() {
    if (!els.titleSeparator || !els.topBar) return;
    const fadeStartPx = Math.round(els.titleSeparator.getBoundingClientRect().bottom);
    const extraSolidPadding = 8;
    els.topBar.style.setProperty('--panel-h', `${Math.ceil(fadeStartPx + extraSolidPadding)}px`);
}

function isYes(v) {
    return String(v ?? "").trim().toLowerCase() === "yes";
}

function toLines(value) {
    if (Array.isArray(value)) return value.map(v => String(v ?? "").trim()).filter(Boolean);
    if (value == null) return [];
    const s = String(value).trim();
    return s ? [s] : [];
}

function itemLines(item) {
    // images
    if ("src" in item) {
        return [item.title, item.medium, item.size, item.year, item.label]
            .map(v => String(v ?? "").trim())
            .filter(Boolean);
    }
    // videos
    if ("video_link" in item) {
        return [item.title, item.date]
            .map(v => String(v ?? "").trim())
            .filter(Boolean);
    }
    return [];
}

function getRoute() {
    const params = new URLSearchParams(window.location.search);
    return {
        category: params.get("category"),
        id: params.get("id"),
        intro: params.get("intro"),
    };
}

function setRoute({ id = null, category = null, intro = null }, { replace = false } = {}) {
    const url = new URL(window.location.href);

    // mutually exclusive main routes
    if (id) {
        url.searchParams.set("id", id);
        url.searchParams.delete("category");
    } else if (category) {
        url.searchParams.set("category", category);
        url.searchParams.delete("id");
    } else {
        url.searchParams.delete("id");
        url.searchParams.delete("category");
    }

    // intro is one-shot; default is delete
    if (intro === "1") url.searchParams.set("intro", "1");
    else url.searchParams.delete("intro");

    if (replace) window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);
}

function handleRouteChange({ replace = false } = {}) {
    const { category, id, intro } = getRoute();
    // consume intro once (remove from URL, then run intro UI)
    if (intro === "1") {
        setRoute({ id, category, intro: null }, { replace: true });
        runMenuIntro();
    }

    if (category) {
        const catObj = allCategories.find(c => c.id === category);
        if (catObj) setCurrentCategory(catObj.id);
        syncLeftPanelActiveLinks();
        return;
    }


    // project route
    const proj = allProjects.find(p => p.id === id) || allProjects[0];
    if (proj) setCurrentProject(proj.id);
    syncLeftPanelActiveLinks();

}


//==========Event Listeners==========
window.addEventListener("resize", syncTopBarFade);
window.addEventListener("resize", syncLeftPanelBgWidth);

window.addEventListener("popstate", () => {
    handleRouteChange();
});

document.addEventListener('DOMContentLoaded', async () => {

    initDomRefs();

    if (els.hamburgerBtn) {
        els.hamburgerBtn.addEventListener('click', toggleLeftPanel);
    }
    document.addEventListener('click', (e) => {
        if (els.hamburgerBtn && els.leftPanel && !els.leftPanel.contains(e.target) && !els.hamburgerBtn.contains(e.target) && !els.leftPanel.classList.contains('closed')) {
            toggleLeftPanel();
        }
    });

    const prevBtn = document.getElementById("projectPrevProject");
    const nextBtn = document.getElementById("projectNextProject");

    if (prevBtn) prevBtn.addEventListener("click", () => goToAdjacentItem(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => goToAdjacentItem(1));

    const modal = document.getElementById('imageModal');
    const swipeEl = document.getElementById("imageModalImg");
    const closeBtn = document.querySelector('.imageModalClose');
    const backdrop = document.querySelector('.imageModalBackdrop');
    const leftArrow = document.querySelector('.modalArrowLeft');
    const rightArrow = document.querySelector('.modalArrowRight');
    if (closeBtn) closeBtn.addEventListener('click', closeImageModal);
    if (backdrop) backdrop.addEventListener('click', closeImageModal);
    if (leftArrow) leftArrow.addEventListener('click', showPrevModalImage);
    if (rightArrow) rightArrow.addEventListener('click', showNextModalImage);
    swipeEl.draggable = false;
    swipeEl.addEventListener("dragstart", (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImageModal();
        if (e.key === 'ArrowLeft') showPrevModalImage();
        if (e.key === 'ArrowRight') showNextModalImage();
    });

    //Modal swipe drag
    if (modal && swipeEl) {
        let isDown = false;
        let startX = 0;
        let pointerId = null;

        const SWIPE_PX = 80;           // trigger next/prev
        const MAX_PULL = 500;          // limit how far it follows
        const OFFSCREEN = () => Math.max(240, window.innerWidth * 0.35);

        const setX = (x) => { swipeEl.style.transform = `translateX(${x}px)`; };
        const setFade = (x) => { swipeEl.style.opacity = String(1 - Math.min(0.35, Math.abs(x) / 700)); };

        // Make sure native drag is disabled (you already did this)
        swipeEl.draggable = false;
        swipeEl.addEventListener("dragstart", (e) => e.preventDefault());

        swipeEl.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (!modal.classList.contains("is-open")) return;

            isDown = true;
            pointerId = e.pointerId;
            startX = e.clientX;

            swipeEl.classList.add("is-dragging");
            try { swipeEl.setPointerCapture(pointerId); } catch (_) { }
        });

        swipeEl.addEventListener("pointermove", (e) => {
            if (!isDown || e.pointerId !== pointerId) return;

            const dx = e.clientX - startX;
            const clamped = Math.max(-MAX_PULL, Math.min(MAX_PULL, dx));

            setX(clamped);
            setFade(clamped);
            e.preventDefault();
        }, { passive: false });

        function finish(e) {
            if (!isDown || e.pointerId !== pointerId) return;

            isDown = false;
            try { swipeEl.releasePointerCapture(pointerId); } catch (_) { }
            pointerId = null;

            // compute current dx from transform-less state (use last pointer position)
            const dx = e.clientX - startX;

            if (!modalScopeList || modalScopeList.length <= 1) {
                swipeEl.classList.remove("is-dragging");
                swipeEl.style.transform = "translateX(0px)";
                swipeEl.style.opacity = "1";
                return;
            }

            swipeEl.classList.remove("is-dragging"); // re-enable CSS transition

            // Snap decision
            if (dx > SWIPE_PX) {
                setX(OFFSCREEN());
                setFade(OFFSCREEN());
                setTimeout(() => {
                    //swipeEl.style.transform = "translateX(5000px)";
                    showPrevModalImage();
                }, 10);

            } else if (dx < -SWIPE_PX) {
                setX(-OFFSCREEN());
                setFade(-OFFSCREEN());
                setTimeout(() => {
                    //swipeEl.style.transform = "translateX(-5000px)";
                    showNextModalImage();
                }, 10);

            } else {
                // Not far enough: animate back to center
                swipeEl.style.transform = "translateX(0px)";
                swipeEl.style.opacity = "1";
            }
        }

        swipeEl.addEventListener("pointerup", finish);
        swipeEl.addEventListener("pointercancel", finish);
    }

    const [categories, projects] = await Promise.all([
        loadCategories(),
        fetch("projects_v2.json").then(r => {
            if (!r.ok) throw new Error(`projects_v2.json HTTP ${r.status}`);
            return r.json();
        })
    ]);

    allCategories = categories;
    allProjects = projects;
    populateCategoryMenu(allCategories);
    populateProjectMenu(allProjects);

    handleRouteChange({ replace: true });

});