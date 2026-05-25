/**
 * Tournament UX fixes (from tournament-fix-cursor-prompt.md).
 * Loaded after features-ui.js and tournament-match-ui.js when source files are locked.
 */
(function () {
    if (window.__esukanTournamentUxFixes) return;
    window.__esukanTournamentUxFixes = true;

    if (!document.querySelector('link[href="/css/tournament-team-match.css"]')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = '/css/tournament-team-match.css';
        document.head.appendChild(l);
    }

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function ensureDetailsShell() {
        const panel = document.getElementById('tournamentPanelDetails');
        if (!panel || document.getElementById('tournamentDetailsForm')) return;
        const children = Array.from(panel.childNodes);
        const formWrap = document.createElement('div');
        formWrap.id = 'tournamentDetailsForm';
        const ro = document.createElement('div');
        ro.id = 'tournamentDetailsReadonly';
        ro.className = 'tournament-details-readonly';
        ro.style.display = 'none';
        panel.insertBefore(ro, panel.firstChild);
        children.forEach(n => formWrap.appendChild(n));
        panel.appendChild(formWrap);
    }

    function ensureRosterEditModal() {
        if (document.getElementById('rosterEditModal')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
<div class="modal" id="rosterEditModal" style="width:480px;max-width:95vw">
    <div class="modal-header">
        <h2 class="modal-title">Edit team roster</h2>
        <button type="button" class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <p class="form-hint" id="rosterEditTeamName" style="margin:0 0 12px"></p>
    <label>Members (name required, email optional)</label>
    <div class="member-rows" id="rosterEditMemberRows"></div>
    <button type="button" class="btn-secondary btn-sm" onclick="addRosterEditRow()">+ Add member</button>
    <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn-primary" id="rosterEditSaveBtn">Save roster</button>
    </div>
</div>`;
        document.body.appendChild(wrap.firstElementChild);
    }

    window.addRosterEditRow = function () {
        document.getElementById('rosterEditMemberRows').insertAdjacentHTML('beforeend',
            `<div class="member-row"><input type="text" class="m-name" placeholder="Name *">
            <input type="email" class="m-email" placeholder="Email (optional)">
            <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()">&#10005;</button></div>`);
    };

    function collectRosterEditRows() {
        const rows = [];
        document.querySelectorAll('#rosterEditMemberRows .member-row').forEach(row => {
            const name = row.querySelector('.m-name')?.value?.trim();
            const email = row.querySelector('.m-email')?.value?.trim();
            if (name) rows.push({ displayName: name, email: email || null });
        });
        return rows;
    }

    function tournamentOpen() {
        return (document.getElementById('tdStatus')?.value || bracketPayload?.status) === 'OPEN';
    }

    function bracketCtaHtml() {
        return `<div class="bracket-cta">
            <strong>Register your team</strong> — find an open slot below (shown as "BYE / TBD") and click <em>Register team</em>.
        </div>`;
    }

    function emptyBracketHtml() {
        return isStudent() && tournamentOpen()
            ? `<div class="bracket-cta">
                   <p><strong>Bracket not generated yet.</strong></p>
                   <p>The organizer will generate the bracket soon. Once it's up, open slots will appear here and you can register your team.</p>
               </div>`
            : '<p class="loading-msg">No bracket yet. Register teams and click Generate bracket.</p>';
    }

    function patchRenderBracket() {
        if (typeof renderBracket !== 'function') return;
        const orig = renderBracket;
        if (orig.__uxPatched) return;
        function patched(container, payload) {
            bracketPayload = payload;
            const matches = payload?.matches || [];
            if (!matches.length) {
                container.innerHTML = emptyBracketHtml();
                return;
            }
            orig(container, payload);
            if (isStudent() && tournamentOpen()) {
                const existing = container.querySelector('.bracket-cta');
                const isWeakHint = existing && existing.textContent.includes('Use Register team');
                if (isWeakHint) existing.remove();
                if (!container.querySelector('.bracket-cta')) {
                    container.insertAdjacentHTML('afterbegin', bracketCtaHtml());
                }
            }
        }
        patched.__uxPatched = true;
        window.renderBracket = patched;
    }

    function patchLoadTournaments() {
        if (typeof loadTournaments !== 'function' || loadTournaments.__uxPatched) return;
        const orig = loadTournaments;
        window.loadTournaments = async function () {
            await orig();
            document.querySelectorAll('#tournamentsTableBody button.btn-confirm').forEach(btn => {
                if (btn.textContent.trim() === 'Register') btn.remove();
            });
        };
        loadTournaments.__uxPatched = true;
    }

    function patchOpenTournamentDetail() {
        if (typeof openTournamentDetail !== 'function' || openTournamentDetail.__uxPatched) return;
        const orig = openTournamentDetail;
        window.openTournamentDetail = async function (id) {
            ensureDetailsShell();
            const t = allTournaments.find(x => x.id === id);
            if (!t) return;
            currentTournamentDetailId = id;
            document.getElementById('tournamentDetailTitle').textContent = t.title;
            const canEdit = isAdmin() || (t.organizer && currentUser && t.organizer.id === currentUser.id);
            const detailsForm = document.getElementById('tournamentDetailsForm');
            const detailsReadonly = document.getElementById('tournamentDetailsReadonly');
            const fmtLabel = (t.format || 'SINGLE_ELIMINATION').replace(/_/g, ' ');
            if (typeof loadFacilitiesForTournamentDetail === 'function') {
                await loadFacilitiesForTournamentDetail();
            }
            if (!canEdit && detailsReadonly && detailsForm) {
                detailsForm.style.display = 'none';
                detailsReadonly.style.display = '';
                detailsReadonly.innerHTML = `
                <dl class="detail-list">
                    <dt>Title</dt><dd>${esc(t.title)}</dd>
                    <dt>Description</dt><dd>${esc(t.description || '—')}</dd>
                    <dt>Dates</dt><dd>${esc(t.startDate)} → ${esc(t.endDate)}</dd>
                    <dt>Format</dt><dd>${esc(fmtLabel)}</dd>
                    <dt>Status</dt><dd><span class="badge badge-gray">${esc(t.status)}</span></dd>
                    <dt>Venue</dt><dd>${esc(t.venueFacility ? t.venueFacility.name : '—')}</dd>
                </dl>`;
            } else if (detailsForm && detailsReadonly) {
                detailsReadonly.style.display = 'none';
                detailsForm.style.display = '';
                document.getElementById('tdTitle').value = t.title;
                document.getElementById('tdDesc').value = t.description || '';
                document.getElementById('tdStart').value = t.startDate;
                document.getElementById('tdEnd').value = t.endDate;
                document.getElementById('tdStatus').value = t.status;
                document.getElementById('tdFormat').value = t.format || 'SINGLE_ELIMINATION';
                document.getElementById('tdVenue').value = t.venueFacility ? t.venueFacility.id : '';
            }
            document.getElementById('tournamentDetailSaveBtn').style.display = canEdit ? '' : 'none';
            document.getElementById('bracketGenerateBtn').style.display = canEdit ? '' : 'none';
            if (isStudent() && t.status === 'OPEN') {
                showTournamentTab('bracket');
            } else {
                showTournamentTab('details');
            }
            await loadTournamentTeams();
            await loadTournamentBracket();
            openModal('tournamentDetailModal');
        };
        openTournamentDetail.__uxPatched = true;
    }

    function patchLoadTournamentTeams() {
        if (typeof loadTournamentTeams !== 'function' || loadTournamentTeams.__uxPatched) return;
        window.loadTournamentTeams = async function () {
            const tbody = document.getElementById('tournamentTeamsBody');
            const head = document.querySelector('#tournamentPanelTeams thead tr');
            if (head) head.innerHTML = '<th>Team</th><th>Email</th><th>Registered by</th><th>Roster</th>';
            try {
                let list = [];
                const regRes = await authFetch(`/api/tournaments/${currentTournamentDetailId}/registrations`);
                if (regRes.ok) {
                    list = await regRes.json();
                } else {
                    const br = await authFetch(`/api/tournaments/${currentTournamentDetailId}/bracket`).then(r => r.json());
                    bracketPayload = br;
                    list = br.registrations || [];
                }
                if (!list.length) {
                    tbody.innerHTML = '<tr><td colspan="4" class="loading-msg">No teams registered yet</td></tr>';
                    return;
                }
                tbody.innerHTML = list.map(r => {
                    const members = r.members || [];
                    const roster = members.length
                        ? `<ul>${members.map(m => `<li>${esc(m.displayName)}${m.email ? ' — ' + esc(m.email) : ''}</li>`).join('')}</ul>`
                        : '<span style="color:#888">—</span>';
                    const isCaptain = isStudent() && currentUser && r.registeredBy?.id === currentUser.id;
                    const editBtn = isCaptain
                        ? `<button type="button" class="btn-secondary btn-sm" onclick="openEditTeamRoster(${r.id})">Edit members</button>`
                        : '';
                    return `<tr>
                        <td>${esc(r.teamName)}</td>
                        <td>${esc(r.contactEmail || '—')}</td>
                        <td>${esc(r.registeredBy?.fullName || '—')}</td>
                        <td>${roster}${editBtn}</td>
                    </tr>`;
                }).join('');
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="4" class="loading-msg">Failed to load teams</td></tr>';
            }
        };
        loadTournamentTeams.__uxPatched = true;
    }

    function patchEditTournamentStatus() {
        if (typeof editTournamentStatus !== 'function' || editTournamentStatus.__uxPatched) return;
        const orig = editTournamentStatus;
        window.editTournamentStatus = async function (id, status) {
            const label = status === 'OPEN' ? 'publish (open for registration)' : 'close (end registration)';
            if (!confirm(`Are you sure you want to ${label} this tournament?`)) return;
            return orig(id, status);
        };
        editTournamentStatus.__uxPatched = true;
    }

    window.openEditTeamRoster = async function (regId) {
        ensureRosterEditModal();
        const team = (bracketPayload?.registrations || []).find(r => r.id === regId);
        const teamName = team?.teamName || 'Team';
        let members = [];
        try {
            members = await authFetch(
                `/api/tournaments/${currentTournamentDetailId}/registrations/${regId}/members`
            ).then(r => r.json());
        } catch (e) {
            showToast('Could not load roster', true);
            return;
        }
        document.getElementById('rosterEditTeamName').textContent = teamName;
        const rows = document.getElementById('rosterEditMemberRows');
        rows.innerHTML = '';
        (members.length ? members : [{ displayName: currentUser?.fullName || '', email: currentUser?.email }])
            .forEach(m => {
                rows.insertAdjacentHTML('beforeend',
                    `<div class="member-row"><input type="text" class="m-name" value="${esc(m.displayName)}">
                    <input type="email" class="m-email" value="${esc(m.email || '')}">
                    <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()">&#10005;</button></div>`);
            });
        if (!members.length) addRosterEditRow();
        document.getElementById('rosterEditSaveBtn').onclick = async function () {
            const roster = collectRosterEditRows();
            if (!roster.length) {
                showToast('Add at least one member', true);
                return;
            }
            if (!confirm(`Update roster for "${teamName}"?`)) return;
            const res = await authFetch(
                `/api/tournaments/${currentTournamentDetailId}/registrations/${regId}/members`,
                { method: 'PUT', body: JSON.stringify({ members: roster }) }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast(data.error || 'Update failed', true);
                return;
            }
            showToast('Roster updated');
            closeModal();
            if (typeof loadTournamentBracket === 'function') await loadTournamentBracket();
            if (typeof loadTournamentTeams === 'function') await loadTournamentTeams();
        };
        openModal('rosterEditModal');
    };

    function boot() {
        ensureDetailsShell();
        ensureRosterEditModal();
        patchLoadTournaments();
        patchOpenTournamentDetail();
        patchLoadTournamentTeams();
        patchEditTournamentStatus();
        patchRenderBracket();
    }

    boot();
    let n = 0;
    const iv = setInterval(() => {
        boot();
        if (++n > 60) clearInterval(iv);
    }, 250);
})();
