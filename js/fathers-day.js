/**
 * ============================================================================
 * Happy Father's Day Celebration Component (कुशे औंसी / बुवाको मुख हेर्ने दिन)
 * Specially crafted for Dad (Rabindra Adhikari - Four Direction Travels & Tours)
 * 
 * Reliability & Non-Intrusive Architecture:
 *  1. ZERO DOM INJECTION UNTIL SHOWN: The overlay DOM is NOT present in the body
 *     during normal app use or login. It is only appended to document.body when
 *     actively triggered, and completely removed on close. It is physically
 *     impossible to intercept clicks or block form inputs.
 *  2. AUTH & LOAD SYNCHRONIZATION:
 *     - If on admin application (income.html):
 *       a) Waits for user to log in (!loginOverlay.visible).
 *       b) Waits for all records to finish loading ("All records loaded.").
 *       c) Then triggers the celebration smoothly.
 *     - If on index.html: triggers cleanly after page load.
 *  3. PERSISTENCE:
 *     - Only marks as seen in localStorage AFTER the modal is displayed and closed,
 *       preventing premature lockouts.
 *  4. CLIENT-SAFE (Silent by default):
 *     - No awkward auto-play audio. Includes an optional gentle chime button.
 *  5. QUICK EMERGENCY CLOSE:
 *     - Top-right ✕ button, Esc key, backdrop click, or Continue button.
 *  6. DATE GUARD:
 *     - Automatically checks that today is September 11, 2026.
 *     - Will not auto-trigger tomorrow or later.
 *  7. MANUAL PREVIEW:
 *     - Can be replayed anytime via window.replayFathersDay()
 * ============================================================================
 */

