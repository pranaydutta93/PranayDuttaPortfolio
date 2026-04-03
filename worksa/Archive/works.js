let allProjects;
let currentProjectId = null;

let modalImageIndex = 0;
let modalImageList = [];
let modalWorkList = [];
let modalInstList = [];
let modalScopeList = [];
let modalScopeIndex = 0;
let __modalAnimating = false;

let slideshowTimer = null;
let slideshowAbort = null;

function toggleLeftPanel() {
    const hamburgerBtn = document.getElementById('hamburgerToggle');
    const leftPanel = document.querySelector('.worksLeft');
    const leftBg = document.querySelector('.leftPanelBg');
    const homeIcon = document.getElementById('homeIcon');

    if (!hamburgerBtn || !leftPanel) return;

    leftPanel.classList.toggle('closed');
    hamburgerBtn.classList.toggle('open');

    const isOpen = !leftPanel.classList.contains('closed');

    if (leftBg) leftBg.classList.toggle('is-visible', isOpen);
    if (homeIcon) homeIcon.hidden = !isOpen;   // visible only when open
}


const prevBtn = document.getElementById('slidePrev');
const nextBtn = document.getElementById('slideNext');
const hamburgerBtn = document.getElementById('hamburgerToggle');
const leftPanel = document.querySelector('.worksLeft');
const homeIcon = document.getElementById('homeIcon');


