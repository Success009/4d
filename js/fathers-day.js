/**
 * ============================================================================
 * Happy Father's Day Celebration Component (कुशे औंसी / बुवाको मुख हेर्ने दिन)
 * Specially crafted for Dad (Rabindra Adhikari - Four Direction Travels & Tours)
 * 
 * Features:
 *  - Opens on the FIRST visit after this update.
 *  - Intelligently detects if an admin login overlay exists; if present, it
 *    patiently waits until after login succeeds before bursting into celebration!
 *  - Saves status in localStorage ('4d_fathers_day_seen_2026') so it never
 *    interrupts daily operations or bothers clients on future visits.
 *  - 100% silent by default (preventing accidental embarrassment in front of clients).
 *    Includes an optional gentle melodic chime button via Web Audio API.
 *  - Instant emergency close button (✕ top-right, Esc key, backdrop click, or Continue button).
 *  - Silky 60fps HTML5 canvas confetti physics with glowing gold & emerald foils.
 *  - Fully responsive across mobile, tablet, and desktop screens.
 *  - Modular and 100% self-contained: remove cleanly anytime by deleting the script tag.
 *  - Can be tested/replayed at any time using: window.replayFathersDay()
 * ============================================================================
 */

(function () {
    'use strict';

    const STORAGE_KEY = '4d_fathers_day_seen_2026';

    // Inject styles
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
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            box-sizing: border-box;
        }

        .fd-overlay * {
            box-sizing: border-box;
        }

        .fd-overlay.active {
            opacity: 1;
            pointer-events: auto;
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
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35),
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

        /* Top decorative accent bar */
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

        /* Emergency Close Button */
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

        /* Badge */
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

        /* Avatar / Icon circle */
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

        /* Title */
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

        /* Heartfelt Body Text */
        .fd-body {
            font-size: 15px;
            line-height: 1.65;
            color: #374151;
            margin: 0 0 22px;
            padding: 0 10px;
        }

        /* Action Buttons */
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

        /* Mobile adjustments */
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

    // Build the modal DOM
    const overlay = document.createElement('div');
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

    // Elements
    const canvas = document.getElementById('fd-confetti-canvas');
    const ctx = canvas.getContext('2d');
    const closeX = document.getElementById('fd-close-x');
    const primaryClose = document.getElementById('fd-primary-close');
    const chimeBtn = document.getElementById('fd-chime-btn');

    // Confetti physics engine
    let confettiParticles = [];
    let animationFrameId = null;
    let isAnimating = false;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    const COLORS = [
        '#10b981', '#059669', '#34d399', // Emerald greens
        '#f59e0b', '#fbbf24', '#fde047', // Warm gold & yellow
        '#ef4444', '#f87171',             // Warm red/coral
        '#3b82f6', '#60a5fa',             // Azure
        '#a855f7', '#ec4899'              // Purple & rose
    ];

    function createParticle(x, y, isBurst = false) {
        const angle = isBurst ? Math.random() * Math.PI * 2 : (Math.PI / 4) + (Math.random() * Math.PI / 2);
        const speed = isBurst ? 4 + Math.random() * 8 : 1 + Math.random() * 3;
        return {
            x: x !== undefined ? x : Math.random() * canvas.width,
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

    function initConfetti() {
        resizeCanvas();
        confettiParticles = [];
        const count = window.innerWidth < 600 ? 70 : 130;
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.42;

        // Radial burst from center
        for (let i = 0; i < count; i++) {
            confettiParticles.push(createParticle(centerX, centerY, true));
        }

        // Additional gentle rain from top
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
        if (!isAnimating) return;
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

    // Gentle Synthesized Audio Chime (Web Audio API - completely optional)
    function playGentleChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            
            // Warm pentatonic arpeggio (C4, E4, G4, B4, C5, E5)
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

            chimeBtn.innerHTML = '<span>🎶</span> <span>Playing...</span>';
            setTimeout(() => {
                chimeBtn.innerHTML = '<span>🎵</span> <span>Play Again</span>';
            }, 1200);
        } catch (e) {
            console.log("Audio chime skipped:", e);
        }
    }

    // Modal Controls
    function openModal() {
        overlay.classList.add('active');
        initConfetti();
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {}
    }

    function closeModal() {
        overlay.classList.remove('active');
        isAnimating = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {}
    }

    // Event Listeners
    closeX.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });

    primaryClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });

    chimeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playGentleChime();
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target === canvas) {
            closeModal();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeModal();
        }
    });

    window.addEventListener('resize', () => {
        if (isAnimating) resizeCanvas();
    });

        // Global helper for manual test or replay
    window.replayFathersDay = function () {
        openModal();
    };

    /**
     * Date Verification:
     * Only triggers on September 11, 2026 (Father's Day / कुशे औंसी).
     * If opened tomorrow or any other date, this will NOT display automatically.
     */
    function isTodayFathersDay() {
        const now = new Date();
        const localMatch = (now.getFullYear() === 2026 && (now.getMonth() + 1) === 9 && now.getDate() === 11);

        // Also check Nepal standard time (UTC+05:45) in case device clock has slight timezone offset
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nepalDate = new Date(utcMs + (345 * 60000));
        const nepalMatch = (nepalDate.getFullYear() === 2026 && (nepalDate.getMonth() + 1) === 9 && nepalDate.getDate() === 11);

        return localMatch || nepalMatch;
    }

    // Auto-trigger logic: Only on September 11, 2026 and only if not previously viewed
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    const isTargetDate = isTodayFathersDay();

    if (!hasSeen && isTargetDate) {
        const attemptTrigger = () => {
            const loginOverlay = document.getElementById('loginOverlay');
            if (loginOverlay) {
                // If login overlay is visible, wait for user to authenticate
                const isOverlayOpen = () => {
                    return loginOverlay.classList.contains('visible') ||
                           getComputedStyle(loginOverlay).display !== 'none';
                };

                if (isOverlayOpen()) {
                    const observer = new MutationObserver(() => {
                        if (!isOverlayOpen()) {
                            observer.disconnect();
                            setTimeout(openModal, 600);
                        }
                    });
                    observer.observe(loginOverlay, { attributes: true, attributeFilter: ['class', 'style'] });
                    return;
                }
            }

            // Normal immediate trigger with smooth entrance
            setTimeout(openModal, 600);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attemptTrigger);
        } else {
            attemptTrigger();
        }
    }

    console.log("%c🎉 Father's Day Tribute loaded. Replay anytime with window.replayFathersDay()", "color: #10b981; font-weight: bold;");
})();
