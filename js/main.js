// ==================== NAVIGATION ====================
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Scroll effect
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile menu toggle
navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Close menu on link click
navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    });
});

// ==================== MOBILE CTA BAR ====================
const mobileCta = document.getElementById('mobileCta');
const bookSection = document.getElementById('book');

if (mobileCta && bookSection) {
    const observer = new IntersectionObserver(
        ([entry]) => {
            // Show mobile CTA when booking section is NOT visible
            if (window.innerWidth <= 768) {
                mobileCta.style.display = entry.isIntersecting ? 'none' : 'flex';
            }
        },
        { threshold: 0.1 }
    );
    observer.observe(bookSection);

    // Initial check
    if (window.innerWidth > 768) {
        mobileCta.style.display = 'none';
    }
}

// ==================== SMOOTH SCROLL ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            const offset = navbar.offsetHeight + 16;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ==================== BOOKING TABS ====================
document.querySelectorAll('.booking-tab').forEach(tab => {
    tab.addEventListener('click', function () {
        const parent = this.closest('.booking-tabs').parentElement;

        // Deactivate all tabs and content in this group
        parent.querySelectorAll('.booking-tab').forEach(t => t.classList.remove('active'));
        parent.querySelectorAll('.booking-tab-content').forEach(c => c.classList.remove('active'));

        // Activate clicked tab and matching content
        this.classList.add('active');
        const target = parent.querySelector('#tab-' + this.dataset.tab);
        if (target) target.classList.add('active');
    });
});

// ==================== FORM HANDLING ====================
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = bookingForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = 'Submitting...';
        submitBtn.disabled = true;

        const formData = new FormData(bookingForm);
        const data = Object.fromEntries(formData.entries());

        try {
            // Send to backend API
            const response = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.errors ? result.errors.join(', ') : 'Submission failed');
            }

            // Show success state
            bookingForm.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin-bottom: 16px;">
                        <circle cx="32" cy="32" r="30" fill="#22c55e" opacity="0.1"/>
                        <circle cx="32" cy="32" r="24" fill="#22c55e" opacity="0.2"/>
                        <path d="M20 32l8 8 16-16" stroke="#22c55e" stroke-width="3" fill="none" stroke-linecap="round"/>
                    </svg>
                    <h3 style="color: #6B1014; margin-bottom: 8px;">Request Received</h3>
                    <p style="color: #6b7280; font-size: 0.95rem;">
                        Thank you, <strong>${data.fullName}</strong>. We will be in touch within 2 hours to confirm your inspection appointment.
                    </p>
                    <p style="color: #6b7280; font-size: 0.85rem; margin-top: 12px;">
                        Check your email at <strong>${data.email}</strong> for a confirmation.
                    </p>
                </div>
            `;

            // Track conversion (replace with real analytics)
            if (typeof gtag !== 'undefined') {
                gtag('event', 'form_submission', {
                    event_category: 'booking',
                    event_label: data.serviceType
                });
            }

        } catch (error) {
            console.error('Form submission error:', error);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            alert('There was an error submitting your request. Please try calling us directly.');
        }
    });
}

// ==================== SCROLL ANIMATIONS ====================
const animateOnScroll = () => {
    const elements = document.querySelectorAll(
        '.risk-card, .step-card, .service-card, .finding-card, .review-card, .brand-card, .checklist-item'
    );

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
};

// Run after DOM loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateOnScroll);
} else {
    animateOnScroll();
}

// ==================== CONTACT FORM HANDLING ====================
const contactForm = document.querySelector('.contact-form-direct form');
if (contactForm) {
    // Photo preview (optional file input)
    const photoInput = contactForm.querySelector('#contactPhoto');
    const photoPreview = contactForm.querySelector('#contactPhotoPreview');
    if (photoInput && photoPreview) {
        photoInput.addEventListener('change', () => {
            const file = photoInput.files && photoInput.files[0];
            if (!file) { photoPreview.style.display = 'none'; photoPreview.innerHTML = ''; return; }
            if (file.size > 5 * 1024 * 1024) {
                alert('Photo is larger than 5 MB. Please choose a smaller file.');
                photoInput.value = ''; photoPreview.style.display = 'none'; photoPreview.innerHTML = ''; return;
            }
            const url = URL.createObjectURL(file);
            photoPreview.innerHTML = '<img src="' + url + '" alt="Preview" style="max-width:160px;max-height:120px;border-radius:6px;border:1px solid #e5e7eb;">';
            photoPreview.style.display = 'block';
        });
    }

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = 'Sending...';
        submitBtn.disabled = true;

        // Use FormData throughout so optional photo travels as multipart
        const formData = new FormData(contactForm);
        const photoFile = photoInput && photoInput.files && photoInput.files[0];
        if (!photoFile) formData.delete('photo'); // don't send empty file
        const name = formData.get('name');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.errors ? result.errors.join(', ') : 'Submission failed');

            contactForm.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin-bottom: 16px;">
                        <circle cx="32" cy="32" r="30" fill="#22c55e" opacity="0.1"/>
                        <circle cx="32" cy="32" r="24" fill="#22c55e" opacity="0.2"/>
                        <path d="M20 32l8 8 16-16" stroke="#22c55e" stroke-width="3" fill="none" stroke-linecap="round"/>
                    </svg>
                    <h3 style="color: #6B1014; margin-bottom: 8px;">Message Sent</h3>
                    <p style="color: #6b7280; font-size: 0.95rem;">
                        Thank you, <strong>${name}</strong>. We will get back to you within 2 hours.
                    </p>
                </div>
            `;
        } catch (error) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            alert('There was an error sending your message. Please try calling us directly on 01442 601 383.');
        }
    });
}

