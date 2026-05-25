/**
 * Fixes lecturer tournament create: form submit handler, modal open, format/venue fields.
 */
(function () {
    function ensureTournamentFormFields() {
        const form = document.getElementById('tournamentForm');
        if (!form || document.getElementById('tFormat')) return;
        const statusGroup = form.querySelector('#tStatus')?.closest('.form-group');
        if (!statusGroup) return;
        statusGroup.insertAdjacentHTML('beforebegin', `
    <div class="form-group"><label>Format</label>
        <select id="tFormat"><option value="SINGLE_ELIMINATION">Single elimination</option>
        <option value="ROUND_ROBIN">Round robin</option></select></div>
    <div class="form-group"><label>Venue facility</label>
        <select id="tVenue"><option value="">— None —</option></select></div>`);
    }

    async function loadTournamentVenues() {
        try {
            const list = await authFetch('/api/facilities/active').then(r => r.json());
            const sel = document.getElementById('tVenue');
            if (!sel) return;
            sel.innerHTML = '<option value="">— None —</option>' +
                list.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        } catch (e) { /* ignore */ }
    }

    window.openTournamentModal = async function openTournamentModal() {
        ensureTournamentFormFields();
        await loadTournamentVenues();
        const errEl = document.getElementById('tournamentError');
        if (errEl) errEl.classList.remove('visible');
        const form = document.getElementById('tournamentForm');
        if (form) form.reset();
        const today = new Date().toISOString().split('T')[0];
        const tStart = document.getElementById('tStart');
        const tEnd = document.getElementById('tEnd');
        if (tStart) tStart.value = today;
        if (tEnd) tEnd.value = today;
        openModal('tournamentModal');
    };

    async function submitTournamentFixed(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const errEl = document.getElementById('tournamentError');
        if (errEl) errEl.classList.remove('visible');

        const title = document.getElementById('tTitle')?.value?.trim();
        if (!title) {
            if (errEl) {
                errEl.textContent = 'Title is required';
                errEl.classList.add('visible');
            }
            return;
        }

        const venue = document.getElementById('tVenue')?.value;
        const body = {
            title,
            description: document.getElementById('tDesc')?.value?.trim() || '',
            startDate: document.getElementById('tStart')?.value,
            endDate: document.getElementById('tEnd')?.value,
            status: document.getElementById('tStatus')?.value || 'DRAFT',
            format: document.getElementById('tFormat')?.value || 'SINGLE_ELIMINATION',
            venueFacilityId: venue ? Number(venue) : null
        };

        try {
            const res = await authFetch('/api/tournaments', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (errEl) {
                    errEl.textContent = data.error || 'Failed to create tournament';
                    errEl.classList.add('visible');
                }
                showToast(data.error || 'Failed to create tournament', true);
                return;
            }
            showToast('Tournament created');
            closeModal();
            if (typeof loadTournaments === 'function') {
                await loadTournaments();
            }
        } catch (err) {
            if (errEl) {
                errEl.textContent = 'Network error. Please try again.';
                errEl.classList.add('visible');
            }
            showToast('Network error', true);
        }
    }

    window.submitTournament = submitTournamentFixed;

    function showLecturerToolbar() {
        if ((typeof isLecturer === 'function' && isLecturer()) || (typeof isAdmin === 'function' && isAdmin())) {
            const tb = document.getElementById('tournamentToolbar');
            if (tb) tb.style.display = 'flex';
        }
    }

    function wireTournamentForm() {
        ensureTournamentFormFields();
        const form = document.getElementById('tournamentForm');
        if (form && !form.dataset.tournamentFixWired) {
            form.dataset.tournamentFixWired = '1';
            form.addEventListener('submit', submitTournamentFixed, true);
        }
        showLecturerToolbar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireTournamentForm);
    } else {
        wireTournamentForm();
    }

    document.querySelectorAll('.nav-item[data-page="tournaments"]').forEach(el => {
        el.addEventListener('click', () => setTimeout(showLecturerToolbar, 50));
    });
})();
