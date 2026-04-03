const hamburgerBtn = document.getElementById('hamburgerToggle');
const leftPanel = document.querySelector('.aboutLeft');
const homeIcon = document.getElementById('homeIcon');
const leftBg = document.querySelector('.leftPanelBg');
const topSep = document.querySelector('.pageTitleSeparator');
const topBar = document.querySelector('.topBar');

function toggleLeftPanel() {
    if (!hamburgerBtn || !leftPanel) return;

    leftPanel.classList.toggle('closed');
    hamburgerBtn.classList.toggle('open');

    const isOpen = !leftPanel.classList.contains('closed');

    if (leftBg) leftBg.classList.toggle('is-visible', isOpen);
    if (homeIcon) homeIcon.hidden = !isOpen;   // visible only when open
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
    const leftPanel = document.querySelector('.aboutLeft');

    /*const cancel = () => {
        clearTimeout(timer);
        timer = null;
        if (hamburgerBtn) hamburgerBtn.removeEventListener('pointerdown', cancel);
        if (leftPanel) leftPanel.removeEventListener('pointerdown', cancel);
    };*/

    if (hamburgerBtn) hamburgerBtn.addEventListener('pointerdown', cancel, { once: true });
    if (leftPanel) leftPanel.addEventListener('pointerdown', cancel, { once: true });
}

function scrollToTopSmooth() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

function closeLeftPanel() {
    if (!hamburgerBtn || !leftPanel) return;

    leftPanel.classList.add('closed');
    hamburgerBtn.classList.remove('open');
    if (leftBg) leftBg.classList.remove('is-visible');
    if (homeIcon) homeIcon.hidden = true;
}

function openLeftPanel() {
    if (!hamburgerBtn || !leftPanel) return;

    leftPanel.classList.remove('closed');
    hamburgerBtn.classList.add('open');
    if (leftBg) leftBg.classList.add('is-visible');
    if (homeIcon) homeIcon.hidden = false;
    syncLeftPanelBgWidth()
}


function syncLeftPanelBgWidth() {
    if (!leftBg || !bg) return;

    const leftPanelW = Math.round(leftPanel.getBoundingClientRect().width);
    const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);

    const isMobile = vw <= 900; // match your CSS breakpoint
    const w = isMobile ? 1000 : leftPanelW;

    leftBg.style.setProperty('--panel-w', `${w}px`);
}

function syncTopBarFade() {
    if (!topSep || !topBar) return;

    // bottom is viewport Y coordinate of the separator’s bottom edge
    const fadeStartPx = Math.round(topSep.getBoundingClientRect().bottom); // px [web:12]

    const extraSolidPadding = 8; // set e.g. 8/12 if you want space after the line
    topBar.style.setProperty('--panel-h', `${Math.ceil(fadeStartPx + extraSolidPadding)}px`);
}

window.addEventListener('resize', syncLeftPanelBgWidth, syncTopBarFade);

document.addEventListener('DOMContentLoaded', () => {
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleLeftPanel);
    }
    document.addEventListener('click', (e) => {
        if (hamburgerBtn && leftPanel && !leftPanel.contains(e.target) && !hamburgerBtn.contains(e.target) && !leftPanel.classList.contains('closed')) {
            toggleLeftPanel();
        }
    });
});