// ==================== POSTCODE LOOKUP (Postcodes.io) ====================
const postcodeInput = document.getElementById('postcode');
if (postcodeInput) {
    const postcodeStatus = document.getElementById('postcodeStatus');
    const addressGroup = document.getElementById('addressGroup');
    const townCountyRow = document.getElementById('townCountyRow');
    const townInput = document.getElementById('town');
    const countyInput = document.getElementById('county');

    postcodeInput.addEventListener('blur', async function () {
        const val = this.value.trim().toUpperCase();
        const ukPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

        if (!val) {
            postcodeStatus.style.display = 'none';
            this.style.borderColor = '';
            this.setCustomValidity('');
            return;
        }

        if (!ukPostcode.test(val)) {
            this.style.borderColor = '#e74c3c';
            this.setCustomValidity('Please enter a valid UK postcode');
            postcodeStatus.textContent = 'Please enter a valid UK postcode';
            postcodeStatus.style.color = '#e74c3c';
            postcodeStatus.style.display = 'block';
            return;
        }

        // Look up via Postcodes.io
        postcodeStatus.textContent = 'Looking up address...';
        postcodeStatus.style.color = '#6b7280';
        postcodeStatus.style.display = 'block';

        try {
            const res = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(val));
            const data = await res.json();

            if (data.status === 200 && data.result) {
                const r = data.result;
                townInput.value = r.admin_district || r.admin_ward || '';
                countyInput.value = r.admin_county || r.region || '';
                addressGroup.style.display = 'block';
                townCountyRow.style.display = 'grid';
                this.style.borderColor = '#22c55e';
                this.setCustomValidity('');
                postcodeStatus.textContent = 'Address found \u2014 enter your street address below';
                postcodeStatus.style.color = '#22c55e';
            } else {
                this.style.borderColor = '#e74c3c';
                this.setCustomValidity('Postcode not found');
                postcodeStatus.textContent = 'Postcode not found \u2014 please check and try again';
                postcodeStatus.style.color = '#e74c3c';
            }
        } catch {
            // If API fails, still show address fields for manual entry
            addressGroup.style.display = 'block';
            townCountyRow.style.display = 'grid';
            this.style.borderColor = '';
            this.setCustomValidity('');
            postcodeStatus.textContent = 'Could not look up address \u2014 please enter manually';
            postcodeStatus.style.color = '#6b7280';
        }
    });
}
