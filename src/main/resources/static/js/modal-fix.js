/**
 * Fixes infinite recursion in features-ui.js modal wrappers (function hoisting shadowed app.js).
 * Loaded after features-ui.js.
 */
(function () {
    async function openBookingModalFixed(preSelectedFacilityId) {
        try {
            const facilities = await authFetch('/api/facilities/active').then(r => r.json());
            const sel = document.getElementById('bFacility');
            sel.innerHTML = '<option value="">Select a facility...</option>' +
                facilities.map(f => `<option value="${f.id}">${f.name} (${f.type})</option>`).join('');
        } catch (err) {
            console.error(err);
        }

        document.getElementById('bookingError').classList.remove('visible');
        const joinBtn = document.getElementById('joinWaitlistBtn');
        if (joinBtn) {
            joinBtn.style.display = 'none';
        }
        document.getElementById('bookingForm').reset();
        
        if (preSelectedFacilityId) {
            document.getElementById('bFacility').value = preSelectedFacilityId;
        }

        if (typeof setDefaultDates === 'function') {
            setDefaultDates();
        }
        openModal('bookingModal');

        if (typeof currentFacilityDetail !== 'undefined') {
            currentFacilityDetail = null;
        }
        const hint = document.getElementById('bookingHoursHint');
        if (hint) {
            hint.textContent = 'Select a facility to see operating hours.';
        }
        const card = document.getElementById('bookingPricingCard');
        if (card) {
            card.classList.remove('is-visible');
            card.style.display = 'none';
        }
        const legacyCost = document.getElementById('bookingCostEstimate');
        if (legacyCost) legacyCost.style.display = 'none';

        const facilitySel = document.getElementById('bFacility');
        if (facilitySel) {
            if (facilitySel.value) {
                if (typeof onBookingFacilityChange === 'function') {
                    await onBookingFacilityChange();
                } else if (typeof onFacilityChangeForHours === 'function') {
                    await onFacilityChangeForHours();
                }
            }
        }
        if (typeof updateBookingCostEstimate === 'function') {
            updateBookingCostEstimate();
        }
    }

    async function openRentalModalFixed() {
        try {
            const equipment = await authFetch('/api/equipment/status/AVAILABLE').then(r => r.json());
            const sel = document.getElementById('rEquipment');
            sel.innerHTML = '<option value="">Select equipment...</option>' +
                equipment.map(eq => `<option value="${eq.id}">${eq.name} (${eq.quantity} available)</option>`).join('');
        } catch (err) {
            console.error(err);
        }

        document.getElementById('rentalError').classList.remove('visible');
        document.getElementById('rentalForm').reset();
        if (typeof setDefaultDates === 'function') {
            setDefaultDates();
        }
        openModal('rentalModal');

        if (typeof updateRentalCostEstimate === 'function') {
            updateRentalCostEstimate();
        }
    }

    window.openBookingModal = openBookingModalFixed;
    window.openRentalModal = openRentalModalFixed;
})();