function renderProject(project) {
    // 1) Title
    const titleEl = document.getElementById("projectTitle");
    titleEl.textContent = `${project.title} (${project.date})`;
    requestAnimationFrame(syncTopBarFade);

    // 2) Slideshow track
    const slideshowSection = document.getElementById("slideshow");
    const dotsContainer = document.getElementById("slideshowDots");
    const prevBtn = document.getElementById("slidePrev");
    const nextBtn = document.getElementById("slideNext");
    const track = document.getElementById("slidesTrack");
    const showSlideshow = isYes(project.show_work_images_slideshow);
    track.innerHTML = "";
    if (slideshowSection) slideshowSection.hidden = !showSlideshow;
    if (dotsContainer) dotsContainer.hidden = !showSlideshow;
    if (prevBtn) prevBtn.hidden = !showSlideshow;
    if (nextBtn) nextBtn.hidden = !showSlideshow;


    // 3) Grids
    const workGridSection = document.getElementById("projectImgGrid");
    const projectImgGridSeparator = document.getElementById("projectImgGridSeparator");
    const workGrid = document.getElementById("projectGridImages");
    const showWorkGrid = isYes(project.show_work_images_grid);
    if (workGrid) workGrid.innerHTML = "";
    if (workGridSection) workGridSection.hidden = !showWorkGrid;
    if (projectImgGridSeparator) projectImgGridSeparator.hidden = !showWorkGrid;
    

    const instSection = document.getElementById("installationImgGrid");
    const instSeparator = document.getElementById("installationSeparator");
    const instGrid = document.getElementById("installationGridImages");
    const rawInst = project.installation_images ?? [];
    const hasInst =
        Array.isArray(rawInst) &&
        rawInst.length > 0 &&
        !(rawInst.length === 1 && String(rawInst[0]).trim().toUpperCase() === "NA");

    if (!hasInst) {
        if (instGrid) instGrid.innerHTML = "";
        if (instSection) instSection.hidden = true;
        if (instSeparator) instSeparator.hidden = true;
    } else {
        if (instSection) instSection.hidden = false;
        if (instSeparator) instSeparator.hidden = false;
        // continue with your existing instList creation + population
    }

    if (instGrid) instGrid.innerHTML = "";

    // 4) Build a single modal list (sequential)
    const workList = (project.work_images ?? []).map(x => ({ kind: "work", ...x }));
    const instList = (project.installation_images ?? []).map(x => ({ kind: "installation", ...x }));

    modalWorkList = workList;
    modalInstList = instList;

    modalImageList = [...workList, ...instList];

    // Helper to attach click -> openImageModal(modalIndex)
    const wireModal = (imgEl, modalIndex) => {
        imgEl.dataset.modalIndex = String(modalIndex);

        imgEl.draggable = false;
        imgEl.addEventListener("dragstart", (e) => e.preventDefault());

        imgEl.addEventListener("click", () => {
            if (window.__slideshowSuppressClick) return;
            openImageModal(modalIndex);
        });
    };


    // 5) Render slideshow from work images only (like you had)
    workList.forEach((item, i) => {
        const slideImg = document.createElement("img");
        slideImg.src = item.src;
        slideImg.alt = item.title ?? project.title;
        wireModal(slideImg, i);            // modal index == work index
        track.appendChild(slideImg);
    });

    // 6) Render work grid (same indices as workList)
    if (workGrid) {
        workList.forEach((item, i) => {
            const img = document.createElement("img");
            img.src = item.src;
            img.alt = item.title ?? project.title;
            wireModal(img, i);
            workGrid.appendChild(img);
        });
    }

    // 7) Render installation grid (indices offset by workList.length)
    if (instGrid) {
        instList.forEach((item, j) => {
            const modalIndex = workList.length + j;
            const img = document.createElement("img");
            img.src = item.src;
            img.alt = item.label ?? project.title;
            wireModal(img, modalIndex);
            instGrid.appendChild(img);
        });
    }

    // 8) Description
    const textEl = document.getElementById("projectText");
    const textE2 = document.getElementById("projectText2");
    const textE3 = document.getElementById("projectText3");
    textEl.innerHTML = "";
    textE2.innerHTML = "";
    textE3.innerHTML = "";
    (project.description ?? []).forEach(par => {
        const p = document.createElement("p");
        p.textContent = par;
        textEl.appendChild(p);
    });
    (project.description2 ?? []).forEach(par => {
        const p = document.createElement("p");
        p.textContent = par;
        textE2.appendChild(p);
    });
    textE2.hidden = textE2.childElementCount === 0;
    (project.description3 ?? []).forEach(par => {
        const p = document.createElement("p");
        p.textContent = par;
        textE3.appendChild(p);
    });
    textE3.hidden = textE3.childElementCount === 0;


    // 9)
    const videoSection = document.getElementById("videoInlay");
    const iframeYT = document.getElementById("projectYTiframe");
    const iframeVimeo = document.getElementById("projectVimeoiframe");

    if (project.video_host === "YT") {
        if (iframeYT) iframeYT.hidden = false;
        if (iframeVimeo) iframeVimeo.hidden = true;
        const embedUrl = toYouTubeEmbedUrl(project.video_link);
        if (videoSection && iframeYT && embedUrl) {
            iframeYT.src = embedUrl;
            videoSection.hidden = false;
        } else if (videoSection && iframeYT) {
            iframeYT.src = "";
            videoSection.hidden = true;
        }
    }
    else if (project.video_host === "Vimeo") {

        if (iframeYT) iframeYT.hidden = true;
        if (iframeVimeo) iframeVimeo.hidden = false;
        const embedUrl = toVimeoEmbedUrl(project.video_link);
        if (videoSection && iframeVimeo && embedUrl) {
            iframeVimeo.src = embedUrl;
            videoSection.hidden = false;
        } else if (videoSection && iframeVimeo) {
            iframeVimeo.src = "";
            videoSection.hidden = true;
        }
    }
    
    else if (project.video_host === "NA") {
        if (iframeYT) iframeYT.hidden = true;
        if (iframeVimeo) iframeVimeo.hidden = true;
        videoSection.hidden = true;
    }


    //MSK Special handling, make dynamic
    const textImageSection = document.getElementById("projectTextImg");
    const isSpecial = project.id === "moments_before_the_fall" || project.title === "moments_before_the_fall";
    if (textImageSection) {
        // reset every time to avoid leftovers from previous project
        textImageSection.innerHTML = "";
        textImageSection.hidden = true;

        // Prefer project.id; fall back to title if you must
        

        const other = project.other_images ?? [];
        const hasOtherImages = Array.isArray(other) && other.length > 0;

        if (isSpecial && hasOtherImages) {
            textImageSection.hidden = false;

            // If you only want the first one
            const item = other[0];

            const figure = document.createElement("figure");
            figure.className = "projectTextFigure"; // optional CSS hook

            const img = document.createElement("img");
            img.src = item.src;
            img.alt = item.label || project.title || "";

            figure.appendChild(img);
            textImageSection.appendChild(figure);
        }
    }

    if (slideshowSection) {
        slideshowSection.classList.toggle("slideshow--single", isSpecial);
    }


    // 10) Slideshow dots count (work images)   
    initSlideshow(workList.length);
}

