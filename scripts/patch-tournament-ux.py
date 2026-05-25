#!/usr/bin/env python3
"""Apply tournament UX fixes from tournament-fix-cursor-prompt.md"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FE = ROOT / "src/main/resources/static/js/features-ui.js"
TM = ROOT / "src/main/resources/static/js/tournament-match-ui.js"
CSS = ROOT / "src/main/resources/static/css/tournament-team-match.css"
FUI_CSS = ROOT / "src/main/resources/static/css/features-ui.css"


def patch_features_ui(text: str) -> str:
    old_reg = (
        "                        ${isStudent() && t.status === 'OPEN' ? "
        "`<button type=\"button\" class=\"btn-icon btn-confirm\" "
        "onclick=\"openRegisterTeam(${t.id})\">Register</button>` : ''}\n"
    )
    if old_reg in text:
        text = text.replace(old_reg, "")

    old_panel = """    <div class="tournament-panel active" id="tournamentPanelDetails">
        <div class="form-group"><label>Title</label><input type="text" id="tdTitle"></div>"""
    new_panel = """    <div class="tournament-panel active" id="tournamentPanelDetails">
        <div id="tournamentDetailsReadonly" class="tournament-details-readonly" style="display:none"></div>
        <div id="tournamentDetailsForm">
        <div class="form-group"><label>Title</label><input type="text" id="tdTitle"></div>"""
    text = text.replace(old_panel, new_panel)

    text = text.replace(
        '        <button type="button" class="btn-primary" id="tournamentDetailSaveBtn">Save details</button>\n    </div>\n    <div class="tournament-panel" id="tournamentPanelTeams">',
        '        <button type="button" class="btn-primary" id="tournamentDetailSaveBtn">Save details</button>\n        </div>\n    </div>\n    <div class="tournament-panel" id="tournamentPanelTeams">',
    )
    text = text.replace(
        "<thead><tr><th>Team</th><th>Email</th><th>Registered by</th></tr></thead>",
        "<thead><tr><th>Team</th><th>Email</th><th>Registered by</th><th>Roster</th></tr></thead>",
    )
    text = text.replace(
        '<tbody id="tournamentTeamsBody"><tr><td colspan="3" class="loading-msg">Loading...</td></tr></tbody>',
        '<tbody id="tournamentTeamsBody"><tr><td colspan="4" class="loading-msg">Loading...</td></tr></tbody>',
    )

    old_open = """async function openTournamentDetail(id) {
    currentTournamentDetailId = id;
    const t = allTournaments.find(x => x.id === id);
    if (!t) return;
    document.getElementById('tournamentDetailTitle').textContent = t.title;
    await loadFacilitiesForTournamentDetail();
    document.getElementById('tdTitle').value = t.title;
    document.getElementById('tdDesc').value = t.description || '';
    document.getElementById('tdStart').value = t.startDate;
    document.getElementById('tdEnd').value = t.endDate;
    document.getElementById('tdStatus').value = t.status;
    document.getElementById('tdFormat').value = t.format || 'SINGLE_ELIMINATION';
    document.getElementById('tdVenue').value = t.venueFacility ? t.venueFacility.id : '';
    const canEdit = isAdmin() || (t.organizer && currentUser && t.organizer.id === currentUser.id);
    document.getElementById('tournamentDetailSaveBtn').style.display = canEdit ? '' : 'none';
    document.getElementById('bracketGenerateBtn').style.display = canEdit ? '' : 'none';
    ['tdTitle', 'tdDesc', 'tdStart', 'tdEnd', 'tdFormat', 'tdStatus', 'tdVenue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !canEdit;
    });
    showTournamentTab('teams');
    await loadTournamentTeams();
    await loadTournamentBracket();
    openModal('tournamentDetailModal');
}"""

    new_open = """function escTournamentHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

