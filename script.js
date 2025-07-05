document.addEventListener('DOMContentLoaded', () => {

    // --- GSAP & Animation Setup ---
    gsap.config({
        nullTargetWarn: false
    });

    // --- Header Scroll Effect ---
    const header = document.getElementById('main-header');
    const headerTitle = document.getElementById('header-title');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileMenuButton = document.getElementById('mobile-menu-button');

    const handleScroll = () => {
        const isScrolled = window.scrollY > 10;
        header.classList.toggle('scrolled', isScrolled);
        header.classList.toggle('bg-white', isScrolled);
        header.classList.toggle('shadow-md', isScrolled);
        header.classList.toggle('bg-transparent', !isScrolled);

        headerTitle.classList.toggle('text-white', !isScrolled);
        headerTitle.classList.toggle('text-gray-800', isScrolled);

        mobileMenuButton.classList.toggle('text-white', !isScrolled);
        mobileMenuButton.classList.toggle('text-gray-800', isScrolled);

        navLinks.forEach(link => {
            link.classList.toggle('text-gray-200', !isScrolled);
            link.classList.toggle('hover:text-white', !isScrolled);
            link.classList.toggle('text-gray-600', isScrolled);
            link.classList.toggle('hover:text-green-600', isScrolled);
        });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // --- Mobile Menu Toggle ---
    const mobileMenu = document.getElementById('mobile-menu');
    const openIcon = document.getElementById('mobile-menu-open-icon');
    const closeIcon = document.getElementById('mobile-menu-close-icon');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    mobileMenuButton.addEventListener('click', () => {
        const isMenuOpen = !mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden');
        openIcon.classList.toggle('hidden', !isMenuOpen);
        closeIcon.classList.toggle('hidden', isMenuOpen);
    });
    
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            openIcon.classList.remove('hidden');
            closeIcon.classList.add('hidden');
        });
    });

    // --- Advanced Reveal Animations ---
    const revealElements = document.querySelectorAll('[data-reveal]');

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const revealType = el.dataset.reveal;
                
                if (revealType === 'lines') {
                    gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.2 });
                } else if (revealType === 'item') {
                    const staggerIndex = parseInt(el.style.getPropertyValue('--stagger-index')) || 0;
                    gsap.to(el, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.1 + staggerIndex * 0.1 });
                } else if (revealType === 'group') {
                    gsap.to(el.children, {
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        ease: 'power2.out',
                        stagger: 0.2,
                        delay: 0.2
                    });
                }
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.1 });

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // --- Hero Intro Animation ---
    const heroTimeline = gsap.timeline({ delay: 0.2 });
    heroTimeline
        .to('[data-reveal="lines"]', { y: 0, opacity: 1, stagger: 0.2, duration: 1, ease: 'power3.out' })
        .to('[data-reveal="group"] > *', { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power2.out' }, "-=0.5");


    // --- 3D Interactive Service Cards ---
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const rotateX = -y / 20; // rotation around X-axis
            const rotateY = x / 20;  // rotation around Y-axis

            gsap.to(card, {
                rotationX: rotateX,
                rotationY: rotateY,
                scale: 1.05,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                duration: 0.5,
                ease: 'power2.out'
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                rotationX: 0,
                rotationY: 0,
                scale: 1,
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                duration: 0.7,
                ease: 'elastic.out(1, 0.5)'
            });
        });
    });

});