// Renders image + caption for a given index (wrap-safe)
function showModalImageAt(index) {
    const total = modalScopeList.length;
    if (!total) return;

    modalScopeIndex = (index + total) % total;
    const item = modalScopeList[modalScopeIndex];

    const imgEl = document.getElementById("imageModalImg");
    const captionEl = document.getElementById("imageModalCaption");

    imgEl.src = item.src;

    if (item.kind === "work") {
        captionEl.innerHTML = [item.title, item.medium, item.size, item.year].filter(Boolean).join("<br>");
    } else {
        captionEl.innerHTML = item.label; // or put extra installation fields here later
    }
    const modal = document.getElementById("imageModal");
    modal.classList.toggle("is-installation", item.kind === "installation");
}

// Opens the modal at a given index
function openImageModal(globalIndex) {
    const modal = document.getElementById("imageModal");
    const clicked = modalImageList[globalIndex];

    if (!clicked) return;

    if (clicked.kind === "work") {
        modalScopeList = modalWorkList;
        modalScopeIndex = globalIndex; // same index within work list
    } else {
        modalScopeList = modalInstList;
        modalScopeIndex = globalIndex - modalWorkList.length; // translate to inst index
    }

    modal.classList.add("is-open");
    showModalImageAt(modalScopeIndex);
}


function animateModalChange(delta) {
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

    modal.classList.remove('is-open');
    imgEl.src = '';
}

function initSlideshow(totalImages) {
    // Clean up any previous slideshow listeners (happens when switching projects)
    if (slideshowAbort) slideshowAbort.abort();
    slideshowAbort = new AbortController();
    const { signal } = slideshowAbort;

    const track = document.getElementById('slidesTrack');
    if (!track) return;

    const viewport = track.parentElement; // .slideshowContainer
    const slides = Array.from(track.children);
    if (!slides.length) return;

    const dotsContainer = document.getElementById('slideshowDots');
    const prevBtn = document.getElementById('slidePrev');
    const nextBtn = document.getElementById('slideNext');

    const gap = parseFloat(getComputedStyle(track).gap) || 32;
    const states = totalImages;

    let current = 0;
    let offsets = [];
    let dots = [];

    // ---- measurement ----
    function measure() {
        const widths = slides.map(slide => slide.getBoundingClientRect().width);
        offsets = [];
        let acc = 0;
        widths.forEach((w, i) => {
            offsets[i] = acc;
            acc += w + gap;
        });
    }

    // ---- navigation ----
    function setActiveDot(i) {
        dots.forEach((dot, idx) => dot.classList.toggle('is-active', idx === i));
    }

    function goToState(i) {
        if (!offsets.length) return;
        current = (i + states) % states;
        track.style.transform = `translateX(${-offsets[current]}px)`;
        setActiveDot(current);
    }

    function buildDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        dots = [];

        for (let i = 0; i < states; i++) {
            const dot = document.createElement('span');
            dot.className = 'slideshowDot' + (i === 0 ? ' is-active' : '');
            dot.addEventListener('click', () => {
                if (slideshowTimer) { clearInterval(slideshowTimer); slideshowTimer = null; }
                goToState(i);
            }, { signal });
            dotsContainer.appendChild(dot);
            dots.push(dot);
        }
    }

    // ---- drag/swipe (attached ONCE per init) ----
    window.__slideshowSuppressClick = window.__slideshowSuppressClick ?? false;

    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let startTranslate = 0;
    let activePointerId = null;
    const DRAG_THRESHOLD = 10;

    function getCurrentTranslatePx() {
        const t = getComputedStyle(track).transform;
        if (!t || t === 'none') return 0;
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
            if (d < bestDist) { bestDist = d; best = i; }
        }
        return best;
    }

    function onDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        isDown = true;
        isDragging = false;
        window.__slideshowSuppressClick = false;

        activePointerId = e.pointerId;
        startX = e.clientX;
        startTranslate = getCurrentTranslatePx();
    }

    function onMove(e) {
        if (!isDown || e.pointerId !== activePointerId) return;

        const dx = e.clientX - startX;

        if (!isDragging && Math.abs(dx) > DRAG_THRESHOLD) {
            isDragging = true;
            window.__slideshowSuppressClick = true;

            viewport.classList.add('is-dragging');
            track.classList.add('is-dragging'); // disables transition via CSS

            viewport.setPointerCapture(activePointerId);

            if (slideshowTimer) { clearInterval(slideshowTimer); slideshowTimer = null; }
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

            viewport.classList.remove('is-dragging');
            track.classList.remove('is-dragging'); // transition back ON

            // Important: apply snapped state after transition is back
            requestAnimationFrame(() => goToState(best));

            try { viewport.releasePointerCapture(activePointerId); } catch (_) { }
            setTimeout(() => { window.__slideshowSuppressClick = false; }, 50);
        }

        activePointerId = null;
        isDragging = false;
    }

    viewport.addEventListener('pointerdown', onDown, { signal });
    viewport.addEventListener('pointermove', onMove, { signal, passive: false });
    viewport.addEventListener('pointerup', onUp, { signal });
    viewport.addEventListener('pointercancel', onUp, { signal });

    // ---- arrows + auto ----
    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (slideshowTimer) { clearInterval(slideshowTimer); slideshowTimer = null; }
        goToState(current - 1);
    }, { signal });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (slideshowTimer) { clearInterval(slideshowTimer); slideshowTimer = null; }
        goToState(current + 1);
    }, { signal });

    function setup() {
        measure();
        buildDots();
        goToState(0);

        if (slideshowTimer) clearInterval(slideshowTimer);
        slideshowTimer = setInterval(() => goToState(current + 1), 5000);
    }

    // wait for images to load (same idea as your current code)
    let loaded = 0;
    slides.forEach(img => {
        if (img.complete) {
            loaded++;
            if (loaded === slides.length) setup();
        } else {
            img.addEventListener('load', () => {
                loaded++;
                if (loaded === slides.length) setup();
            }, { signal, once: true });
        }
    });
    if (loaded === slides.length) setup();

    // keep offsets correct on resize
    window.addEventListener('resize', () => {
        measure();
        goToState(current);
    }, { signal });
}