async function openTournamentDetail(id) {
    currentTournamentDetailId = id;
    const t = allTournaments.find(x => x.id === id);
    if (!t) return;
    document.getElementById('tournamentDetailTitle').textContent = t.title;
    await loadFacilitiesForTournamentDetail();
    const canEdit = isAdmin() || (t.organizer && currentUser && t.organizer.id === currentUser.id);
    const detailsForm = document.getElementById('tournamentDetailsForm');
    const detailsReadonly = document.getElementById('tournamentDetailsReadonly');
    const fmtLabel = (t.format || 'SINGLE_ELIMINATION').replace(/_/g, ' ');
    if (!canEdit && detailsReadonly && detailsForm) {
        detailsForm.style.display = 'none';
        detailsReadonly.style.display = '';
        detailsReadonly.innerHTML = `
        <dl class="detail-list">
            <dt>Title</dt><dd>${escTournamentHtml(t.title)}</dd>
            <dt>Description</dt><dd>${escTournamentHtml(t.description || '—')}</dd>
            <dt>Dates</dt><dd>${escTournamentHtml(t.startDate)} → ${escTournamentHtml(t.endDate)}</dd>
            <dt>Format</dt><dd>${escTournamentHtml(fmtLabel)}</dd>
            <dt>Status</dt><dd><span class="badge badge-gray">${escTournamentHtml(t.status)}</span></dd>
            <dt>Venue</dt><dd>${escTournamentHtml(t.venueFacility ? t.venueFacility.name : '—')}</dd>
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
}"""
    text = text.replace(old_open, new_open)

    old_teams = """async function loadTournamentTeams() {
    const tbody = document.getElementById('tournamentTeamsBody');
    try {
        const list = await authFetch(`/api/tournaments/${currentTournamentDetailId}/registrations`).then(r => r.json());
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="loading-msg">No teams registered</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(r => `
            <tr><td>${r.teamName}</td><td>${r.contactEmail || '—'}</td><td>${r.registeredBy?.fullName || '—'}</td></tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading-msg">Failed to load teams</td></tr>';
    }
}"""

    new_teams = """async function loadTournamentTeams() {
    const tbody = document.getElementById('tournamentTeamsBody');
    const head = document.querySelector('#tournamentPanelTeams thead tr');
    if (head) {
        head.innerHTML = '<th>Team</th><th>Email</th><th>Registered by</th><th>Roster</th>';
    }
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
                ? `<ul>${members.map(m => `<li>${escTournamentHtml(m.displayName)}${m.email ? ' — ' + escTournamentHtml(m.email) : ''}</li>`).join('')}</ul>`
                : '<span style="color:var(--color-text-tertiary,#888)">—</span>';
            const isCaptain = isStudent() && currentUser && r.registeredBy?.id === currentUser.id;
            const editBtn = isCaptain
                ? `<button type="button" class="btn-secondary btn-sm" onclick="openEditTeamRoster(${r.id})">Edit members</button>`
                : '';
            return `<tr>
                <td>${escTournamentHtml(r.teamName)}</td>
                <td>${escTournamentHtml(r.contactEmail || '—')}</td>
                <td>${escTournamentHtml(r.registeredBy?.fullName || '—')}</td>
                <td>${roster}${editBtn}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-msg">Failed to load teams</td></tr>';
    }
}"""
    text = text.replace(old_teams, new_teams)

    old_status = """async function editTournamentStatus(id, status) {
    try {
        const t = allTournaments.find(x => x.id === id);"""
    new_status = """async function editTournamentStatus(id, status) {
    const label = status === 'OPEN' ? 'publish (open for registration)' : 'close (end registration)';
    if (!confirm(`Are you sure you want to ${label} this tournament?`)) {
        return;
    }
    try {
        const t = allTournaments.find(x => x.id === id);"""
    text = text.replace(old_status, new_status)
    return text


def patch_tournament_match_ui(text: str) -> str:
    old_empty = """        if (!matches.length) {
            container.innerHTML = '<p class="loading-msg">No bracket yet. Organizer: Generate bracket. Students: register on open slots after that.</p>';
            return;
        }"""
    new_empty = """        if (!matches.length) {
            const msg = isStudent() && tournamentOpen()
                ? `<div class="bracket-cta">
                       <p><strong>Bracket not generated yet.</strong></p>
                       <p>The organizer will generate the bracket soon. Once it's up, open slots will appear here and you can register your team.</p>
                   </div>`
                : `<p class="loading-msg">No bracket yet. Register teams and click Generate bracket.</p>`;
            container.innerHTML = msg;
            return;
        }"""
    text = text.replace(old_empty, new_empty)

    old_hint = """        const hint = isStudent() && tournamentOpen()
            ? '<p class="form-hint" style="margin-bottom:10px">Use <strong>Register team</strong> on BYE / TBD slots.</p>' : '';"""
    new_hint = """        const hint = isStudent() && tournamentOpen()
            ? `<div class="bracket-cta">
                   <strong>Register your team</strong> — find an open slot below (shown as "BYE / TBD") and click <em>Register team</em>.
               </div>` : '';"""
    text = text.replace(old_hint, new_hint)

    # Remove openTournamentDetail override (Fix 1 in features-ui)
    old_hook = """        if (typeof openTournamentDetail === 'function') {
            const orig = openTournamentDetail;
            window.openTournamentDetail = async function (id) {
                await orig(id);
                if (isStudent()) showTournamentTab('bracket');
            };
        }
"""
    text = text.replace(old_hook, "")

    # Remove duplicate loadTournamentTeams override (Fix 7 in features-ui)
    old_teams_hook_start = "        if (typeof loadTournamentTeams === 'function') {\n            window.loadTournamentTeams = async function () {"
    if old_teams_hook_start in text:
        # Find and remove the whole block from "if (typeof loadTournamentTeams" through closing brace before openEditTeamRoster
        import re
        text = re.sub(
            r"        if \(typeof loadTournamentTeams === 'function'\) \{[\s\S]*?        \}\n        window\.openEditTeamRoster",
            "        window.openEditTeamRoster",
            text,
            count=1,
        )

    # Fix 6: roster edit modal
    old_ensure_end = """        (toast || document.body).appendChild(wrap.firstElementChild);
    }"""

    new_ensure = """        (toast || document.body).appendChild(wrap.firstElementChild);
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
    }"""
    text = text.replace(old_ensure_end, new_ensure)

    old_edit = """        window.openEditTeamRoster = async function (regId) {
            ensureMatchRegisterModal();
            const members = await authFetch(`/api/tournaments/${currentTournamentDetailId}/registrations/${regId}/members`).then(r => r.json());
            document.getElementById('matchRegMemberRows').innerHTML = (members.length ? members : [{ displayName: currentUser?.fullName }])
                .map(m => `<div class="member-row"><input class="m-name" value="${esc(m.displayName)}"><input class="m-email" value="${esc(m.email||'')}">
                <button type="button" class="btn-icon" onclick="this.closest('.member-row').remove()">&#10005;</button></div>`).join('');
            document.getElementById('matchRegContext').textContent = 'Edit roster';
            switchMatchRegTab('new');
            document.querySelectorAll('#matchRegisterModal .match-reg-tabs').forEach(el => el.style.display = 'none');
            document.getElementById('matchRegSubmitBtn').textContent = 'Save roster';
            document.getElementById('matchRegSubmitBtn').onclick = async function () {
                const roster = collectMemberRows();
                if (!roster.length || !confirm('Save roster?')) return;
                const res = await authFetch(`/api/tournaments/${currentTournamentDetailId}/registrations/${regId}/members`,
                    { method: 'PUT', body: JSON.stringify({ members: roster }) });
                if (!res.ok) { showToast((await res.json().catch(()=>({}))).error || 'Failed', true); return; }
                showToast('Saved'); closeModal();
                await loadTournamentBracket();
            };
            openModal('matchRegisterModal');
        };"""

    new_edit = """        window.openEditTeamRoster = async function (regId) {
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
                const summary = `Update roster for "${teamName}"?\\n\\n` + roster.map(m => '• ' + m.displayName).join('\\n');
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
    }"""

    text = text.replace(old_edit, new_edit)
    return text


def patch_css(css: str) -> str:
    block = """
