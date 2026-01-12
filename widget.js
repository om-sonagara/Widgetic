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

    /* ===============================
       STYLES
       =============================== */
    const CSS_CONTENT = `
        .widgetic-container {
            position: fixed;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            pointer-events: none;
        }

        .widgetic-container.visible {
            opacity: 1;
            pointer-events: auto;
        }

        /* --- NOTIFICATION (Default) --- */
        .widgetic-container.type-notification {
            transform: translateY(20px);
            width: 320px;
        }
        .widgetic-container.type-notification.visible {
            transform: translateY(0);
        }
        
        /* Positions for Notification */
        .pos-bottom-right { bottom: 20px; right: 20px; }
        .pos-bottom-left { bottom: 20px; left: 20px; }
        .pos-top-right { top: 20px; right: 20px; transform: translateY(-20px) !important; }
        .pos-top-left { top: 20px; left: 20px; transform: translateY(-20px) !important; }
        .pos-top-right.visible, .pos-top-left.visible { transform: translateY(0) !important; }


        /* --- POPUP MODAL --- */
        .widgetic-overlay {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5);
            z-index: 2147483646;
            opacity: 0;
            transition: opacity 0.5s;
            pointer-events: none;
            backdrop-filter: blur(2px);
        }
        .widgetic-overlay.visible {
            opacity: 1;
            pointer-events: auto;
        }
        
        .widgetic-container.type-modal {
            top: 50%; left: 50%;
            transform: translate(-50%, -40%) scale(0.95);
            width: 90%;
            max-width: 450px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .widgetic-container.type-modal.visible {
            transform: translate(-50%, -50%) scale(1);
        }


        /* --- BANNER --- */
        .widgetic-container.type-banner {
            top: 0; left: 0; right: 0;
            width: 100%;
            transform: translateY(-100%);
            border-radius: 0;
        }
        .widgetic-container.type-banner.visible {
            transform: translateY(0);
        }
        .widgetic-container.type-banner .widgetic-card {
            width: 100%;
            border-radius: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px 20px;
            flex-direction: row;
            gap: 20px;
            text-align: left;
        }
        .widgetic-container.type-banner .widgetic-content {
            padding: 0;
            display: flex;
            align-items: center;
            gap: 15px;
            flex: 1;
            justify-content: center;
        }
        .widgetic-container.type-banner .widgetic-desc {
            margin-bottom: 0;
        }
        .widgetic-container.type-banner .widgetic-branding {
            display: none; /* Hide branding on small banner to save space */
        }
        .widgetic-container.type-banner .widgetic-close {
            position: static;
            margin-left: 20px;
        }

        /* --- CARD STYLES --- */
        .widgetic-card {
            background: #fff;
            color: #333;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.05);
            position: relative;
            width: 100%; /* Fill container */
        }

        .widgetic-close {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0.5;
            transition: opacity 0.2s;
            border-radius: 50%;
            background: rgba(0,0,0,0.05);
            font-size: 16px;
            line-height: 1;
        }
        .widgetic-close:hover { opacity: 1; background: rgba(0,0,0,0.1); }

        .widgetic-content {
            padding: 20px;
        }

        .widgetic-title {
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 4px;
        }

        .widgetic-desc {
            font-size: 14px;
            line-height: 1.5;
            opacity: 0.9;
            margin-bottom: 12px;
        }

        .widgetic-btn {
            display: inline-block;
            background: #000;
            color: #fff;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            transition: transform 0.1s, opacity 0.2s;
            white-space: nowrap;
        }
        .widgetic-btn:hover { opacity: 0.9; }
        .widgetic-btn:active { transform: scale(0.98); }
        
        .widgetic-branding {
            font-size: 10px;
            text-align: center;
            padding: 6px;
            background: rgba(0,0,0,0.03);
            color: inherit;
            opacity: 0.6;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .widgetic-branding a { color: inherit; text-decoration: none; font-weight: bold; }
        
        @media (max-width: 600px) {
            .widgetic-container.type-banner .widgetic-content { flex-direction: column; text-align: center; }
        }
    `;

    /* ===============================
       INIT
       =============================== */

    // Create Host
    const host = document.createElement("div");
    host.id = HOST_ID;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    // Inject Styles
    const style = document.createElement("style");
    style.textContent = CSS_CONTENT;
    shadow.appendChild(style);

    // Overlay (for modals)
    const overlay = document.createElement("div");
    overlay.className = "widgetic-overlay";
    shadow.appendChild(overlay);

    // Container
    const container = document.createElement("div");
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

            console.log("Widgetic: Started rotation", widgets);

            if (widgets.length > 0) {
                startRotationList();
            }
        })
        .catch(err => console.error("Widgetic: Failed to load config", err));


    /* ===============================
       LOGIC
       =============================== */

    function applyPositionClass() {
        // Only applies to Notification type usually, but we set it anyway
        const pos = globalSettings.position.toLowerCase().replace("_", "-");
        // Remove old pos classes if any
        container.className = container.className.replace(/pos-\S+/g, "");
        container.classList.add(`pos-${pos}`);
    }

    function startRotationList() {
        // Initialize state
        widgets.forEach(w => {
            w.displayCount = 0;
            w.loopLimit = parseInt(w.content.loop_count || 0);
        });

        // Initial delay
        setTimeout(showNextWidget, 1000);
    }

    function showNextWidget() {
        // Filter available
        const availableWidgets = widgets.filter(w => w.loopLimit === 0 || w.displayCount < w.loopLimit);

        console.log(`Widgetic: Available widgets: ${availableWidgets.length}/${widgets.length}`);

        if (availableWidgets.length === 0) {
            console.log("Widgetic: All widgets reached loop limit. Stopping.");
            return;
        }

        // Find next
        let found = false;
        let attempts = 0;
        while (!found && attempts < widgets.length) {
            currentWidgetIndex = (currentWidgetIndex + 1) % widgets.length;
            const w = widgets[currentWidgetIndex];
            if (w.loopLimit === 0 || w.displayCount < w.loopLimit) {
                found = true;
            } else {
                attempts++;
            }
        }

        if (!found) return;

        const widget = widgets[currentWidgetIndex];
        widget.displayCount++;

        console.log(`Widgetic: Showing widget "${widget.content.title}" (${widget.displayCount}/${widget.loopLimit || "∞"})`);

        renderWidget(widget);

        // Appear
        requestAnimationFrame(() => {
            container.classList.add("visible");
            if (widget.type === "POPUP_MODAL") overlay.classList.add("visible");

            trackEvent(widget.id, "view");
        });

        const showTime = (globalSettings.timing?.showTime || 5) * 1000;

        setTimeout(() => {
            hideWidget();
        }, showTime);
    }

    function hideWidget() {
        container.classList.remove("visible");
        overlay.classList.remove("visible");

        const hideTime = (globalSettings.timing?.hideTime || 8) * 1000;

        setTimeout(() => {
            showNextWidget();
        }, hideTime);
    }

    function renderWidget(widget) {
        // Reset Container Classes
        container.className = "widgetic-container"; // Clear all types/positions
        applyPositionClass(); // Add position back

        console.log(`Widgetic: Rendering widget type "${widget.type}"`);

        // determine type class
        let typeClass = "type-notification"; // default
        const type = (widget.type || "").toUpperCase();

        if (type === "POPUP_MODAL") typeClass = "type-modal";
        if (type === "BANNER") typeClass = "type-banner";

        container.classList.add(typeClass);

        const { style: wStyle, behavior } = globalSettings;
        const bgColor = wStyle?.backgroundColor || "#fff";
        const txtColor = wStyle?.textColor || "#000";

        const title = widget.content.title || "";
        const desc = widget.content.description || "";
        const btnText = widget.content.button_text;
        const btnUrl = widget.content.button_url;

        let btnHtml = "";
        if (btnText && btnUrl) {
            btnHtml = `<a href="${btnUrl}" target="_blank" class="widgetic-btn" id="widget-btn">${btnText}</a>`;
        }

        let closeHtml = "";
        if (behavior?.showCloseButton) {
            closeHtml = `<div class="widgetic-close">&times;</div>`;
        }

        let brandingHtml = "";
        if (behavior?.showBranding) {
            brandingHtml = `<div class="widgetic-branding">Powered by <a href="${API_BASE}" target="_blank">Widgetic</a></div>`;
        }

        container.innerHTML = `
            <div class="widgetic-card" style="background:${bgColor}; color:${txtColor};">
                ${closeHtml}
                <div class="widgetic-content">
                    <div>
                        ${title ? `<div class="widgetic-title">${title}</div>` : ''}
                        ${desc ? `<div class="widgetic-desc">${desc}</div>` : ''}
                    </div>
                    ${btnHtml}
                </div>
                ${brandingHtml}
            </div>
        `;

        // Attach Events
        const btn = shadow.getElementById("widget-btn");
        if (btn) {
            btn.addEventListener("click", () => {
                trackEvent(widget.id, "click");
            });
            btn.style.backgroundColor = txtColor;
            btn.style.color = bgColor;
        }

        const closeBtn = shadow.querySelector(".widgetic-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                container.classList.remove("visible");
                overlay.classList.remove("visible");
                // Rotation continues via timer
            });
            closeBtn.style.color = txtColor;
        }

        // Close on overlay click for modal
        if (widget.type === "POPUP_MODAL") {
            overlay.onclick = () => {
                container.classList.remove("visible");
                overlay.classList.remove("visible");
            };
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
