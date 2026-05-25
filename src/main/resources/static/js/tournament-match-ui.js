/* Per-match team registration — reliable loader (use if tournament-team-match.js is cached/missing) */
(function () {
    if (window.__esukanMatchRegBooted) return;
    window.__esukanMatchRegBooted = true;

    if (!document.querySelector('link[href="/css/tournament-team-match.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/tournament-team-match.css';
        document.head.appendChild(link);
    }

    let matchRegContext = null;
    let bracketHooksInstalled = false;

    function ensureMatchRegisterModal() {
        if (document.getElementById('matchRegisterModal')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
<div class="modal" id="matchRegisterModal" style="width:520px;max-width:95vw">
    <div class="modal-header">
        <h2 class="modal-title">Register for match</h2>
        <button type="button" class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="match-reg-context" id="matchRegContext"></div>
    <div class="match-reg-tabs">
        <button type="button" class="match-reg-tab active" data-mode="existing" onclick="switchMatchRegTab('existing')">Existing team</button>
        <button type="button" class="match-reg-tab" data-mode="new" onclick="switchMatchRegTab('new')">New team</button>
    </div>
    <div class="match-reg-panel active" id="matchRegPanelExisting">
        <div class="form-group"><label>Your team</label><select id="matchRegExistingTeam"></select></div>
        <div class="roster-preview" id="matchRegExistingPreview">Select a team to preview roster.</div>
    </div>
    <div class="match-reg-panel" id="matchRegPanelNew">
        <div class="form-group"><label>Team name</label><input type="text" id="matchRegTeamName" maxlength="120"></div>
        <div class="form-group"><label>Contact email</label><input type="email" id="matchRegContactEmail"></div>
        <label>Members (name required, email optional)</label>
        <div class="member-rows" id="matchRegMemberRows"></div>
        <button type="button" class="btn-secondary btn-sm" onclick="addMatchRegMemberRow()">+ Add member</button>
    </div>
    <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn-primary" id="matchRegSubmitBtn" onclick="submitMatchRegistration()">Register</button>
    </div>
</div>`;
        const toast = document.getElementById('toast');
        (toast || document.body).appendChild(wrap.firstElementChild);
    }

    function ensureRosterEditModal() {
        if (document.getElementById('rosterEditModal')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
<div class="modal" id="rosterEditModal" style="width:480px;max-width:95vw">
    <div class="modal-header">
        <h2 class="modal-title" id="rosterEditTitle">Edit team roster</h2>
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

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    window.switchMatchRegTab = function (mode) {
        document.querySelectorAll('#matchRegisterModal .match-reg-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
        });
        document.getElementById('matchRegPanelExisting').classList.toggle('active', mode === 'existing');
        document.getElementById('matchRegPanelNew').classList.toggle('active', mode === 'new');
    };

    window.addMatchRegMemberRow = function () {
        document.getElementById('matchRegMemberRows').insertAdjacentHTML('beforeend',
            `<div class="member-row"><input type="text" class="m-name" placeholder="Name *">
            <input type="email" class="m-email" placeholder="Email (optional)">
            <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()">&#10005;</button></div>`);
    };

    function collectMemberRows() {
        const rows = [];
        document.querySelectorAll('#matchRegMemberRows .member-row').forEach(row => {
            const name = row.querySelector('.m-name')?.value?.trim();
            const email = row.querySelector('.m-email')?.value?.trim();
            if (name) rows.push({ displayName: name, email: email || null });
        });
        return rows;
    }

    function tournamentOpen() {
        return (document.getElementById('tdStatus')?.value || bracketPayload?.status) === 'OPEN';
    }

    function slotIsOpen(m, slot) {
        return slot === 'A'
            ? (m.slotAOpen || (m.teamARegistrationId == null && !m.teamAName))
            : (m.slotBOpen || (m.teamBRegistrationId == null && !m.teamBName));
    }

    window.openMatchRegister = async function (matchId, slot, matchLabel) {
        if (!currentTournamentDetailId || !isStudent() || !tournamentOpen()) {
            showToast('Only students can register on OPEN tournaments', true);
            return;
        }
        ensureMatchRegisterModal();
        matchRegContext = { matchId, slot: slot === 'B' ? 'B' : 'A', matchLabel: matchLabel || ('Match ' + matchId), myTeams: [] };
        document.getElementById('matchRegContext').textContent =
            `${document.getElementById('tournamentDetailTitle')?.textContent || 'Tournament'} — ${matchRegContext.matchLabel} — Team ${matchRegContext.slot}`;
        switchMatchRegTab('existing');
        document.getElementById('matchRegTeamName').value = '';
        document.getElementById('matchRegContactEmail').value = currentUser?.email || '';
        const rows = document.getElementById('matchRegMemberRows');
        rows.innerHTML = `<div class="member-row"><input type="text" class="m-name" value="${esc(currentUser?.fullName || '')}">
            <input type="email" class="m-email" value="${esc(currentUser?.email || '')}">
            <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()">&#10005;</button></div>`;
        addMatchRegMemberRow();
        const sel = document.getElementById('matchRegExistingTeam');
        sel.innerHTML = '<option value="">Loading...</option>';
        try {
            const teams = await authFetch(`/api/tournaments/${currentTournamentDetailId}/my-teams`).then(r => r.json());
            matchRegContext.myTeams = Array.isArray(teams) ? teams : [];
            sel.innerHTML = matchRegContext.myTeams.length
                ? '<option value="">— Select —</option>' + matchRegContext.myTeams.map(t => `<option value="${t.id}">${t.teamName}</option>`).join('')
                : '<option value="">No teams — use New team</option>';
            if (!matchRegContext.myTeams.length) switchMatchRegTab('new');
        } catch (e) {
            sel.innerHTML = '<option value="">Failed to load</option>';
        }
        sel.onchange = function () {
            const team = matchRegContext.myTeams.find(t => t.id === Number(sel.value));
            const box = document.getElementById('matchRegExistingPreview');
            if (!team) { box.textContent = 'Select a team to preview roster.'; return; }
            const mem = team.members || [];
            box.innerHTML = mem.length
                ? `<strong>${team.teamName}</strong><ul>${mem.map(m => `<li>${m.displayName}</li>`).join('')}</ul>`
                : `<strong>${team.teamName}</strong><p>No members listed.</p>`;
        };
        openModal('matchRegisterModal');
    };

    window.submitMatchRegistration = async function () {
        const tab = document.querySelector('#matchRegisterModal .match-reg-tab.active')?.dataset.mode || 'existing';
        let body, summary;
        if (tab === 'existing') {
            const regId = Number(document.getElementById('matchRegExistingTeam').value);
            const team = matchRegContext.myTeams.find(t => t.id === regId);
            if (!team) { showToast('Select a team', true); return; }
            body = { slot: matchRegContext.slot, mode: 'existing', registrationId: regId };
            summary = `Register "${team.teamName}" as Team ${matchRegContext.slot}?`;
        } else {
            const teamName = document.getElementById('matchRegTeamName').value.trim();
            const members = collectMemberRows();
            if (!teamName || !members.length) { showToast('Team name and at least one member required', true); return; }
            body = { slot: matchRegContext.slot, mode: 'new', teamName, contactEmail: document.getElementById('matchRegContactEmail').value.trim() || undefined, members };
            summary = `Create "${teamName}" (${members.length} members) for Team ${matchRegContext.slot}?`;
        }
        if (!confirm(summary)) return;
        const res = await authFetch(`/api/tournaments/${currentTournamentDetailId}/matches/${matchRegContext.matchId}/register`,
            { method: 'POST', body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { showToast(data.error || 'Failed', true); return; }
        showToast('Team registered');
        closeModal();
        bracketPayload = data;
        refreshBracketView(data);
        if (typeof loadTournamentTeams === 'function') await loadTournamentTeams();
    };

    function regLink(matchId, slot, label) {
        if (!isStudent() || !tournamentOpen()) return '';
        return ` <a class="bracket-register-link" href="#" onclick="event.preventDefault();openMatchRegister(${matchId},'${slot}',${JSON.stringify(label)})">Register team</a>`;
    }

    function renderBracketWithRegister(container, payload) {
        const matches = payload?.matches || [];
        if (!matches.length) {
            const msg = isStudent() && tournamentOpen()
                ? `<div class="bracket-cta">
                       <p><strong>Bracket not generated yet.</strong></p>
                       <p>The organizer will generate the bracket soon. Once it's up, open slots will appear here and you can register your team.</p>
                   </div>`
                : `<p class="loading-msg">No bracket yet. Register teams and click Generate bracket.</p>`;
            container.innerHTML = msg;
            return;
        }
        const canEdit = document.getElementById('bracketGenerateBtn')?.style.display !== 'none';
        const hint = isStudent() && tournamentOpen()
            ? `<div class="bracket-cta">
                   <strong>Register your team</strong> — find an open slot below (shown as "BYE / TBD") and click <em>Register team</em>.
               </div>` : '';
        if ((payload.format || '') === 'ROUND_ROBIN') {
            container.innerHTML = hint + `<table class="rr-matches-table"><thead><tr><th>Match</th><th>Team A</th><th>Team B</th><th>Winner</th></tr></thead><tbody>
                ${matches.map(m => {
                    const label = m.slotLabel || '#' + m.id;
                    return `<tr><td>${label}</td>
                        <td>${m.teamAName || 'TBD'}${slotIsOpen(m,'A') ? regLink(m.id,'A',label) : ''}</td>
                        <td>${m.teamBName || 'TBD'}${slotIsOpen(m,'B') ? regLink(m.id,'B',label) : ''}</td>
                        <td>${m.winnerName || 'Scheduled'}</td></tr>`;
                }).join('')}</tbody></table>`;
            return;
        }
        const rounds = {};
        matches.forEach(m => { (rounds[m.roundNumber] = rounds[m.roundNumber] || []).push(m); });
        container.innerHTML = hint + `<div class="bracket-columns">${Object.keys(rounds).sort((a,b)=>a-b).map(rn => {
            const list = rounds[rn].sort((a,b) => a.matchIndex - b.matchIndex);
            return `<div class="bracket-round"><div class="bracket-round-title">Round ${rn}</div>${list.map(m => {
                const label = m.slotLabel || 'Match ' + m.id;
                const winSel = canEdit && m.teamARegistrationId && m.teamBRegistrationId && m.status !== 'COMPLETED'
                    ? `<select onchange="recordMatchWinner(${m.id}, this.value)"><option value="">Record winner</option>
                        ${(payload.registrations||[]).filter(r=>r.id===m.teamARegistrationId||r.id===m.teamBRegistrationId)
                            .map(r=>`<option value="${r.id}">${r.teamName}</option>`).join('')}</select>` : '';
                const line = (slot, name) => {
                    const open = slotIsOpen(m, slot);
                    const disp = name || 'BYE / TBD';
                    return `<div class="team-line">${disp}${!name && open ? regLink(m.id, slot, label) : ''}</div>`;
                };
                return `<div class="bracket-match">${line('A', m.teamAName)}${line('B', m.teamBName)}
                    ${m.winnerName ? `<div style="margin-top:4px;color:var(--accent)">Winner: ${m.winnerName}</div>` : ''}${winSel}</div>`;
            }).join('')}</div>`;
        }).join('')}</div>`;
    }

    function refreshBracketView(payload) {
        const c = document.getElementById('bracketContainer');
        if (!c) return;
        if (payload) bracketPayload = payload;
        renderBracketWithRegister(c, bracketPayload || {});
    }

    function installHooks() {
        if (bracketHooksInstalled || typeof loadTournamentBracket !== 'function') return false;
        bracketHooksInstalled = true;
        window.renderBracket = function (container, payload) {
            bracketPayload = payload;
            renderBracketWithRegister(container, payload);
        };
        const origLoad = loadTournamentBracket;
        window.loadTournamentBracket = async function () {
            await origLoad();
            refreshBracketView(bracketPayload);
            if (typeof loadTournamentTeams === 'function') await loadTournamentTeams();
        };
        if (typeof showTournamentTab === 'function') {
            const origTab = showTournamentTab;
            window.showTournamentTab = function (tab) {
                origTab(tab);
                if (tab === 'bracket') refreshBracketView(bracketPayload);
            };
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
                .forEach(m => addRosterEditRowAndFill(m.displayName, m.email));
            if (!members.length) addRosterEditRow();
            document.getElementById('rosterEditSaveBtn').onclick = async function () {
                const roster = collectRosterEditRows();
                if (!roster.length) {
                    showToast('Add at least one member', true);
                    return;
                }
                const summary = `Update roster for "${teamName}"?\n\n` + roster.map(m => '• ' + m.displayName).join('\n');
                if (!confirm(summary)) return;
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

    function addRosterEditRowAndFill(name, email) {
        document.getElementById('rosterEditMemberRows').insertAdjacentHTML('beforeend',
            `<div class="member-row"><input type="text" class="m-name" placeholder="Name *" value="${esc(name || '')}">
            <input type="email" class="m-email" placeholder="Email (optional)" value="${esc(email || '')}">
            <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()">&#10005;</button></div>`);
    }
        return true;
    }

    ensureMatchRegisterModal();
    let n = 0;
    const t = setInterval(() => {
        installHooks();
        if (bracketPayload) refreshBracketView(bracketPayload);
        if (++n > 50 || bracketHooksInstalled) clearInterval(t);
    }, 200);
})();