function setCurrentProject(id) {
    const project = allProjects.find(p => p.id === id);
    if (!project) return;

    const details = document.querySelector('.projectDetails');

    // start fade out
    details.classList.add('is-fading');

    // wait for fade-out, then swap content and fade back in
    setTimeout(() => {
        currentProjectId = id;
        renderProject(project);   // updates title, slideshow, text

        // update active class on links
        const links = document.querySelectorAll('.projectLink');
        links.forEach(link => {
            const thisId = new URLSearchParams(link.href.split('?')[1]).get('id');
            link.classList.toggle('is-active', thisId === id);
        });

        // update URL without reload
        const url = new URL(window.location);
        url.searchParams.set('id', id);
        window.history.pushState({}, '', url);
        updateProjectNavButtons()
        // fade back in
        requestAnimationFrame(() => {
            details.classList.remove('is-fading');
        });
        scrollToTopSmooth();
    }, 250); // same as CSS transition duration
    

}


async function loadProjects() {
    const response = await fetch('projects.json');
    const projects = await response.json();

    allProjects = projects;

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    const initialProject = projects.find(p => p.id === idFromUrl) || projects[0];

    const menu = document.getElementById('projectMenu');
    menu.innerHTML = '';

    projects.forEach(project => {
        const link = document.createElement('a');
        link.href = `?id=${project.id}`;
        link.textContent = project.title;
        link.className = 'projectLink';

        link.addEventListener('click', (event) => {
            event.preventDefault();
            closeLeftPanel();
            setCurrentProject(project.id);
        });

        menu.appendChild(link);
    });

    setCurrentProject(initialProject.id);
    syncLeftPanelBgWidth()
    maybeRunMenuIntro();
}

function maybeRunMenuIntro() {
    const url = new URL(window.location.href);

    // Only if user arrived via a Home link that added intro=1
    if (url.searchParams.get('intro') !== '1') return;

    // Remove intro param so refresh/back won’t replay it
    url.searchParams.delete('intro');
    window.history.replaceState({}, '', url);

    openLeftPanel();

    let timer = setTimeout(() => {
        closeLeftPanel();
    }, 4000);

    // If user interacts, cancel the auto-close
    const hamburgerBtn = document.getElementById('hamburgerToggle');
    const leftPanel = document.querySelector('.worksLeft');

    const cancel = () => {
        clearTimeout(timer);
        timer = null;
        if (hamburgerBtn) hamburgerBtn.removeEventListener('pointerdown', cancel);
        if (leftPanel) leftPanel.removeEventListener('pointerdown', cancel);
    };

    if (hamburgerBtn) hamburgerBtn.addEventListener('pointerdown', cancel, { once: true });
    if (leftPanel) leftPanel.addEventListener('pointerdown', cancel, { once: true });
}

