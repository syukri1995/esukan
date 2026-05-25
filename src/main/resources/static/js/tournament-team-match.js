/* Per-match team registration with roster (students) */
(function () {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/tournament-team-match.css';
    document.head.appendChild(link);

    let matchRegContext = null;

    function ensureMatchRegisterModal() {
        if (document.getElementById('matchRegisterModal')) {
            return;
        }
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
        <div class="form-group">
            <label>Your team</label>
            <select id="matchRegExistingTeam"><option value="">Loading...</option></select>
        </div>
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
        <button type="button" class="btn-primary" onclick="submitMatchRegistration()">Register</button>
    </div>
</div>`;
        const toast = document.getElementById('toast');
        if (toast) {
            toast.before(wrap.firstElementChild);
        } else {
            document.body.appendChild(wrap.firstElementChild);
        }
    }

    window.switchMatchRegTab = function (mode) {
        document.querySelectorAll('#matchRegisterModal .match-reg-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
        });
        document.getElementById('matchRegPanelExisting').classList.toggle('active', mode === 'existing');
        document.getElementById('matchRegPanelNew').classList.toggle('active', mode === 'new');
        matchRegContext = matchRegContext || {};
        matchRegContext.activeTab = mode;
    };

    function memberRowHtml(name, email) {
        return `<div class="member-row">
            <input type="text" placeholder="Name *" class="m-name" value="${escapeAttr(name || '')}">
            <input type="email" placeholder="Email (optional)" class="m-email" value="${escapeAttr(email || '')}">
            <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()" title="Remove">&#10005;</button>
        </div>`;
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    window.addMatchRegMemberRow = function () {
        const box = document.getElementById('matchRegMemberRows');
        box.insertAdjacentHTML('beforeend', memberRowHtml('', ''));
    };

    function collectMemberRows() {
        const rows = [];
        document.querySelectorAll('#matchRegMemberRows .member-row').forEach(row => {
            const name = row.querySelector('.m-name')?.value?.trim();
            const email = row.querySelector('.m-email')?.value?.trim();
            if (name) {
                rows.push({ displayName: name, email: email || null });
            }
        });
        return rows;
    }

    function tournamentOpen() {
        const st = document.getElementById('tdStatus')?.value
            || (typeof bracketPayload !== 'undefined' && bracketPayload?.status);
        return st === 'OPEN';
    }

    window.openMatchRegister = async function (matchId, slot, matchLabel) {
        if (!currentTournamentDetailId || !isStudent() || !tournamentOpen()) {
            return;
        }
        ensureMatchRegisterModal();
        resetMatchRegModalUi();
        matchRegContext = {
            matchId,
            slot: slot === 'B' ? 'B' : 'A',
            matchLabel: matchLabel || ('Match #' + matchId),
            activeTab: 'existing',
            myTeams: []
        };
        const title = document.getElementById('tournamentDetailTitle')?.textContent || 'Tournament';
        document.getElementById('matchRegContext').textContent =
            `${title} — ${matchRegContext.matchLabel} — Team ${matchRegContext.slot}`;
        switchMatchRegTab('existing');
        document.getElementById('matchRegTeamName').value = '';
        document.getElementById('matchRegContactEmail').value = currentUser?.email || '';
        const rows = document.getElementById('matchRegMemberRows');
        rows.innerHTML = memberRowHtml(currentUser?.fullName || '', currentUser?.email || '');
        addMatchRegMemberRow();
        const sel = document.getElementById('matchRegExistingTeam');
        sel.innerHTML = '<option value="">Loading...</option>';
        document.getElementById('matchRegExistingPreview').textContent = 'Select a team to preview roster.';
        try {
            const teams = await authFetch(`/api/tournaments/${currentTournamentDetailId}/my-teams`).then(r => r.json());
            matchRegContext.myTeams = Array.isArray(teams) ? teams : [];
            if (!matchRegContext.myTeams.length) {
                sel.innerHTML = '<option value="">No teams yet — use New team</option>';
                switchMatchRegTab('new');
            } else {
                sel.innerHTML = '<option value="">— Select team —</option>' +
                    matchRegContext.myTeams.map(t =>
                        `<option value="${t.id}">${t.teamName}</option>`).join('');
            }
        } catch (e) {
            sel.innerHTML = '<option value="">Failed to load teams</option>';
        }
        sel.onchange = updateExistingRosterPreview;
        openModal('matchRegisterModal');
    };

    function updateExistingRosterPreview() {
        const id = Number(document.getElementById('matchRegExistingTeam').value);
        const team = (matchRegContext?.myTeams || []).find(t => t.id === id);
        const box = document.getElementById('matchRegExistingPreview');
        if (!team) {
            box.textContent = 'Select a team to preview roster.';
            return;
        }
        const members = team.members || [];
        if (!members.length) {
            box.innerHTML = `<strong>${team.teamName}</strong><p>No members listed.</p>`;
            return;
        }
        box.innerHTML = `<strong>${team.teamName}</strong><ul>${members.map(m =>
            `<li>${m.displayName}${m.email ? ' &lt;' + m.email + '&gt;' : ''}</li>`).join('')}</ul>`;
    }

    window.submitMatchRegistration = async function () {
        if (!matchRegContext || !currentTournamentDetailId) {
            return;
        }
        const tab = document.querySelector('#matchRegisterModal .match-reg-tab.active')?.dataset.mode || 'existing';
        let body;
        let summary;
        if (tab === 'existing') {
            const regId = Number(document.getElementById('matchRegExistingTeam').value);
            const team = (matchRegContext.myTeams || []).find(t => t.id === regId);
            if (!regId || !team) {
                showToast('Select a team', true);
                return;
            }
            body = { slot: matchRegContext.slot, mode: 'existing', registrationId: regId };
            summary = `Register "${team.teamName}" as Team ${matchRegContext.slot} for ${matchRegContext.matchLabel}?`;
        } else {
            const teamName = document.getElementById('matchRegTeamName').value.trim();
            const contactEmail = document.getElementById('matchRegContactEmail').value.trim();
            const members = collectMemberRows();
            if (!teamName) {
                showToast('Team name is required', true);
                return;
            }
            if (!members.length) {
                showToast('Add at least one member', true);
                return;
            }
            body = {
                slot: matchRegContext.slot,
                mode: 'new',
                teamName,
                contactEmail: contactEmail || undefined,
                members
            };
            summary = `Create team "${teamName}" with ${members.length} member(s) as Team ${matchRegContext.slot}?\n\n` +
                members.map(m => '• ' + m.displayName + (m.email ? ' (' + m.email + ')' : '')).join('\n');
        }
        if (!confirm(summary)) {
            return;
        }
        const res = await authFetch(
            `/api/tournaments/${currentTournamentDetailId}/matches/${matchRegContext.matchId}/register`,
            { method: 'POST', body: JSON.stringify(body) }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.error || 'Registration failed', true);
            return;
        }
        showToast('Team registered for match');
        closeModal();
        if (typeof bracketPayload !== 'undefined') {
            bracketPayload = data;
        }
        const container = document.getElementById('bracketContainer');
        if (container && typeof renderBracket === 'function') {
            renderBracket(container, data);
        }
        if (typeof loadTournamentTeams === 'function') {
            await loadTournamentTeams();
        }
    };

    function slotRegisterLink(matchId, slot, label, open) {
        if (!open || !isStudent() || !tournamentOpen()) {
            return '';
        }
        return `<a class="bracket-register-link" href="#" onclick="event.preventDefault();openMatchRegister(${matchId},'${slot}',${JSON.stringify(label)})">Register team</a>`;
    }

    function memberBadge(count) {
        if (!count || count < 1) {
            return '';
        }
        return `<span class="member-badge">(${count} member${count === 1 ? '' : 's'})</span>`;
    }

    function teamLineHtml(name, regId, memberCount, winner, matchId, slot, label, slotOpen) {
        const display = name || 'BYE / TBD';
        const winCls = winner ? ' winner' : '';
        const badge = name ? memberBadge(memberCount) : '';
        const reg = !name && slotOpen ? slotRegisterLink(matchId, slot, label, true) : '';
        return `<div class="team-line${winCls}">${display}${badge}${reg}</div>`;
    }

    if (typeof renderBracketMatch === 'function') {
        const origMatch = renderBracketMatch;
        window.renderBracketMatch = function (m, canEdit) {
            if (isStudent() && tournamentOpen()) {
                const label = m.slotLabel || ('Match ' + m.id);
                const aOpen = m.slotAOpen === true || m.slotAOpen === 'true' || (!m.teamARegistrationId && !m.teamAName);
                const bOpen = m.slotBOpen === true || m.slotBOpen === 'true' || (!m.teamBRegistrationId && !m.teamBName);
                const winnerSelect = canEdit && m.teamARegistrationId && m.teamBRegistrationId && m.status !== 'COMPLETED'
                    ? `<select onchange="recordMatchWinner(${m.id}, this.value)"><option value="">Record winner</option>
                        ${(bracketPayload.registrations || []).filter(r =>
                            r.id === m.teamARegistrationId || r.id === m.teamBRegistrationId
                        ).map(r => `<option value="${r.id}">${r.teamName}</option>`).join('')}
                       </select>` : '';
                return `<div class="bracket-match">
                    ${teamLineHtml(m.teamAName, m.teamARegistrationId, m.teamAMemberCount,
                        m.winnerRegistrationId === m.teamARegistrationId, m.id, 'A', label, aOpen)}
                    ${teamLineHtml(m.teamBName, m.teamBRegistrationId, m.teamBMemberCount,
                        m.winnerRegistrationId === m.teamBRegistrationId, m.id, 'B', label, bOpen)}
                    ${m.winnerName ? `<div style="margin-top:4px;color:var(--accent)">Winner: ${m.winnerName}</div>` : ''}
                    ${winnerSelect}
                </div>`;
            }
            return origMatch(m, canEdit);
        };
    }

    if (typeof renderBracket === 'function') {
        const origBracket = renderBracket;
        window.renderBracket = function (container, payload) {
            if (!payload?.matches?.length) {
                origBracket(container, payload);
                return;
            }
            const format = payload.format || 'SINGLE_ELIMINATION';
            if (format === 'ROUND_ROBIN' && isStudent() && tournamentOpen()) {
                container.innerHTML = `<table class="rr-matches-table"><thead><tr><th>Match</th><th>Team A</th><th>Team B</th><th>Winner</th></tr></thead><tbody>
                    ${payload.matches.map(m => {
                        const label = m.slotLabel || '#' + m.id;
                        const aOpen = m.slotAOpen === true || !m.teamARegistrationId;
                        const bOpen = m.slotBOpen === true || !m.teamBRegistrationId;
                        const aCell = (m.teamAName || 'TBD') + (aOpen ? ' ' + slotRegisterLink(m.id, 'A', label, true) : '') +
                            (m.teamAName ? memberBadge(m.teamAMemberCount) : '');
                        const bCell = (m.teamBName || 'TBD') + (bOpen ? ' ' + slotRegisterLink(m.id, 'B', label, true) : '') +
                            (m.teamBName ? memberBadge(m.teamBMemberCount) : '');
                        return `<tr>
                            <td>${label}</td>
                            <td>${aCell}</td>
                            <td>${bCell}</td>
                            <td>${m.winnerName || (m.status === 'COMPLETED' ? '—' : 'Scheduled')}</td>
                        </tr>`;
                    }).join('')}
                </tbody></table>`;
                return;
            }
            origBracket(container, payload);
        };
    }

    if (typeof loadTournamentTeams === 'function') {
        const origTeams = loadTournamentTeams;
        window.loadTournamentTeams = async function () {
            const tbody = document.getElementById('tournamentTeamsBody');
            if (!tbody) {
                return;
            }
            let list = [];
            try {
                if (typeof bracketPayload !== 'undefined' && bracketPayload?.registrations?.length) {
                    list = bracketPayload.registrations;
                } else {
                    const res = await authFetch(`/api/tournaments/${currentTournamentDetailId}/registrations`);
                    if (res.ok) {
                        list = await res.json();
                    } else if (typeof bracketPayload !== 'undefined') {
                        const br = await authFetch(`/api/tournaments/${currentTournamentDetailId}/bracket`).then(r => r.json());
                        bracketPayload = br;
                        list = br.registrations || [];
                    }
                }
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="4" class="loading-msg">Failed to load teams</td></tr>';
                return;
            }
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="loading-msg">No teams registered yet</td></tr>';
                return;
            }
            const head = document.querySelector('#tournamentPanelTeams thead tr');
            if (head && head.children.length < 4) {
                head.innerHTML = '<th>Team</th><th>Email</th><th>Registered by</th><th>Roster</th>';
            }
            tbody.innerHTML = list.map(r => {
                const members = r.members || [];
                const roster = members.length
                    ? `<ul>${members.map(m => `<li>${m.displayName}${m.email ? ' — ' + m.email : ''}</li>`).join('')}</ul>`
                    : '<span class="text-muted">—</span>';
                const isCaptain = isStudent() && currentUser && r.registeredBy && r.registeredBy.id === currentUser.id;
                const editBtn = isCaptain
                    ? `<button type="button" class="btn-secondary btn-sm" onclick="openEditTeamRoster(${r.id})">Edit members</button>`
                    : '';
                return `<tr>
                    <td>${r.teamName}</td>
                    <td>${r.contactEmail || '—'}</td>
                    <td>${r.registeredBy?.fullName || '—'}</td>
                    <td><div class="tournament-teams-roster">${roster}</div>${editBtn}</td>
                </tr>`;
            }).join('');
        };
    }

    window.openEditTeamRoster = async function (regId) {
        ensureMatchRegisterModal();
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
        const rows = document.getElementById('matchRegMemberRows');
        rows.innerHTML = '';
        (members.length ? members : [{ displayName: currentUser?.fullName || '', email: currentUser?.email }])
            .forEach(m => rows.insertAdjacentHTML('beforeend', memberRowHtml(m.displayName, m.email)));
        document.getElementById('matchRegContext').textContent = `Edit roster — ${teamName}`;
        document.querySelectorAll('#matchRegisterModal .match-reg-tabs').forEach(el => el.style.display = 'none');
        document.getElementById('matchRegPanelExisting').classList.remove('active');
        document.getElementById('matchRegPanelNew').classList.add('active');
        document.getElementById('matchRegPanelNew').querySelectorAll('.form-group').forEach((el, i) => {
            if (i < 2) el.style.display = 'none';
        });
        matchRegContext = { editRegId: regId, teamName };
        const submitBtn = document.querySelector('#matchRegisterModal .btn-primary');
        submitBtn.textContent = 'Save roster';
        submitBtn.onclick = async function () {
            const roster = collectMemberRows();
            if (!roster.length) {
                showToast('Add at least one member', true);
                return;
            }
            const summary = `Update roster for "${teamName}"?\n\n` +
                roster.map(m => '• ' + m.displayName).join('\n');
            if (!confirm(summary)) {
                return;
            }
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
            resetMatchRegModalUi();
            if (typeof loadTournamentBracket === 'function') {
                await loadTournamentBracket();
            }
            await loadTournamentTeams();
        };
        openModal('matchRegisterModal');
    };

    function resetMatchRegModalUi() {
        document.querySelectorAll('#matchRegisterModal .match-reg-tabs').forEach(el => el.style.display = '');
        document.getElementById('matchRegPanelNew').querySelectorAll('.form-group').forEach(el => {
            el.style.display = '';
        });
        const submitBtn = document.querySelector('#matchRegisterModal .btn-primary');
        submitBtn.textContent = 'Register';
        submitBtn.onclick = submitMatchRegistration;
        switchMatchRegTab('existing');
    }

    const origClose = typeof closeModal === 'function' ? closeModal : null;
    if (origClose) {
        window.closeModal = function () {
            resetMatchRegModalUi();
            origClose();
        };
    }

    if (typeof loadTournamentBracket === 'function') {
        const origLoad = loadTournamentBracket;
        window.loadTournamentBracket = async function () {
            await origLoad();
            if (typeof loadTournamentTeams === 'function') {
                await loadTournamentTeams();
            }
        };
    }

    if (typeof generateTournamentBracket === 'function') {
        const origGen = generateTournamentBracket;
        window.generateTournamentBracket = async function () {
            await origGen();
            if (typeof loadTournamentTeams === 'function') {
                await loadTournamentTeams();
            }
        };
    }

    ensureMatchRegisterModal();
})();
