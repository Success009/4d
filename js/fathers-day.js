/**
 * Happy Father's Day Tribute (कुशे औंसी)
 * Clean, lightweight, non-AI aesthetic for Dad.
 */

(function () {
    'use strict';

    const STORAGE_KEY = '4d_fathers_day_seen_2026';

    function isTodayFathersDay() {
        const now = new Date();
        const localMatch = (now.getFullYear() === 2026 && (now.getMonth() + 1) === 9 && now.getDate() === 11);

        // Nepal Standard Time (UTC+05:45)
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nepalDate = new Date(utcMs + (345 * 60000));
        const nepalMatch = (nepalDate.getFullYear() === 2026 && (nepalDate.getMonth() + 1) === 9 && nepalDate.getDate() === 11);

        return localMatch || nepalMatch;
    }

    let overlay = null;
    let canvas = null;
    let ctx = null;
    let particles = [];
    let animId = null;
    let isRunning = false;

    const COLORS = ['#10b981', '#059669', '#f59e0b', '#fbbf24', '#ef4444', '#3b82f6', '#ec4899'];

    function injectStyles() {
        if (document.getElementById('fathers-day-styles')) return;
        const s = document.createElement('style');
        s.id = 'fathers-day-styles';
        s.textContent = `
            .fd-overlay {
                position: fixed;
                inset: 0;
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                opacity: 0;
                transition: opacity 0.25s ease-out;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
                max-width: 420px;
                width: 100%;
                background: #ffffff;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                padding: 36px 28px 30px;
                text-align: center;
                transform: scale(0.95) translateY(10px);
                transition: transform 0.25s ease-out;
            }

            .fd-overlay.active .fd-card {
                transform: scale(1) translateY(0);
            }

            .fd-close-x {
                position: absolute;
                top: 14px;
                right: 14px;
                width: 32px;
                height: 32px;
                border: none;
                background: #f3f4f6;
                color: #6b7280;
                border-radius: 50%;
                font-size: 16px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s ease, color 0.15s ease;
            }

            .fd-close-x:hover {
                background: #fee2e2;
                color: #ef4444;
            }

            .fd-heart-icon {
                font-size: 42px;
                margin-bottom: 12px;
                line-height: 1;
                display: inline-block;
                animation: fdHeartBeat 1.4s infinite ease-in-out;
            }

            @keyframes fdHeartBeat {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.12); }
            }

            .fd-title {
                font-size: 24px;
                font-weight: 700;
                color: #111827;
                margin: 0 0 10px;
                letter-spacing: -0.01em;
            }

            .fd-nepali {
                font-size: 19px;
                font-weight: 600;
                color: #059669;
                margin: 0 0 26px;
                line-height: 1.4;
            }

            .fd-btn {
                display: block;
                width: 100%;
                padding: 12px 20px;
                background: #10b981;
                color: #ffffff;
                border: none;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s ease;
                outline: none;
            }

            .fd-btn:hover {
                background: #059669;
            }

            @media (max-width: 480px) {
                .fd-card {
                    padding: 30px 20px 24px;
                }
                .fd-title {
                    font-size: 21px;
                }
                .fd-nepali {
                    font-size: 17px;
                }
            }
        `;
        document.head.appendChild(s);
    }

    function createParticle(x, y) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        return {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2.5,
            size: 6 + Math.random() * 6,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 8,
            shape: Math.random() > 0.4 ? 'rect' : 'circle',
            opacity: 1,
            gravity: 0.12,
            drag: 0.98
        };
    }

    function initConfetti() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        const count = window.innerWidth < 600 ? 55 : 90;
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.45;

        for (let i = 0; i < count; i++) {
            particles.push(createParticle(cx, cy));
        }

        if (!isRunning) {
            isRunning = true;
            renderConfetti();
        }
    }

    function renderConfetti() {
        if (!isRunning || !ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotSpeed;

            if (p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) {
                p.opacity -= 0.04;
            }

            if (p.opacity <= 0) {
                particles.splice(i, 1);
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

        if (particles.length > 0) {
            animId = requestAnimationFrame(renderConfetti);
        } else {
            isRunning = false;
        }
    }

    function openModal() {
        if (overlay) return;

        injectStyles();

        overlay = document.createElement('div');
        overlay.className = 'fd-overlay';
        overlay.id = 'fathers-day-overlay';
        overlay.innerHTML = `
            <canvas class="fd-canvas" id="fd-confetti-canvas"></canvas>
            <div class="fd-card" role="dialog" aria-modal="true">
                <button class="fd-close-x" id="fd-close-x" aria-label="Close" title="Close">✕</button>
                <div class="fd-heart-icon">❤️</div>
                <h2 class="fd-title">Happy Father's Day, Dad</h2>
                <div class="fd-nepali">कुशे औंसीको धेरै धेरै शुभकामना!</div>
                <button class="fd-btn" id="fd-btn-close">Close</button>
            </div>
        `;
        document.body.appendChild(overlay);

        canvas = document.getElementById('fd-confetti-canvas');
        ctx = canvas.getContext('2d');

        const closeX = document.getElementById('fd-close-x');
        const btnClose = document.getElementById('fd-btn-close');

        closeX.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
        btnClose.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === canvas) closeModal();
        });

        requestAnimationFrame(() => {
            if (overlay) {
                overlay.classList.add('active');
                initConfetti();
            }
        });
    }

    function closeModal() {
        if (!overlay) return;

        overlay.classList.remove('active');
        isRunning = false;
        if (animId) cancelAnimationFrame(animId);

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
        }, 260);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay) closeModal();
    });

    window.addEventListener('resize', () => {
        if (isRunning && canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });

    // Global manual trigger
    window.replayFathersDay = function () {
        openModal();
    };

    /**
     * Trigger synchronization:
     * - Only on Sept 11, 2026.
     * - Only if not already seen.
     * - If on income.html: waits until login overlay is hidden AND data has loaded into the page.
     */
    function init() {
        if (!isTodayFathersDay()) return;
        if (localStorage.getItem(STORAGE_KEY)) return;

        const loginOverlay = document.getElementById('loginOverlay');
        const loadingStatus = document.getElementById('loadingStatus');

        // Simple page without login
        if (!loginOverlay) {
            setTimeout(openModal, 600);
            return;
        }

        // Admin page with login (income.html)
        function checkState() {
            const isLoginActive = loginOverlay && loginOverlay.classList.contains('visible');
            if (isLoginActive) {
                // Wait for login to be completed
                const obs = new MutationObserver(() => {
                    if (!loginOverlay.classList.contains('visible')) {
                        obs.disconnect();
                        waitForData();
                    }
                });
                obs.observe(loginOverlay, { attributes: true, attributeFilter: ['class'] });
            } else {
                // Already authenticated
                waitForData();
            }
        }

        function waitForData() {
            // Check if records or table are already populated
            const results = document.getElementById('results');
            const hasData = results && results.children.length > 0;
            const isFinishedLoading = loadingStatus && (
                (loadingStatus.textContent || '').includes('All records loaded') ||
                (loadingStatus.textContent || '').includes('Loading historical') ||
                loadingStatus.style.display === 'none'
            );

            if (hasData || isFinishedLoading) {
                setTimeout(openModal, 600);
                return;
            }

            // Watch loading status text
            if (loadingStatus) {
                const obs = new MutationObserver(() => {
                    const text = loadingStatus.textContent || '';
                    if (text.includes('Loading historical') || text.includes('All records loaded') || loadingStatus.style.display === 'none') {
                        obs.disconnect();
                        setTimeout(openModal, 600);
                    }
                });
                obs.observe(loadingStatus, { childList: true, characterData: true, subtree: true, attributes: true });

                // Safety timeout: trigger after 2.5s once logged in if data loaded fast
                setTimeout(() => {
                    obs.disconnect();
                    openModal();
                }, 2500);
            } else {
                setTimeout(openModal, 700);
            }
        }

        setTimeout(checkState, 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