// Project navigation buttons at bottom
document.addEventListener("DOMContentLoaded", () => {
    const prevBtn = document.getElementById("projectPrevProject");
    const nextBtn = document.getElementById("projectNextProject");

    if (prevBtn) prevBtn.addEventListener("click", () => goToAdjacentProject(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => goToAdjacentProject(1));
});

function goToAdjacentProject(delta) {
    if (!Array.isArray(allProjects) || !allProjects.length || !currentProjectId) return;

    const idx = allProjects.findIndex(p => p.id === currentProjectId);
    if (idx === -1) return;

    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= allProjects.length) return; // no wrap

    closeLeftPanel?.(); // optional; keeps UI consistent
    setCurrentProject(allProjects[nextIdx].id);
}

function updateProjectNavButtons() {
    const prevBtn = document.getElementById("projectPrevProject");
    const nextBtn = document.getElementById("projectNextProject");
    if (!prevBtn || !nextBtn) return;

    if (!Array.isArray(allProjects) || !allProjects.length || !currentProjectId) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    const idx = allProjects.findIndex(p => p.id === currentProjectId);
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx === -1 || idx >= allProjects.length - 1;
}


//========== Helper functions ==========
function toYouTubeEmbedUrl(url) {
    if (!url) return null;

    // Accept array or string
    if (Array.isArray(url)) url = url[0];
    if (typeof url !== "string") return null;

    // Extract video id from common YouTube URL forms
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

    // Accept array or string
    if (Array.isArray(url)) url = url[0];
    if (typeof url !== "string") return null;

    // Normalize
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

function scrollToTopSmooth() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

function closeLeftPanel() {
    const hamburgerBtn = document.getElementById('hamburgerToggle');
    const leftPanel = document.querySelector('.worksLeft');
    const leftBg = document.querySelector('.leftPanelBg');
    const homeIcon = document.getElementById('homeIcon');

    if (!hamburgerBtn || !leftPanel) return;

    leftPanel.classList.add('closed');
    hamburgerBtn.classList.remove('open');
    if (leftBg) leftBg.classList.remove('is-visible');
    if (homeIcon) homeIcon.hidden = true;
}

function openLeftPanel() {
    const hamburgerBtn = document.getElementById('hamburgerToggle');
    const leftPanel = document.querySelector('.worksLeft');
    const leftBg = document.querySelector('.leftPanelBg');
    const homeIcon = document.getElementById('homeIcon');

    if (!hamburgerBtn || !leftPanel) return;

    leftPanel.classList.remove('closed');
    hamburgerBtn.classList.add('open');
    if (leftBg) leftBg.classList.add('is-visible');
    if (homeIcon) homeIcon.hidden = false;
    syncLeftPanelBgWidth()
}


function syncLeftPanelBgWidth() {
    const panel = document.querySelector('.worksLeft');
    const bg = document.querySelector('.leftPanelBg');
    if (!panel || !bg) return;

    const panelW = Math.round(panel.getBoundingClientRect().width);
    const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);

    const isMobile = vw <= 900; // match your CSS breakpoint
    const w = isMobile ? 1000 : panelW;

    bg.style.setProperty('--panel-w', `${w}px`);
}

function syncTopBarFade() {
    const sep = document.querySelector('.projectTitleSeparator');
    const topBar = document.querySelector('.topBar');
    if (!sep || !topBar) return;

    // bottom is viewport Y coordinate of the separator’s bottom edge
    const fadeStartPx = Math.round(sep.getBoundingClientRect().bottom); // px [web:12]

    const extraSolidPadding = 8; // set e.g. 8/12 if you want space after the line
    topBar.style.setProperty('--panel-h', `${Math.ceil(fadeStartPx + extraSolidPadding)}px`);
}


function isYes(v) {
  return String(v ?? "").trim().toLowerCase() === "yes";
}

//Event Listeners
window.addEventListener('resize', syncTopBarFade, syncLeftPanelBgWidth);
document.addEventListener('DOMContentLoaded', loadProjects);
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('imageModal');
    const modalContent = document.querySelector(".imageModalContent");
    const swipeEl = document.getElementById("imageModalImg");
    const closeBtn = document.querySelector('.imageModalClose');
    const backdrop = document.querySelector('.imageModalBackdrop');
    const leftArrow = document.querySelector('.modalArrowLeft');
    const rightArrow = document.querySelector('.modalArrowRight');
    const homeIcon = document.getElementById('homeIcon');
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
    const hamburgerBtn = document.getElementById('hamburgerToggle');
    const leftPanel = document.querySelector('.worksLeft');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleLeftPanel);
    }
    document.addEventListener('click', (e) => {
        if (hamburgerBtn && leftPanel && !leftPanel.contains(e.target) && !hamburgerBtn.contains(e.target) && !leftPanel.classList.contains('closed')) {
            toggleLeftPanel();
        }
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

});