(function () {
    'use strict';

    const STORAGE_KEY = '4d_fathers_day_seen_2026';

    /**
     * Date Check: Only September 11, 2026 (Father's Day / कुशे औंसी in Nepal).
     */
    function isTodayFathersDay() {
        const now = new Date();
        const localMatch = (now.getFullYear() === 2026 && (now.getMonth() + 1) === 9 && now.getDate() === 11);

        // Nepal Standard Time (UTC+05:45)
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nepalDate = new Date(utcMs + (345 * 60000));
        const nepalMatch = (nepalDate.getFullYear() === 2026 && (nepalDate.getMonth() + 1) === 9 && nepalDate.getDate() === 11);

        return localMatch || nepalMatch;
    }

    // Canvas Confetti variables
    let overlay = null;
    let canvas = null;
    let ctx = null;
    let confettiParticles = [];
    let animationFrameId = null;
    let isAnimating = false;

    const COLORS = [
        '#10b981', '#059669', '#34d399', // Emerald greens
        '#f59e0b', '#fbbf24', '#fde047', // Warm gold & yellow
        '#ef4444', '#f87171',             // Coral red
        '#3b82f6', '#60a5fa',             // Sky blue
        '#a855f7', '#ec4899'              // Purple & rose
    ];

    function injectStyles() {
        if (document.getElementById('fathers-day-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'fathers-day-styles';
        styleEl.textContent = `
            .fd-overlay {
                position: fixed;
                inset: 0;
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: rgba(10, 15, 26, 0.78);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                opacity: 0;
                transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                box-sizing: border-box;
            }

            .fd-overlay * {
                box-sizing: border-box;
            }

            .fd-overlay.active {
                opacity: 1;
            }

            .fd-canvas {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
            }

            .fd-card {
                position: relative;
                z-index: 2;
                max-width: 520px;
                width: 100%;
                background: linear-gradient(150deg, #ffffff 0%, #f9fdfa 100%);
                border: 1.5px solid rgba(16, 185, 129, 0.35);
                border-radius: 26px;
                box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.38),
                            0 0 35px rgba(16, 185, 129, 0.2),
                            inset 0 1px 0 rgba(255, 255, 255, 0.9);
                padding: 34px 28px 26px;
                text-align: center;
                transform: scale(0.92) translateY(18px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                            opacity 0.35s ease;
                overflow: hidden;
            }

            .fd-overlay.active .fd-card {
                transform: scale(1) translateY(0);
                opacity: 1;
            }

            .fd-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 5px;
                background: linear-gradient(90deg, #10b981, #059669, #f59e0b, #10b981);
                background-size: 300% 100%;
                animation: fdGradientFlow 5s ease infinite;
            }

            @keyframes fdGradientFlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            .fd-close-btn {
                position: absolute;
                top: 14px;
                right: 14px;
                width: 38px;
                height: 38px;
                border-radius: 50%;
                border: 1px solid #e5e7eb;
                background: #ffffff;
                color: #4b5563;
                font-size: 19px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                z-index: 10;
            }

            .fd-close-btn:hover {
                background: #fee2e2;
                color: #dc2626;
                border-color: #fca5a5;
                transform: scale(1.08);
            }

            .fd-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(16, 185, 129, 0.12);
                color: #047857;
                border: 1px solid rgba(16, 185, 129, 0.25);
                font-size: 13px;
                font-weight: 700;
                padding: 5px 14px;
                border-radius: 100px;
                margin-bottom: 14px;
                letter-spacing: 0.3px;
            }

            .fd-badge .fd-sparkle {
                font-size: 14px;
                animation: fdPulse 1.8s ease-in-out infinite;
            }

            @keyframes fdPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.25); }
            }

            .fd-avatar-box {
                width: 74px;
                height: 74px;
                margin: 0 auto 14px;
                background: linear-gradient(135deg, #10b981 0%, #047857 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
                box-shadow: 0 10px 24px rgba(16, 185, 129, 0.35);
                position: relative;
            }

            .fd-avatar-heart {
                position: absolute;
                bottom: -2px;
                right: -2px;
                background: #ef4444;
                color: white;
                width: 25px;
                height: 25px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            }

            .fd-title {
                font-size: 26px;
                font-weight: 800;
                color: #111827;
                margin: 0 0 4px;
                letter-spacing: -0.02em;
                line-height: 1.25;
            }

            .fd-title .fd-gradient-text {
                background: linear-gradient(135deg, #059669, #10b981);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .fd-nepali-title {
                font-size: 15px;
                font-weight: 700;
                color: #047857;
                margin-bottom: 14px;
                letter-spacing: 0.2px;
            }

            .fd-body {
                font-size: 15px;
                line-height: 1.65;
                color: #374151;
                margin: 0 0 22px;
                padding: 0 10px;
            }

            .fd-actions {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 10px;
            }

            @media (min-width: 480px) {
                .fd-actions {
                    flex-direction: row;
                }
            }

            .fd-btn {
                flex: 1;
                padding: 12px 18px;
                border-radius: 14px;
                font-size: 14.5px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                text-decoration: none;
                outline: none;
            }

            .fd-btn-primary {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
                border: none;
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
            }

            .fd-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
            }

            .fd-btn-chime {
                background: #f3f4f6;
                color: #4b5563;
                border: 1px solid #e5e7eb;
            }

            .fd-btn-chime:hover {
                background: #e5e7eb;
                color: #111827;
            }

            .fd-subtle-hint {
                font-size: 12px;
                color: #9ca3af;
                margin-top: 14px;
                margin-bottom: 0;
            }

            @media (max-width: 480px) {
                .fd-card {
                    padding: 24px 18px 20px;
                    border-radius: 20px;
                }
                .fd-title {
                    font-size: 22px;
                }
                .fd-body {
                    font-size: 14px;
                    line-height: 1.55;
                    padding: 0;
                }
            }
        `;
        document.head.appendChild(styleEl);
    }

    function createParticle(x, y, isBurst = false) {
        const angle = isBurst ? Math.random() * Math.PI * 2 : (Math.PI / 4) + (Math.random() * Math.PI / 2);
        const speed = isBurst ? 4 + Math.random() * 8 : 1 + Math.random() * 3;
        return {
            x: x !== undefined ? x : Math.random() * (canvas ? canvas.width : 500),
            y: y !== undefined ? y : -10,
            vx: Math.cos(angle) * speed,
            vy: isBurst ? Math.sin(angle) * speed - 3 : 2 + Math.random() * 3,
            size: 6 + Math.random() * 8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 8,
            shape: Math.random() > 0.3 ? 'rect' : 'circle',
            opacity: 1,
            gravity: 0.12,
            drag: 0.985
        };
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function initConfetti() {
        resizeCanvas();
        confettiParticles = [];
        const count = window.innerWidth < 600 ? 70 : 130;
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.42;

        for (let i = 0; i < count; i++) {
            confettiParticles.push(createParticle(centerX, centerY, true));
        }
        for (let i = 0; i < count / 2; i++) {
            const p = createParticle();
            p.y = Math.random() * canvas.height * 0.5;
            confettiParticles.push(p);
        }

        if (!isAnimating) {
            isAnimating = true;
            renderConfetti();
        }
    }

    function renderConfetti() {
        if (!isAnimating || !ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = confettiParticles.length - 1; i >= 0; i--) {
            const p = confettiParticles[i];
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotSpeed;

            if (p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) {
                p.opacity -= 0.03;
            }

            if (p.opacity <= 0) {
                confettiParticles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (confettiParticles.length > 0) {
            animationFrameId = requestAnimationFrame(renderConfetti);
        } else {
            isAnimating = false;
        }
    }

    function playGentleChime(btn) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const audioCtx = new AudioCtx();
            
            const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25];
            notes.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.12);
                
                gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + index * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + index * 0.12 + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + index * 0.12 + 0.85);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.start(audioCtx.currentTime + index * 0.12);
                osc.stop(audioCtx.currentTime + index * 0.12 + 0.9);
            });

            if (btn) {
                btn.innerHTML = '<span>🎶</span> <span>Playing...</span>';
                setTimeout(() => {
                    btn.innerHTML = '<span>🎵</span> <span>Play Again</span>';
                }, 1200);
            }
        } catch (e) {
            console.log("Audio chime skipped:", e);
        }
    }

    /**
     * Mounts the modal only when called, ensuring zero interference before then.
     */
    function openModal() {
        if (overlay) return; // already open

        injectStyles();

        overlay = document.createElement('div');
        overlay.className = 'fd-overlay';
        overlay.id = 'fathers-day-overlay';
        overlay.innerHTML = `
            <canvas class="fd-canvas" id="fd-confetti-canvas"></canvas>
            <div class="fd-card" role="dialog" aria-modal="true" aria-labelledby="fd-modal-title">
                <button class="fd-close-btn" id="fd-close-x" aria-label="Close message" title="Emergency Close">✕</button>
                
                <div class="fd-avatar-box">
                    <span>👔</span>
                    <div class="fd-avatar-heart">❤️</div>
                </div>

                <div class="fd-badge">
                    <span class="fd-sparkle">✨</span>
                    <span>Special Tribute for Dad</span>
                </div>

                <h2 class="fd-title" id="fd-modal-title">
                    Happy Father's Day, <span class="fd-gradient-text">Dad!</span>
                </h2>
                <div class="fd-nepali-title">बुवाको मुख हेर्ने दिनको हार्दिक शुभकामना!</div>

                <p class="fd-body">
                    Thank you for your endless dedication, wisdom, and strength in guiding every journey. 
                    Even when miles apart, you inspire everything I do. 
                    Wishing you vibrant health, lasting joy, and boundless success today and always.
                </p>

                <div class="fd-actions">
                    <button class="fd-btn fd-btn-chime" id="fd-chime-btn" title="Play a gentle festive chime">
                        <span>🎵</span> <span>Play Chime</span>
                    </button>
                    <button class="fd-btn fd-btn-primary" id="fd-primary-close">
                        <span>Continue to Four Direction</span> <span>→</span>
                    </button>
                </div>

                <p class="fd-subtle-hint">With endless love & respect · Press ESC or tap anywhere to close</p>
            </div>
        `;
        document.body.appendChild(overlay);

        canvas = document.getElementById('fd-confetti-canvas');
        ctx = canvas.getContext('2d');

        const closeX = document.getElementById('fd-close-x');
        const primaryClose = document.getElementById('fd-primary-close');
        const chimeBtn = document.getElementById('fd-chime-btn');

        closeX.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
        primaryClose.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
        chimeBtn.addEventListener('click', (e) => { e.stopPropagation(); playGentleChime(chimeBtn); });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === canvas) closeModal();
        });

        // Trigger entrance animation next tick
        requestAnimationFrame(() => {
            if (overlay) {
                overlay.classList.add('active');
                initConfetti();
            }
        });
    }

    /**
     * Dismisses the modal, cleans up animation, saves seen state, and removes overlay from DOM.
     */
    function closeModal() {
        if (!overlay) return;

        overlay.classList.remove('active');
        isAnimating = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {}

        setTimeout(() => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            overlay = null;
            canvas = null;
            ctx = null;
        }, 360);
    }

    // Global Key Listener for ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay) {
            closeModal();
        }
    });

    window.addEventListener('resize', () => {
        if (isAnimating) resizeCanvas();
    });

    // Public helper for manual replay or review
    window.replayFathersDay = function () {
        openModal();
    };

    /**
     * Smart Application Synchronization:
     * Waits for authentication and full data loading before displaying.
     */
    function startSynchronization() {
        // Condition 1: Must be Father's Day (Sept 11, 2026)
        if (!isTodayFathersDay()) {
            return;
        }

        // Condition 2: Must not have already seen
        if (localStorage.getItem(STORAGE_KEY)) {
            return;
        }

        const loginOverlay = document.getElementById('loginOverlay');
        const loadingStatus = document.getElementById('loadingStatus');

        // Case 1: Simple page without admin login (e.g. index.html)
        if (!loginOverlay && !loadingStatus) {
            setTimeout(openModal, 700);
            return;
        }

        // Case 2: Admin Application (income.html)
        // Step A: Wait for user to be logged in (loginOverlay visible flag removed)
        function checkAuthThenLoading() {
            const isLoginVisible = () => {
                return loginOverlay && loginOverlay.classList.contains('visible');
            };

            if (isLoginVisible()) {
                // Currently presenting login screen - wait for user to authenticate
                const authObserver = new MutationObserver(() => {
                    if (!isLoginVisible()) {
                        authObserver.disconnect();
                        waitForFullDataLoad();
                    }
                });
                authObserver.observe(loginOverlay, { attributes: true, attributeFilter: ['class'] });
            } else {
                // Not showing login screen (either already authenticated or validating)
                waitForFullDataLoad();
            }
        }

        // Step B: Wait for the application to finish loading all records
        function waitForFullDataLoad() {
            if (!loadingStatus) {
                setTimeout(openModal, 800);
                return;
            }

            const isDataFullyLoaded = () => {
                const text = (loadingStatus.textContent || '').trim();
                const isHidden = loadingStatus.style.display === 'none';
                return text.includes('All records loaded') || (isHidden && text.length > 0);
            };

            if (isDataFullyLoaded()) {
                setTimeout(openModal, 900);
                return;
            }

            // Observe loadingStatus text and style mutations
            const loadObserver = new MutationObserver(() => {
                if (isDataFullyLoaded()) {
                    loadObserver.disconnect();
                    setTimeout(openModal, 900);
                }
            });

            loadObserver.observe(loadingStatus, {
                childList: true,
                characterData: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style']
            });

            // Fallback safety check: verify records present or loading ended
            const fallbackCheck = setInterval(() => {
                const resultsEl = document.getElementById('results');
                const hasResults = resultsEl && resultsEl.children.length > 0;
                if (isDataFullyLoaded() || hasResults) {
                    clearInterval(fallbackCheck);
                    loadObserver.disconnect();
                    setTimeout(openModal, 900);
                }
            }, 1200);
        }

        // Initial delay to let Firebase auth resolve session
        setTimeout(checkAuthThenLoading, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSynchronization);
    } else {
        startSynchronization();
    }

    console.log("%c🎉 Father's Day Tribute initialized. Replay anytime with window.replayFathersDay()", "color: #10b981; font-weight: bold;");
})();
