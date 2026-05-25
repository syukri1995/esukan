/**
 * Fixes booking validation when facility effective hours are missing from API JSON.
 * Resolves hours from facility fields, list cache, or campus settings; validates with minute math.
 */
(function () {
    let campusHoursCache = null;

    function normalizeTimeValue(t) {
        if (t == null || t === '') return null;
        if (typeof t === 'object') {
            if (t.hour != null && t.minute != null) {
                return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
            }
        }
        const s = String(t);
        const m = s.match(/(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return `${m[1].padStart(2, '0')}:${m[2]}`;
    }

    async function getCampusHours() {
        if (campusHoursCache) return campusHoursCache;
        try {
            const res = await authFetch('/api/settings/operating-hours');
            const h = await res.json();
            campusHoursCache = {
                open: normalizeTimeValue(h.defaultOpenTime),
                close: normalizeTimeValue(h.defaultCloseTime)
            };
        } catch (e) {
            campusHoursCache = { open: '08:00', close: '22:00' };
        }
        if (!campusHoursCache.open || !campusHoursCache.close) {
            campusHoursCache = { open: '08:00', close: '22:00' };
        }
        return campusHoursCache;
    }

    function hoursFromFacilityObject(f) {
        if (!f) return null;
        let open = normalizeTimeValue(
            f.effectiveOpenTime ?? f.effective_open_time ?? f.openTime ?? f.open_time
        );
        let close = normalizeTimeValue(
            f.effectiveCloseTime ?? f.effective_close_time ?? f.closeTime ?? f.close_time
        );
        if (open && close) return { open, close };
        return null;
    }

    async function resolveBookingHours(facilityId) {
        if (facilityId && typeof allFacilities !== 'undefined' && Array.isArray(allFacilities)) {
            const cached = allFacilities.find(x => String(x.id) === String(facilityId));
            const fromCache = hoursFromFacilityObject(cached);
            if (fromCache) return fromCache;
        }
        if (typeof currentFacilityDetail !== 'undefined' && currentFacilityDetail
            && String(currentFacilityDetail.id) === String(facilityId)) {
            const fromCurrent = hoursFromFacilityObject(currentFacilityDetail);
            if (fromCurrent) return fromCurrent;
        }
        try {
            const f = await authFetch(`/api/facilities/${facilityId}`).then(r => r.json());
            if (typeof currentFacilityDetail !== 'undefined') {
                currentFacilityDetail = f;
            }
            const fromApi = hoursFromFacilityObject(f);
            if (fromApi) return fromApi;
        } catch (e) { /* fall through */ }
        return getCampusHours();
    }

    function timeToMinutes(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    window.isSlotWithinHours = function isSlotWithinHours(start, end, open, close) {
        const s = timeToMinutes(start);
        const e = timeToMinutes(end);
        const o = timeToMinutes(open);
        const c = timeToMinutes(close);
        return e > s && s >= o && e <= c;
    }

    function applyHoursToBookingInputs(hours) {
        const hint = document.getElementById('bookingHoursHint');
        if (hint && hours) {
            hint.textContent = `Operating hours: ${hours.open} – ${hours.close}`;
        }
        if (!hours) return;
        const startEl = document.getElementById('bStartTime');
        const endEl = document.getElementById('bEndTime');
        if (startEl) {
            startEl.min = hours.open;
            startEl.max = hours.close;
        }
        if (endEl) {
            endEl.min = hours.open;
            endEl.max = hours.close;
        }
    }

    async function onFacilityChangeForHours() {
        const id = document.getElementById('bFacility')?.value;
        if (!id) {
            applyHoursToBookingInputs(null);
            const hint = document.getElementById('bookingHoursHint');
            if (hint) hint.textContent = 'Select a facility to see operating hours.';
            if (typeof currentFacilityDetail !== 'undefined') currentFacilityDetail = null;
            return;
        }
        const hours = await resolveBookingHours(id);
        applyHoursToBookingInputs(hours);
        if (typeof currentFacilityDetail !== 'undefined') {
            try {
                currentFacilityDetail = await authFetch(`/api/facilities/${id}`).then(r => r.json());
            } catch (e) { /* keep cached */ }
        }
        if (typeof updateBookingCostEstimate === 'function') {
            updateBookingCostEstimate();
        }
    }

    async function submitBookingWithHours(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const errEl = document.getElementById('bookingError');
        const joinBtn = document.getElementById('joinWaitlistBtn');
        errEl.classList.remove('visible');
        if (joinBtn) joinBtn.style.display = 'none';

        const facilityId = document.getElementById('bFacility').value;
        const start = document.getElementById('bStartTime').value;
        const end = document.getElementById('bEndTime').value;

        if (facilityId && start && end) {
            const hours = await resolveBookingHours(facilityId);
            if (hours && !isSlotWithinHours(start, end, hours.open, hours.close)) {
                errEl.textContent = `Booking must be within operating hours (${hours.open}–${hours.close}) and end after start.`;
                errEl.classList.add('visible');
                return;
            }
        }

        const payload = typeof bookingFormPayload === 'function' ? bookingFormPayload() : null;
        if (!payload) {
            errEl.textContent = 'Invalid booking form';
            errEl.classList.add('visible');
            return;
        }

        try {
            const res = await authFetch('/api/bookings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = data.error ?? 'Booking failed';
                errEl.textContent = msg;
                errEl.classList.add('visible');
                if (joinBtn && msg.toLowerCase().includes('conflict')) {
                    joinBtn.style.display = 'inline-flex';
                }
                return;
            }
            showToast('Booking created successfully!');
            closeModal();
            if (typeof loadBookings === 'function') await loadBookings();
            if (typeof loadWaitlist === 'function') await loadWaitlist();
            if (typeof loadDashboard === 'function') await loadDashboard();
        } catch (err) {
            errEl.textContent = 'Network error. Please try again.';
            errEl.classList.add('visible');
        }
    }

    function wireBookingForm() {
        const form = document.getElementById('bookingForm');
        const facilitySel = document.getElementById('bFacility');
        if (!form) return;

        form.addEventListener('submit', submitBookingWithHours, true);

        if (facilitySel && !facilitySel.dataset.hoursFixWired) {
            facilitySel.dataset.hoursFixWired = '1';
            facilitySel.addEventListener('change', onFacilityChangeForHours);
        }
    }

    window.resolveBookingHours = resolveBookingHours;
    window.onFacilityChangeForHours = onFacilityChangeForHours;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireBookingForm);
    } else {
        wireBookingForm();
    }
})();
