function normalizeHouseRuleTarget(rawTarget) {
    const normalized = String(rawTarget || '').replace(/^#/, '').trim();
    if (!normalized) {
        return '';
    }
    return normalized.startsWith('house-rule-') ? normalized : `house-rule-${normalized}`;
}

function openHouseRuleFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const hashTarget = window.location.hash;
    const queryTarget = params.get('rule');
    const targetId = normalizeHouseRuleTarget(hashTarget || queryTarget);
    if (!targetId) {
        return;
    }

    const card = document.getElementById(targetId);
    if (!card) {
        return;
    }

    const details = card.querySelector('details');
    if (details) {
        details.open = true;
    }

    card.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();

            const targetId = normalizeHouseRuleTarget(href);
            if (targetId) {
                const card = document.getElementById(targetId);
                const details = card?.querySelector('details');
                if (details) {
                    details.open = true;
                }
            }

            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add active state to navigation based on scroll position
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('.section, .hero');
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Add fade-in animation for cards when they come into view
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Apply animation to all cards
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    setTimeout(openHouseRuleFromLocation, 0);
});

window.addEventListener('hashchange', openHouseRuleFromLocation);
