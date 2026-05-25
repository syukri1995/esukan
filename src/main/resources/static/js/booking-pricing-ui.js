/**
 * Professional booking pricing summary with real-time duration × rate updates.
 */
(function () {
    if (!document.querySelector('link[href="/css/booking-pricing.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/booking-pricing.css';
        document.head.appendChild(link);
    }

    function fmtMoney(n) {
        const v = Number(n || 0);
        return `RM ${v.toFixed(2)}`;
    }

    function getFacilityRate(facility) {
        if (!facility) return 0;
        return Number(
            facility.costPerHour
            ?? facility.cost_per_hour
            ?? 0
        );
    }

    function calcDurationHours(start, end) {
        if (!start || !end) return null;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins <= 0) return null;
        return mins / 60;
    }

    function formatDuration(hours) {
        if (hours == null) return '—';
        const totalMins = Math.round(hours * 60);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} hr`;
        return `${h} hr ${m} min`;
    }

    function ensureBookingPricingCard() {
        const form = document.getElementById('bookingForm');
        if (!form) return null;

        let card = document.getElementById('bookingPricingCard');
        if (card) return card;

        const hint = document.getElementById('bookingHoursHint');
        const legacy = document.getElementById('bookingCostEstimate');

        card = document.createElement('div');
        card.id = 'bookingPricingCard';
        card.className = 'booking-pricing-card';
        card.innerHTML = `
            <div class="booking-pricing-header">Pricing summary</div>
            <div class="booking-pricing-rows">
                <div class="booking-pricing-row">
                    <span class="booking-pricing-label">Rate per hour</span>
                    <span class="booking-pricing-value booking-pricing-value--rate" id="bookingRateDisplay">—</span>
                </div>
                <div class="booking-pricing-row">
                    <span class="booking-pricing-label">Duration</span>
                    <span class="booking-pricing-value" id="bookingDurationDisplay">—</span>
                </div>
            </div>
            <div class="booking-pricing-divider"></div>
            <div class="booking-pricing-row booking-pricing-row--total">
                <span class="booking-pricing-total-label">Estimated total</span>
                <span class="booking-pricing-total-value" id="bookingTotalDisplay">RM 0.00</span>
            </div>
            <p class="booking-pricing-hint" id="bookingPricingHint"></p>
        `;

        const timeRow = document.getElementById('bStartTime')?.closest('.form-row');
        if (legacy) {
            legacy.replaceWith(card);
        } else if (timeRow) {
            timeRow.after(card);
        } else if (hint) {
            hint.after(card);
        } else {
            const facilityGroup = form.querySelector('#bFacility')?.closest('.form-group');
            if (facilityGroup) facilityGroup.after(card);
        }

        return card;
    }

    function wireRealtimePricing() {
        const ids = ['bFacility', 'bStartTime', 'bEndTime', 'bDate'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el || el.dataset.pricingWired) return;
            el.dataset.pricingWired = '1';
            el.addEventListener('input', updateBookingCostEstimate);
            el.addEventListener('change', updateBookingCostEstimate);
        });
    }

    window.updateBookingCostEstimate = function updateBookingCostEstimate() {
        const card = ensureBookingPricingCard();
        if (!card) return;

        const rateEl = document.getElementById('bookingRateDisplay');
        const durationEl = document.getElementById('bookingDurationDisplay');
        const totalEl = document.getElementById('bookingTotalDisplay');
        const hintEl = document.getElementById('bookingPricingHint');

        const facilityId = document.getElementById('bFacility')?.value;
        const start = document.getElementById('bStartTime')?.value;
        const end = document.getElementById('bEndTime')?.value;

        let facility = typeof currentFacilityDetail !== 'undefined' ? currentFacilityDetail : null;
        if ((!facility || String(facility.id) !== String(facilityId)) && facilityId
            && typeof allFacilities !== 'undefined' && Array.isArray(allFacilities)) {
            facility = allFacilities.find(f => String(f.id) === String(facilityId)) || facility;
        }

        if (!facilityId || !facility) {
            card.classList.remove('is-visible', 'is-empty');
            card.style.display = 'none';
            return;
        }

        card.style.display = '';
        card.classList.add('is-visible');

        const rate = getFacilityRate(facility);
        if (rateEl) rateEl.textContent = `${fmtMoney(rate)} / hr`;

        if (!start || !end) {
            card.classList.add('is-empty');
            if (durationEl) durationEl.textContent = '—';
            if (totalEl) totalEl.textContent = fmtMoney(0);
            if (hintEl) {
                hintEl.textContent = 'Choose start and end time to calculate your total.';
                hintEl.classList.remove('is-warning');
            }
            return;
        }

        const hours = calcDurationHours(start, end);
        if (hours == null) {
            card.classList.add('is-empty');
            if (durationEl) durationEl.textContent = '—';
            if (totalEl) totalEl.textContent = fmtMoney(0);
            if (hintEl) {
                hintEl.textContent = 'End time must be after start time.';
                hintEl.classList.add('is-warning');
            }
            return;
        }

        card.classList.remove('is-empty');
        const total = hours * rate;
        if (durationEl) durationEl.textContent = formatDuration(hours);
        if (totalEl) totalEl.textContent = fmtMoney(total);
        if (hintEl) {
            hintEl.classList.remove('is-warning');
            if (rate <= 0) {
                hintEl.textContent = 'No hourly charge for this facility — booking is free.';
            } else {
                hintEl.textContent = `Updates automatically as you change times (${hours.toFixed(1)} h × ${fmtMoney(rate)}/hr).`;
            }
        }
    };

    function boot() {
        ensureBookingPricingCard();
        wireRealtimePricing();
        updateBookingCostEstimate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* Re-run when booking modal opens */
    const _origOpen = window.openBookingModal;
    if (typeof _origOpen === 'function') {
        window.openBookingModal = async function () {
            await _origOpen.apply(this, arguments);
            setTimeout(() => {
                updateBookingCostEstimate();
            }, 0);
        };
    }
})();
