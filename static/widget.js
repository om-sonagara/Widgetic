// Widgetic Widget Logic
(function () {
    // Prevent multiple injections
    if (window.hasWidgeticLoaded) return;
    window.hasWidgeticLoaded = true;

    /* ===============================
       CONFIG & STATE
       =============================== */
    const scriptSrc = document.currentScript?.src || "";
    const params = new URLSearchParams(scriptSrc.split("?")[1]);
    const WEBSITE_KEY = params.get("key");

    if (!WEBSITE_KEY) {
        console.error("Widgetic: No public key provided.");
        return;
    }

    const API_BASE = "http://127.0.0.1:5000"; // Dev URL
    const HOST_ID = "widgetic-host";

    let globalSettings = {};
    let widgets = [];
    let currentWidgetIndex = -1;
    let showingWidget = false;
    let autoCloseTimer = null;

    /* ===============================
       STYLES
       =============================== */
    const CSS_CONTENT = `
        .widgetic-container {
            position: fixed;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            transition: all 0.3s ease;
            opacity: 0;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .widgetic-container.visible {
            opacity: 1;
            pointer-events: auto;
        }

        .widgetic-card {
            background: #fff;
            color: #000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            border-radius: 8px;
            overflow: hidden;
            position: relative;
        }

        .widgetic-close {
            position: absolute;
            top: 5px; right: 8px;
            cursor: pointer;
            font-size: 18px;
            opacity: 0.6;
            line-height: 1;
            z-index: 10;
        }
        .widgetic-close:hover { opacity: 1; }

        .widgetic-content { padding: 16px; }
        .widgetic-title { font-weight: 600; margin-bottom: 4px; font-size: 15px; }
        .widgetic-desc { font-size: 14px; opacity: 0.9; line-height: 1.4; }
        
        .widgetic-btn {
            display: inline-block;
            margin-top: 10px;
            padding: 6px 12px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            background: rgba(0,0,0,0.1); /* Fallback */
            color: inherit;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .widgetic-btn:hover { opacity: 0.8; }

        .widgetic-branding {
            font-size: 10px;
            text-align: center;
            opacity: 0.5;
            padding-bottom: 5px;
        }
        .widgetic-branding a { color: inherit; text-decoration: none; }

        /* --- NOTIFICATION (Default) --- */
        .widgetic-container.type-notification {
            width: 320px;
            /* Default: just opacity fade if not overridden */
        }
        
        /* LEFT SIDE: Slide in from Left (-50px) */
        .pos-top-left, .pos-bottom-left { 
            left: 20px; 
            transform: translateX(-50px); 
        }
        .pos-top-left { top: 20px; }
        .pos-bottom-left { bottom: 20px; }

        /* RIGHT SIDE: Slide in from Right (50px) */
        .pos-top-right, .pos-bottom-right { 
            right: 20px; 
            transform: translateX(50px); 
        }
        .pos-top-right { top: 20px; }
        .pos-bottom-right { bottom: 20px; }

        .widgetic-container.visible.pos-bottom-right,
        .widgetic-container.visible.pos-bottom-left,
        .widgetic-container.visible.pos-top-right,
        .widgetic-container.visible.pos-top-left { 
            transform: translateX(0); 
            opacity: 1;
        }


        /* --- POPUP MODAL --- */
        .widgetic-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 2147483646; opacity: 0; transition: opacity 0.3s; pointer-events: none;
            backdrop-filter: blur(2px);
        }
        .widgetic-overlay.visible { opacity: 1; pointer-events: auto; }
        
        .widgetic-container.type-modal {
            top: 50%; left: 50%;
            transform: translate(-50%, -45%) scale(0.95);
            width: 90%; max-width: 420px;
        }
        .widgetic-container.type-modal.visible { transform: translate(-50%, -50%) scale(1); }


        /* --- ANNOUNCEMENT BAR --- */
        .widgetic-container.type-bar {
            left: 0; right: 0; width: 100%;
            border-radius: 0; margin: 0;
            padding: 0;
        }
        .widgetic-container.type-bar .widgetic-card {
            border-radius: 0; box-shadow: none;
            display: flex; align-items: center; justify-content: center;
            padding: 10px 20px; width: 100%;
        }
        .widgetic-container.type-bar .widgetic-content {
            padding: 0; display: flex; align-items: center; gap: 15px; flex: 1; justify-content: center;
        }
        .widgetic-container.type-bar .widgetic-title { margin: 0; font-size: 14px; }
        .widgetic-container.type-bar .widgetic-desc { margin: 0; font-size: 14px; }
        .widgetic-container.type-bar .widgetic-btn { margin: 0; margin-left: 10px; }
        .widgetic-container.type-bar.pos-top { top: 0; bottom: auto; transform: translateY(-100%); }
        .widgetic-container.type-bar.pos-bottom { bottom: 0; top: auto; transform: translateY(100%); }
        .widgetic-container.type-bar.visible { transform: translateY(0); }


        /* --- SLIDE IN --- */
        .widgetic-container.type-slide {
            top: 0; bottom: 0; width: 320px;
            border-radius: 0; margin: 0;
            background: transparent;
        }
        .widgetic-container.type-slide .widgetic-card {
            height: 100%; border-radius: 0;
            display: flex; flex-direction: column; justify-content: center;
        }
        .widgetic-container.type-slide.pos-right { right: 0; left: auto; transform: translateX(100%); }
        .widgetic-container.type-slide.pos-left { left: 0; right: auto; transform: translateX(-100%); }
        .widgetic-container.type-slide.visible { transform: translateX(0); }


        /* --- FLOATING BUTTON --- */
        .widgetic-container.type-button {
            /* Position handled by pos- classes */
            align-items: flex-end; /* Align content to bottom/right usually */
            width: auto; height: auto;
            overflow: visible; /* Allow bubble to pop out */
        }
        
        .widgetic-float-btn {
            width: 56px; height: 56px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 24px;
            transition: transform 0.2s;
            z-index: 20;
            position: relative;
        }
        .widgetic-float-btn:hover { transform: scale(1.05); }
        .widgetic-float-btn.active { transform: rotate(45deg); }

        .widgetic-float-content {
            position: absolute;
            bottom: 70px; right: 0; /* Align to button */
            width: 300px;
            transform-origin: bottom right;
            transform: scale(0.8); opacity: 0; pointer-events: none;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .widgetic-container.pos-bottom-left .widgetic-float-content { right: auto; left: 0; transform-origin: bottom left; }
        .widgetic-container.pos-top-right .widgetic-float-content { bottom: auto; top: 70px; transform-origin: top right; }
        .widgetic-container.pos-top-left .widgetic-float-content { bottom: auto; top: 70px; right: auto; left: 0; transform-origin: top left; }

        .widgetic-float-content.expanded {
            transform: scale(1); opacity: 1; pointer-events: auto;
        }
    `;

    /* ===============================
       INIT
       =============================== */

    function initWidget() {
        if (document.getElementById(HOST_ID)) return;

        const host = document.createElement("div");
        host.id = HOST_ID;
        document.body.appendChild(host);

        shadow = host.attachShadow({ mode: "open" });

        const style = document.createElement("style");
        style.textContent = CSS_CONTENT;
        shadow.appendChild(style);

        overlay = document.createElement("div");
        overlay.className = "widgetic-overlay";
        shadow.appendChild(overlay);

        container = document.createElement("div");
        container.className = "widgetic-container";
        shadow.appendChild(container);

        // Fetch Config
        fetch(`${API_BASE}/api/website/${WEBSITE_KEY}/config`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    console.error("Widgetic Error:", data.error);
                    return;
                }
                globalSettings = data.settings;
                widgets = data.widgets;

                if (widgets.length > 0) {
                    startRotationList();
                }
            })
            .catch(err => console.error("Widgetic: Failed to load config", err));

        // Expose container for render functions
        window._widgeticContainer = container;
        window._widgeticOverlay = overlay;
        window._widgeticShadow = shadow;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initWidget);
    } else {
        initWidget();
    }


    /* ===============================
       LOGIC
       =============================== */

    function applyPositionClass(posOverride) {
        const pos = (posOverride || globalSettings.position || "BOTTOM_RIGHT").toLowerCase().replace("_", "-");
        // Remove old pos classes
        container.className = container.className.replace(/pos-\S+/g, "");
        container.classList.add(`pos-${pos}`);
    }

    function startRotationList() {
        // Initialize state
        widgets.forEach(w => {
            // Restore count from session storage
            const storedCount = sessionStorage.getItem(`widgetic_count_${w.id}`);
            w.displayCount = storedCount ? parseInt(storedCount) : 0;

            // Ensure loopLimit is a valid number, default 0 (infinite)
            let limit = parseInt(w.content.loop_count);
            if (isNaN(limit)) limit = 0;
            w.loopLimit = limit;
        });

        // Initial delay
        setTimeout(showNextWidget, 1000);
    }

    function getOpenBehavior(widget) {
        if (widget.type === "ANNOUNCEMENT_BAR") return "STICKY";
        if (widget.type === "FLOATING_BUTTON") return "ON_CLICK";
        if (widget.type === "BANNER") return "STICKY"; // Banner also sticky by default
        return "AUTO";
    }

    function isSticky(widget) { return getOpenBehavior(widget) === "STICKY"; }
    function isClickOnly(widget) { return getOpenBehavior(widget) === "ON_CLICK"; }

    function showNextWidget() {
        // Filter available
        const availableWidgets = widgets.filter(w => w.loopLimit === 0 || w.displayCount < w.loopLimit);

        if (availableWidgets.length === 0) {
            return;
        }

        // Find next
        let found = false;
        let attempts = 0;
        while (!found && attempts < widgets.length) {
            currentWidgetIndex = (currentWidgetIndex + 1) % widgets.length;
            const w = widgets[currentWidgetIndex];

            // Re-check individual limit in rotation
            if (w.loopLimit === 0 || w.displayCount < w.loopLimit) {
                found = true;
            } else {
                attempts++;
            }
        }

        if (!found) {
            return;
        }
        const widget = widgets[currentWidgetIndex];
        widget.displayCount++;

        // Persist count
        sessionStorage.setItem(`widgetic_count_${widget.id}`, widget.displayCount);

        // Check Open Behavior
        if (widget.type === "FLOATING_BUTTON") {
            renderWidget(widget);
            container.classList.add("visible");
            return; // STOP ROTATION
        }

        if (widget.type === "ANNOUNCEMENT_BAR" || widget.type === "BANNER") {
            renderWidget(widget);
            container.classList.add("visible");
            trackEvent(widget.id, "view");
            return; // STOP ROTATION
        }

        // Auto (Notification, Modal, Slide)
        renderWidget(widget);
        requestAnimationFrame(() => {
            container.classList.add("visible");
            if (widget.type === "POPUP_MODAL") overlay.classList.add("visible");
            trackEvent(widget.id, "view");
        });

        // POPUP_MODAL is sticky (infinite time), others auto-close
        if (widget.type !== "POPUP_MODAL") {
            const showTime = (globalSettings.timing?.showTime || 5) * 1000;
            if (autoCloseTimer) clearTimeout(autoCloseTimer);
            autoCloseTimer = setTimeout(() => {
                autoCloseTimer = null;
                hideWidget();
            }, showTime);
        }
    }

    function hideWidget() {
        container.classList.remove("visible");
        overlay.classList.remove("visible");
        const hideTime = (globalSettings.timing?.hideTime || 8) * 1000;
        setTimeout(showNextWidget, hideTime);
    }

    function manualClose() {
        if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
        }
        hideWidget();
    }

    /* -------------------------------------------------- */
    /*                 RENDER SWITCH                      */
    /* -------------------------------------------------- */

    function renderWidget(widget) {
        container.innerHTML = "";
        container.className = "widgetic-container"; // Reset

        switch (widget.type) {
            case "FLOATING_BUTTON":
                renderFloatingButton(widget);
                break;
            case "ANNOUNCEMENT_BAR":
            case "BANNER":
                renderAnnouncementBar(widget);
                break;
            case "POPUP_MODAL":
                renderPopupModal(widget);
                break;
            case "SLIDE_IN":
                renderSlideIn(widget);
                break;
            default: // NOTIFICATION
                renderNotification(widget);
                break;
        }
    }


    /* -------------------------------------------------- */
    /*              RENDER IMPLEMENTATIONS                */
    /* -------------------------------------------------- */

    function getCommonStyles() {
        return {
            bg: globalSettings.style?.backgroundColor || "#fff",
            txt: globalSettings.style?.textColor || "#000"
        };
    }

    function generateCardHTML(widget, style, showClose = true) {
        const { bg, txt } = style || getCommonStyles();
        const { title, description, button_text, button_url } = widget.content;
        const btnHtml = (button_text && button_url) ? `<a href="${button_url}" target="_blank" class="widgetic-btn" style="color:${bg}; background:${txt}">${button_text}</a>` : '';
        const closeHtml = showClose ? `<div class="widgetic-close">&times;</div>` : '';

        return `
            <div class="widgetic-card" style="background:${bg}; color:${txt};">
                ${closeHtml}
                <div class="widgetic-content">
                    ${title ? `<div class="widgetic-title">${title}</div>` : ''}
                    ${description ? `<div class="widgetic-desc">${description}</div>` : ''}
                    ${btnHtml}
                </div>
                <div class="widgetic-branding"><a href="${API_BASE}" target="_blank">Powered by Widgetic</a></div>
            </div>
        `;
    }

    function renderNotification(widget) {
        container.classList.add("type-notification");
        applyPositionClass();

        container.innerHTML = generateCardHTML(widget);

        setupCloseHandler(widget);
        setupClickTracking(widget);
    }

    function renderPopupModal(widget) {
        container.classList.add("type-modal");

        container.innerHTML = generateCardHTML(widget);

        setupCloseHandler(widget, true); // Close overlay too
        setupClickTracking(widget);

        overlay.onclick = () => {
            manualClose();
        };
    }

    function renderAnnouncementBar(widget) {
        container.classList.add("type-bar");

        // Map global pos to top/bottom
        const posStr = globalSettings.position || "BOTTOM_RIGHT";
        const isTop = posStr.includes("TOP");
        container.classList.add(isTop ? "pos-top" : "pos-bottom");

        const styles = getCommonStyles();
        // Custom HTML for Bar
        const { title, description, button_text, button_url } = widget.content;
        const btnHtml = (button_text && button_url) ? `<a href="${button_url}" target="_blank" class="widgetic-btn" style="color:${styles.bg}; background:${styles.txt}">${button_text}</a>` : '';

        container.innerHTML = `
            <div class="widgetic-card" style="background:${styles.bg}; color:${styles.txt};">
                <div class="widgetic-close" style="top: auto; font-size: 16px;">&times;</div>
                <div class="widgetic-content">
                    <span class="widgetic-title">${title || ""}</span>
                    <span class="widgetic-desc" style="margin-left:8px">${description || ""}</span>
                    ${btnHtml}
                </div>
            </div>
        `;

        setupCloseHandler(widget);
        setupClickTracking(widget);
    }

    function renderSlideIn(widget) {
        container.classList.add("type-slide");

        // Left or Right
        const posStr = globalSettings.position || "BOTTOM_RIGHT";
        const isLeft = posStr.includes("LEFT");
        container.classList.add(isLeft ? "pos-left" : "pos-right");

        container.innerHTML = generateCardHTML(widget);
        setupCloseHandler(widget);
        setupClickTracking(widget);
    }

    function renderFloatingButton(widget) {
        container.classList.add("type-button");
        applyPositionClass();

        const styles = getCommonStyles();

        // Create Bubble + Content Card
        const bubble = document.createElement("div");
        bubble.className = "widgetic-float-btn";
        bubble.style.background = styles.bg;
        bubble.style.color = styles.txt;
        bubble.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`; // Icon

        const content = document.createElement("div");
        content.className = "widgetic-float-content";
        content.innerHTML = generateCardHTML(widget, styles, false); // No internal close, just toggle

        container.appendChild(bubble);
        container.appendChild(content);

        // Click Handler (Toggle)
        bubble.onclick = (e) => {
            e.stopPropagation();
            const isExpanded = content.classList.contains("expanded");
            if (isExpanded) {
                content.classList.remove("expanded");
                bubble.classList.remove("active");
                bubble.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
            } else {
                content.classList.add("expanded");
                bubble.classList.add("active");
                bubble.innerHTML = `&times;`;
                trackEvent(widget.id, "click"); // Track open
            }
        };

        setupClickTracking(widget); // Track content button click
    }

    /* --- Utilities --- */
    function setupCloseHandler(widget, closeOverlay = false) {
        const closeBtn = container.querySelector(".widgetic-close");
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                trackEvent(widget.id, "dismiss");
                manualClose();
            };
        }
    }

    function setupClickTracking(widget) {
        const btn = container.querySelector(".widgetic-btn");
        if (btn) {
            btn.onclick = () => trackEvent(widget.id, "click");
        }
    }

    function trackEvent(widgetId, type) {
        fetch(`${API_BASE}/api/widget/${widgetId}/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: type })
        }).catch(err => console.error("Tracking failed", err));
    }

})();