.bracket-cta {
    background: var(--color-background-info, #E6F1FB);
    border: 1px solid var(--color-border-info, #85B7EB);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 14px;
    color: var(--color-text-info, #185FA5);
    line-height: 1.5;
}

#rosterEditModal .member-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 12px 0;
}

#rosterEditModal .member-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    align-items: end;
}
"""
    if ".bracket-cta" not in css:
        css += block
    return css


def patch_features_css(css: str) -> str:
    block = """
.detail-list {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 8px 16px;
    font-size: 14px;
}
.detail-list dt {
    color: var(--color-text-secondary, #888);
    font-weight: 500;
}
.detail-list dd {
    margin: 0;
    color: var(--color-text-primary, inherit);
}
"""
    if ".detail-list" not in css:
        css += block
    return css


def main():
    jobs = [
        (FE, patch_features_ui),
        (TM, patch_tournament_match_ui),
        (CSS, patch_css),
        (FUI_CSS, patch_features_css),
    ]
    for path, patcher in jobs:
        t = path.read_text(encoding="utf-8")
        new = patcher(t)
        try:
            path.write_text(new, encoding="utf-8")
            print(f"patched {path.name}")
        except OSError as e:
            print(f"SKIP {path.name} (locked): {e}")
    target = ROOT / "target/classes/static"
    if target.exists():
        import shutil
        for name in ["js/features-ui.js", "js/tournament-match-ui.js", "css/tournament-team-match.css", "css/features-ui.css"]:
            src = ROOT / "src/main/resources/static" / name
            dst = target / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        print("copied to target/classes/static")


if __name__ == "__main__":
    main()
