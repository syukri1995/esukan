/* E-Sukan feature extensions: hours, pricing, admin editors, tournament brackets */

let currentFacilityDetail = null;
let currentTournamentDetailId = null;
let bracketPayload = null;
let allFacilitiesCache = [];

function fmtTime(t) {
    if (!t) return '—';
    const s = String(t);
    return s.length >= 5 ? s.substring(0, 5) : s;
}

function fmtMoney(n) {
    const v = Number(n || 0);
    return `RM ${v.toFixed(2)}`;
}

function injectFeatureAssets() {
    if (!document.querySelector('link[href="/css/features-ui.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/features-ui.css';
        document.head.appendChild(link);
    }
    if (!document.getElementById('facilityModal')) {
        const wrap = document.createElement('div');
        wrap.id = 'featureModalsRoot';
        wrap.innerHTML = `
<div class="modal" id="facilityModal">
    <div class="modal-header">
        <h2 class="modal-title" id="facilityModalTitle">Add facility</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <form id="facilityForm">
        <input type="hidden" id="fId">
        <div class="form-group"><label>Name</label><input type="text" id="fName" required></div>
        <div class="form-row">
            <div class="form-group"><label>Type</label>
                <select id="fType"><option value="BADMINTON">Badminton</option><option value="FUTSAL">Futsal</option></select>
            </div>
            <div class="form-group"><label>Cost per hour (RM)</label><input type="number" id="fCostPerHour" min="0" step="0.01" value="0"></div>
        </div>
        <div class="form-group"><label>Description</label><input type="text" id="fDesc"></div>
        <div class="form-row">
            <div class="form-group"><label>Open time override</label><input type="time" id="fOpenTime"></div>
            <div class="form-group"><label>Close time override</label><input type="time" id="fCloseTime"></div>
        </div>
        <p class="form-hint">Leave hours empty to use campus default operating hours.</p>
        <div class="form-group"><label><input type="checkbox" id="fActive" checked> Active</label></div>
        <div class="form-group"><label>Equipment at this facility</label><div id="fEquipmentList" class="equipment-checklist"></div></div>
        <div class="form-error" id="facilityError"></div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
        </div>
    </form>
</div>
<div class="modal modal-sm" id="campusHoursModal">
    <div class="modal-header">
        <h2 class="modal-title">Campus operating hours</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <form id="campusHoursForm">
        <div class="form-row">
            <div class="form-group"><label>Default open</label><input type="time" id="campusOpen" value="08:00" required></div>
            <div class="form-group"><label>Default close</label><input type="time" id="campusClose" value="22:00" required></div>
        </div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
        </div>
    </form>
</div>
<div class="modal" id="equipmentModal">
    <div class="modal-header">
        <h2 class="modal-title" id="equipmentModalTitle">Add equipment</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <form id="equipmentForm">
        <input type="hidden" id="eqId">
        <div class="form-group"><label>Name</label><input type="text" id="eqName" required></div>
        <div class="form-row">
            <div class="form-group"><label>Category</label><input type="text" id="eqCategory" required></div>
            <div class="form-group"><label>Quantity</label><input type="number" id="eqQty" min="1" value="1" required></div>
        </div>
        <div class="form-group"><label>Cost per hour (RM)</label><input type="number" id="eqCostPerHour" min="0" step="0.01" value="0"></div>
        <div class="form-group"><label>Description</label><input type="text" id="eqDesc"></div>
        <div class="form-error" id="equipmentError"></div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
        </div>
    </form>
</div>
<div class="modal modal-wide" id="tournamentDetailModal" style="width:720px;max-width:95vw">
    <div class="modal-header">
        <h2 class="modal-title" id="tournamentDetailTitle">Tournament</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="tournament-detail-tabs">
        <button type="button" class="tournament-tab active" data-tab="details" onclick="showTournamentTab('details')">Details</button>
        <button type="button" class="tournament-tab" data-tab="teams" onclick="showTournamentTab('teams')">Teams</button>
        <button type="button" class="tournament-tab" data-tab="bracket" onclick="showTournamentTab('bracket')">Bracket</button>
    </div>
    <div class="tournament-panel active" id="tournamentPanelDetails">
        <div id="tournamentDetailsReadonly" class="tournament-details-readonly" style="display:none"></div>
        <div id="tournamentDetailsForm">
        <div class="form-group"><label>Title</label><input type="text" id="tdTitle"></div>
        <div class="form-group"><label>Description</label><textarea id="tdDesc" rows="2"></textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Start</label><input type="date" id="tdStart"></div>
            <div class="form-group"><label>End</label><input type="date" id="tdEnd"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Format</label>
                <select id="tdFormat"><option value="SINGLE_ELIMINATION">Single elimination</option><option value="ROUND_ROBIN">Round robin</option></select>
            </div>
            <div class="form-group"><label>Status</label>
                <select id="tdStatus"><option value="DRAFT">DRAFT</option><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option><option value="COMPLETED">COMPLETED</option></select>
            </div>
        </div>
        <div class="form-group"><label>Venue</label><select id="tdVenue"></select></div>
        <button type="button" class="btn-primary" id="tournamentDetailSaveBtn">Save details</button>
        </div>
    </div>
    <div class="tournament-panel" id="tournamentPanelTeams">
        <table class="table"><thead><tr><th>Team</th><th>Email</th><th>Registered by</th><th>Roster</th></tr></thead>
        <tbody id="tournamentTeamsBody"><tr><td colspan="4" class="loading-msg">Loading...</td></tr></tbody></table>
    </div>
    <div class="tournament-panel" id="tournamentPanelBracket">
        <button type="button" class="btn-primary" id="bracketGenerateBtn" onclick="generateTournamentBracket()" style="margin-bottom:12px">Generate bracket</button>
        <div id="bracketContainer"><div class="loading-msg">Load bracket tab to view</div></div>
    </div>
</div>`;
        const toast = document.getElementById('toast');
        if (toast) toast.before(wrap);
        else document.body.appendChild(wrap);
    }
    patchEquipmentTableHeader();
}

function patchEquipmentTableHeader() {
    const thead = document.querySelector('#equipmentTable thead tr');
    if (!thead || thead.querySelector('.col-cost-hr')) return;
    const th = document.createElement('th');
    th.className = 'col-cost-hr';
    th.textContent = 'Cost/hr';
    const qtyTh = [...thead.children].find(c => c.textContent.trim() === 'Quantity');
    if (qtyTh && qtyTh.nextElementSibling) {
        thead.insertBefore(th, qtyTh.nextElementSibling);
    } else {
        thead.appendChild(th);
    }
}

function setupFeatureUi() {
    injectFeatureAssets();
    injectFacilitiesAdminToolbar();
    injectEquipmentToolbar();
    patchBookingModal();
    patchRentalModal();
    patchTournamentCreateForm();
    patchTournamentsTableHeader();
    if (document.getElementById('facilityForm')) {
        document.getElementById('facilityForm').addEventListener('submit', submitFacilityForm);
    }
    if (document.getElementById('campusHoursForm')) {
        document.getElementById('campusHoursForm').addEventListener('submit', submitCampusHours);
    }
    if (document.getElementById('equipmentForm')) {
        document.getElementById('equipmentForm').addEventListener('submit', submitEquipmentForm);
    }
    if (document.getElementById('tournamentDetailSaveBtn')) {
        document.getElementById('tournamentDetailSaveBtn').addEventListener('click', saveTournamentDetail);
    }
}

function injectFacilitiesAdminToolbar() {
    const page = document.getElementById('page-facilities');
    if (!page || document.getElementById('facilityAdminToolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'facilityAdminToolbar';
    toolbar.className = 'facility-admin-toolbar';
    toolbar.style.display = 'none';
    toolbar.innerHTML = `
        <button type="button" class="btn-primary" onclick="openFacilityEditor()">+ Add facility</button>
        <button type="button" class="btn-secondary" onclick="openCampusHoursModal()">Campus hours</button>
    `;
    page.querySelector('.page-toolbar').prepend(toolbar);
}

function injectEquipmentToolbar() {
    const page = document.getElementById('page-equipment');
    if (!page || document.getElementById('equipmentAdminToolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'equipmentAdminToolbar';
    toolbar.className = 'page-toolbar equipment-toolbar';
    toolbar.style.display = 'none';
    toolbar.innerHTML = `<button type="button" class="btn-primary" onclick="openEquipmentEditor()">+ Add equipment</button>`;
    page.insertBefore(toolbar, page.querySelector('.page-toolbar'));
}

function updateAdminToolbarsVisibility() {
    const show = typeof isAdmin === 'function' && isAdmin();
    const ft = document.getElementById('facilityAdminToolbar');
    const et = document.getElementById('equipmentAdminToolbar');
    if (ft) ft.style.display = show ? 'flex' : 'none';
    if (et) et.style.display = show ? 'block' : 'none';
}

async function loadFacilities() {
    try {
        allFacilities = await authFetch('/api/facilities').then(r => r.json());
        allFacilitiesCache = allFacilities;
        renderFacilities(allFacilities);
        updateAdminToolbarsVisibility();
    } catch (err) {
        document.getElementById('facilitiesGrid').innerHTML = '<div class="loading-msg">Failed to load facilities</div>';
    }
}

function renderFacilities(list) {
    const grid = document.getElementById('facilitiesGrid');
    if (list.length === 0) {
        grid.innerHTML = '<div class="loading-msg">No facilities found</div>';
        return;
    }
    const admin = typeof isAdmin === 'function' && isAdmin();
    grid.innerHTML = list.map(f => {
        const hours = f.effectiveOpenTime && f.effectiveCloseTime
            ? `${fmtTime(f.effectiveOpenTime)} – ${fmtTime(f.effectiveCloseTime)}`
            : 'Campus default hours';
        return `
        <div class="facility-card">
            <div class="facility-card-icon">${f.type === 'BADMINTON' ? '🏸' : '⚽'}</div>
            <div class="facility-card-name">${f.name}</div>
            <div class="facility-card-desc">${f.description ?? 'No description'}</div>
            <div class="facility-card-rate">${fmtMoney(f.costPerHour)}/hour</div>
            <div class="facility-card-hours">Hours: ${hours}</div>
            <div class="facility-card-meta">
                <span class="badge ${f.type === 'BADMINTON' ? 'badge-blue' : 'badge-orange'}">${f.type}</span>
                <span class="badge ${f.isActive ? 'badge-green' : 'badge-gray'}">${f.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            ${admin ? `<div class="facility-card-actions">
                <button type="button" class="btn-icon" onclick="openFacilityEditor(${f.id})">Edit</button>
                <button type="button" class="btn-icon btn-cancel" onclick="deleteFacility(${f.id})">Delete</button>
            </div>` : ''}
        </div>`;
    }).join('');
}

async function openFacilityEditor(id) {
    if (!isAdmin()) return;
    document.getElementById('facilityError').classList.remove('visible');
    document.getElementById('facilityForm').reset();
    document.getElementById('fId').value = '';
    let equipment = [];
    try {
        equipment = await authFetch('/api/equipment').then(r => r.json());
    } catch (e) { /* ignore */ }

    if (id) {
        document.getElementById('facilityModalTitle').textContent = 'Edit facility';
        const f = await authFetch(`/api/facilities/${id}`).then(r => r.json());
        document.getElementById('fId').value = f.id;
        document.getElementById('fName').value = f.name;
        document.getElementById('fType').value = f.type;
        document.getElementById('fDesc').value = f.description || '';
        document.getElementById('fActive').checked = f.isActive !== false;
        document.getElementById('fOpenTime').value = f.openTime ? fmtTime(f.openTime) : '';
        document.getElementById('fCloseTime').value = f.closeTime ? fmtTime(f.closeTime) : '';
        document.getElementById('fCostPerHour').value = f.costPerHour != null ? f.costPerHour : 0;
        renderEquipmentChecklist(equipment, f.equipmentIds || []);
    } else {
        document.getElementById('facilityModalTitle').textContent = 'Add facility';
        document.getElementById('fActive').checked = true;
        renderEquipmentChecklist(equipment, []);
    }
    openModal('facilityModal');
}

function renderEquipmentChecklist(equipment, selectedIds) {
    const box = document.getElementById('fEquipmentList');
    const set = new Set((selectedIds || []).map(Number));
    box.innerHTML = equipment.map(e => `
        <label><input type="checkbox" value="${e.id}" ${set.has(Number(e.id)) ? 'checked' : ''}> ${e.name}</label>
    `).join('') || '<span class="loading-msg">No equipment</span>';
}

async function submitFacilityForm(e) {
    e.preventDefault();
    const errEl = document.getElementById('facilityError');
    errEl.classList.remove('visible');
    const id = document.getElementById('fId').value;
    const equipmentIds = [...document.querySelectorAll('#fEquipmentList input:checked')].map(cb => Number(cb.value));
    const body = {
        name: document.getElementById('fName').value.trim(),
        type: document.getElementById('fType').value,
        description: document.getElementById('fDesc').value.trim(),
        isActive: document.getElementById('fActive').checked,
        openTime: document.getElementById('fOpenTime').value || null,
        closeTime: document.getElementById('fCloseTime').value || null,
        costPerHour: Number(document.getElementById('fCostPerHour').value) || 0,
        equipmentIds
    };
    const url = id ? `/api/facilities/${id}` : '/api/facilities';
    const method = id ? 'PUT' : 'POST';
    const res = await authFetch(url, { method, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        errEl.textContent = data.error || 'Save failed';
        errEl.classList.add('visible');
        return;
    }
    showToast(id ? 'Facility updated' : 'Facility created');
    closeModal();
    await loadFacilities();
}

async function deleteFacility(id) {
    if (!confirm('Delete this facility?')) return;
    const res = await authFetch(`/api/facilities/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        showToast('Delete failed', true);
        return;
    }
    showToast('Facility deleted');
    await loadFacilities();
}

async function openCampusHoursModal() {
    if (!isAdmin()) return;
    try {
        const h = await authFetch('/api/settings/operating-hours').then(r => r.json());
        document.getElementById('campusOpen').value = fmtTime(h.defaultOpenTime);
        document.getElementById('campusClose').value = fmtTime(h.defaultCloseTime);
    } catch (e) { /* defaults in inputs */ }
    openModal('campusHoursModal');
}

async function submitCampusHours(e) {
    e.preventDefault();
    const res = await authFetch('/api/settings/operating-hours', {
        method: 'PUT',
        body: JSON.stringify({
            defaultOpenTime: document.getElementById('campusOpen').value,
            defaultCloseTime: document.getElementById('campusClose').value
        })
    });
    if (!res.ok) {
        showToast('Failed to save campus hours', true);
        return;
    }
    showToast('Campus hours updated');
    closeModal();
}

async function loadEquipment() {
    const tbody = document.getElementById('equipmentTableBody');
    try {
        allEquipment = await authFetch('/api/equipment').then(r => r.json());
        renderEquipment(allEquipment);
        updateAdminToolbarsVisibility();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">Failed to load equipment</td></tr>';
    }
}

function renderEquipment(list) {
    const tbody = document.getElementById('equipmentTableBody');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">No equipment found</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(e => `
        <tr>
            <td style="color:var(--text3)">#${e.id}</td>
            <td><strong>${e.name}</strong></td>
            <td><span class="badge badge-gray">${e.category}</span></td>
            <td>${equipmentStatusBadge(e.status)}</td>
            <td>${e.quantity}</td>
            <td>${fmtMoney(e.costPerHour)}/hr</td>
            <td style="color:var(--text3);font-size:12px">${formatDateTime(e.lastUpdated)}</td>
            ${isAdmin() ? `
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button type="button" class="btn-icon" onclick="openEquipmentEditor(${e.id})">Edit</button>
                    <button type="button" class="btn-icon" onclick="openStatusModal('equipment', ${e.id})">Status</button>
                    <button type="button" class="btn-icon btn-cancel" onclick="deleteRecord('equipment', ${e.id})">Delete</button>
                </div>
            </td>` : '<td>—</td>'}
        </tr>`).join('');
}

async function openEquipmentEditor(id) {
    if (!isAdmin()) return;
    document.getElementById('equipmentError').classList.remove('visible');
    document.getElementById('equipmentForm').reset();
    document.getElementById('eqId').value = '';
    if (id) {
        document.getElementById('equipmentModalTitle').textContent = 'Edit equipment';
        const e = allEquipment.find(x => x.id === id) || await authFetch(`/api/equipment/${id}`).then(r => r.json());
        document.getElementById('eqId').value = e.id;
        document.getElementById('eqName').value = e.name;
        document.getElementById('eqCategory').value = e.category;
        document.getElementById('eqQty').value = e.quantity;
        document.getElementById('eqDesc').value = e.description || '';
        document.getElementById('eqCostPerHour').value = e.costPerHour != null ? e.costPerHour : 0;
    } else {
        document.getElementById('equipmentModalTitle').textContent = 'Add equipment';
        document.getElementById('eqQty').value = 1;
    }
    openModal('equipmentModal');
}

async function submitEquipmentForm(e) {
    e.preventDefault();
    const errEl = document.getElementById('equipmentError');
    errEl.classList.remove('visible');
    const id = document.getElementById('eqId').value;
    const body = {
        name: document.getElementById('eqName').value.trim(),
        category: document.getElementById('eqCategory').value.trim(),
        quantity: Number(document.getElementById('eqQty').value) || 1,
        description: document.getElementById('eqDesc').value.trim(),
        costPerHour: Number(document.getElementById('eqCostPerHour').value) || 0,
        status: 'AVAILABLE'
    };
    if (id) {
        const existing = allEquipment.find(x => String(x.id) === String(id));
        if (existing) body.status = existing.status;
    }
    const url = id ? `/api/equipment/${id}` : '/api/equipment';
    const method = id ? 'PUT' : 'POST';
    const res = await authFetch(url, { method, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        errEl.textContent = data.error || 'Save failed';
        errEl.classList.add('visible');
        return;
    }
    showToast(id ? 'Equipment updated' : 'Equipment created');
    closeModal();
    await loadEquipment();
}

function patchBookingModal() {
    const form = document.getElementById('bookingForm');
    if (!form || document.getElementById('bookingHoursHint')) return;
    const facilityGroup = form.querySelector('#bFacility').closest('.form-group');
    const hint = document.createElement('p');
    hint.id = 'bookingHoursHint';
    hint.className = 'booking-meta-hint';
    hint.textContent = 'Select a facility to see operating hours.';
    facilityGroup.after(hint);
    const cost = document.createElement('p');
    cost.id = 'bookingCostEstimate';
    cost.className = 'booking-cost-estimate';
    cost.style.display = 'none';
    hint.after(cost);
    document.getElementById('bFacility').addEventListener('change', onBookingFacilityChange);
    document.getElementById('bStartTime').addEventListener('change', updateBookingCostEstimate);
    document.getElementById('bEndTime').addEventListener('change', updateBookingCostEstimate);
}

async function onBookingFacilityChange() {
    const id = document.getElementById('bFacility').value;
    const hint = document.getElementById('bookingHoursHint');
    if (!id) {
        hint.textContent = 'Select a facility to see operating hours.';
        currentFacilityDetail = null;
        updateBookingCostEstimate();
        return;
    }
    try {
        currentFacilityDetail = await authFetch(`/api/facilities/${id}`).then(r => r.json());
        hint.textContent = `Operating hours: ${fmtTime(currentFacilityDetail.effectiveOpenTime)} – ${fmtTime(currentFacilityDetail.effectiveCloseTime)}`;
        const open = fmtTime(currentFacilityDetail.effectiveOpenTime);
        const close = fmtTime(currentFacilityDetail.effectiveCloseTime);
        document.getElementById('bStartTime').min = open;
        document.getElementById('bStartTime').max = close;
        document.getElementById('bEndTime').min = open;
        document.getElementById('bEndTime').max = close;
        updateBookingCostEstimate();
    } catch (e) {
        hint.textContent = 'Could not load facility hours.';
    }
}

function updateBookingCostEstimate() {
    const el = document.getElementById('bookingCostEstimate');
    if (!el || !currentFacilityDetail) {
        if (el) el.style.display = 'none';
        return;
    }
    const start = document.getElementById('bStartTime').value;
    const end = document.getElementById('bEndTime').value;
    if (!start || !end) {
        el.style.display = 'none';
        return;
    }
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) {
        el.style.display = 'none';
        return;
    }
    const hours = mins / 60;
    const rate = Number(currentFacilityDetail.costPerHour || 0);
    el.textContent = `Estimated cost: ${fmtMoney(hours * rate)} (${hours.toFixed(1)}h × ${fmtMoney(rate)}/hr)`;
    el.style.display = 'block';
}

const _openBookingModal = openBookingModal;
async function openBookingModal() {
    await _openBookingModal();
    currentFacilityDetail = null;
    const hint = document.getElementById('bookingHoursHint');
    if (hint) hint.textContent = 'Select a facility to see operating hours.';
    const cost = document.getElementById('bookingCostEstimate');
    if (cost) cost.style.display = 'none';
}

function patchRentalModal() {
    const form = document.getElementById('rentalForm');
    if (!form || document.getElementById('rentalCostEstimate')) return;
    const el = document.createElement('p');
    el.id = 'rentalCostEstimate';
    el.className = 'rental-cost-estimate';
    el.style.display = 'none';
    form.querySelector('.form-row').after(el);
    document.getElementById('rEquipment').addEventListener('change', updateRentalCostEstimate);
    document.getElementById('rQuantity').addEventListener('change', updateRentalCostEstimate);
}

function updateRentalCostEstimate() {
    const el = document.getElementById('rentalCostEstimate');
    const eqId = document.getElementById('rEquipment').value;
    const qty = Number(document.getElementById('rQuantity').value) || 1;
    if (!el || !eqId) {
        if (el) el.style.display = 'none';
        return;
    }
    const eq = allEquipment.find(x => String(x.id) === String(eqId));
    if (!eq) {
        el.style.display = 'none';
        return;
    }
    const rate = Number(eq.costPerHour || 0);
    const est = Math.max(20, rate * qty);
    el.textContent = rate > 0
        ? `Suggested deposit: ${fmtMoney(est)} (${fmtMoney(rate)}/hr × qty ${qty}, min RM 20)`
        : `Default deposit: ${fmtMoney(est)} (min RM 20)`;
    el.style.display = 'block';
}

const _submitBooking = submitBooking;
async function submitBooking(e) {
    const facilityId = document.getElementById('bFacility').value;
    const start = document.getElementById('bStartTime').value;
    const end = document.getElementById('bEndTime').value;
    if (currentFacilityDetail && start && end) {
        const open = fmtTime(currentFacilityDetail.effectiveOpenTime);
        const close = fmtTime(currentFacilityDetail.effectiveCloseTime);
        if (start < open || end > close || start >= end) {
            const errEl = document.getElementById('bookingError');
            errEl.textContent = `Booking must be within operating hours (${open}–${close}) and end after start.`;
            errEl.classList.add('visible');
            e.preventDefault();
            return;
        }
    }
    return _submitBooking(e);
}

const _openRentalModal = openRentalModal;
async function openRentalModal() {
    await _openRentalModal();
    updateRentalCostEstimate();
}

function patchTournamentCreateForm() {
    const form = document.getElementById('tournamentForm');
    if (!form || document.getElementById('tFormat')) return;
    const statusGroup = form.querySelector('#tStatus').closest('.form-group');
    const html = `
    <div class="form-group"><label>Format</label>
        <select id="tFormat"><option value="SINGLE_ELIMINATION">Single elimination</option>
        <option value="ROUND_ROBIN">Round robin</option></select></div>
    <div class="form-group"><label>Venue facility</label>
        <select id="tVenue"><option value="">— None —</option></select></div>`;
    statusGroup.insertAdjacentHTML('beforebegin', html);
}

async function loadFacilitiesForTournamentSelect() {
    try {
        const list = await authFetch('/api/facilities/active').then(r => r.json());
        const sel = document.getElementById('tVenue');
        if (!sel) return;
        sel.innerHTML = '<option value="">— None —</option>' +
            list.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    } catch (e) { /* ignore */ }
}

const _openTournamentModal = openTournamentModal;
async function openTournamentModal() {
    await loadFacilitiesForTournamentSelect();
    await _openTournamentModal();
}

const _submitTournament = submitTournament;
async function submitTournament(e) {
    e.preventDefault();
    const errEl = document.getElementById('tournamentError');
    errEl.classList.remove('visible');
    const venue = document.getElementById('tVenue')?.value;
    const body = {
        title: document.getElementById('tTitle').value.trim(),
        description: document.getElementById('tDesc').value.trim(),
        startDate: document.getElementById('tStart').value,
        endDate: document.getElementById('tEnd').value,
        status: document.getElementById('tStatus').value,
        format: document.getElementById('tFormat')?.value || 'SINGLE_ELIMINATION',
        venueFacilityId: venue ? Number(venue) : null
    };
    const res = await authFetch('/api/tournaments', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        errEl.textContent = data.error || 'Failed';
        errEl.classList.add('visible');
        return;
    }
    showToast('Tournament created');
    closeModal();
    loadTournaments();
}

function patchTournamentsTableHeader() {
    const thead = document.querySelector('#tournamentsTable thead tr');
    if (!thead || thead.querySelector('.col-format')) return;
    const th = document.createElement('th');
    th.className = 'col-format';
    th.textContent = 'Format';
    thead.insertBefore(th, thead.children[2]);
}

async function loadTournaments() {
    const tbody = document.getElementById('tournamentsTableBody');
    try {
        allTournaments = await authFetch('/api/tournaments').then(r => r.json());
        if (allTournaments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">No tournaments</td></tr>';
            return;
        }
        tbody.innerHTML = allTournaments.map(t => {
            const org = t.organizer ? t.organizer.fullName : '—';
            const canEdit = (typeof isLecturer === 'function' && isLecturer()) || isAdmin();
            const fmt = (t.format || 'SINGLE_ELIMINATION').replace('_', ' ');
            return `
            <tr>
                <td><strong>${t.title}</strong></td>
                <td>${t.startDate} → ${t.endDate}</td>
                <td><span class="badge badge-gray">${fmt}</span></td>
                <td><span class="badge badge-gray">${t.status}</span></td>
                <td>${org}</td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button type="button" class="btn-icon" onclick="openTournamentDetail(${t.id})">Open</button>
                        ${canEdit ? `
                            <button type="button" class="btn-icon" onclick="editTournamentStatus(${t.id},'OPEN')">Publish</button>
                            <button type="button" class="btn-icon" onclick="editTournamentStatus(${t.id},'CLOSED')">Close</button>
                            <button type="button" class="btn-icon btn-cancel" onclick="deleteTournament(${t.id})">Delete</button>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
        const tt = document.getElementById('tournamentToolbar');
        if (tt) tt.style.display = canEditToolbar() ? '' : 'none';
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Failed to load</td></tr>';
    }
}

function canEditToolbar() {
    return (typeof isLecturer === 'function' && isLecturer()) || isAdmin();
}

function escTournamentHtml(s) {
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
}

async function loadFacilitiesForTournamentDetail() {
    try {
        const list = await authFetch('/api/facilities/active').then(r => r.json());
        const sel = document.getElementById('tdVenue');
        sel.innerHTML = '<option value="">— None —</option>' +
            list.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    } catch (e) { /* ignore */ }
}

function showTournamentTab(tab) {
    document.querySelectorAll('.tournament-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tournament-panel').forEach(p => p.classList.toggle('active', p.id === `tournamentPanel${tab.charAt(0).toUpperCase() + tab.slice(1)}`));
}

async function loadTournamentTeams() {
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
}

async function loadTournamentBracket() {
    const container = document.getElementById('bracketContainer');
    try {
        bracketPayload = await authFetch(`/api/tournaments/${currentTournamentDetailId}/bracket`).then(r => r.json());
        renderBracket(container, bracketPayload);
    } catch (e) {
        container.innerHTML = '<div class="loading-msg">Failed to load bracket</div>';
    }
}

function renderBracket(container, payload) {
    const matches = payload.matches || [];
    const format = payload.format || 'SINGLE_ELIMINATION';
    if (!matches.length) {
        container.innerHTML = '<p class="loading-msg">No bracket yet. Register teams and click Generate bracket.</p>';
        return;
    }
    if (format === 'ROUND_ROBIN') {
        container.innerHTML = `<table class="rr-matches-table"><thead><tr><th>Match</th><th>Team A</th><th>Team B</th><th>Winner</th></tr></thead><tbody>
            ${matches.map(m => `<tr>
                <td>${m.slotLabel || '#' + m.id}</td>
                <td>${m.teamAName || 'TBD'}</td>
                <td>${m.teamBName || 'TBD'}</td>
                <td>${m.winnerName || (m.status === 'COMPLETED' ? '—' : 'Scheduled')}</td>
            </tr>`).join('')}
        </tbody></table>`;
        return;
    }
    const rounds = {};
    matches.forEach(m => {
        if (!rounds[m.roundNumber]) rounds[m.roundNumber] = [];
        rounds[m.roundNumber].push(m);
    });
    const canEdit = document.getElementById('bracketGenerateBtn').style.display !== 'none';
    container.innerHTML = `<div class="bracket-columns">${Object.keys(rounds).sort((a, b) => a - b).map(rn => {
        const list = rounds[rn].sort((a, b) => a.matchIndex - b.matchIndex);
        return `<div class="bracket-round"><div class="bracket-round-title">Round ${rn}</div>
            ${list.map(m => renderBracketMatch(m, canEdit)).join('')}
        </div>`;
    }).join('')}</div>`;
}

function renderBracketMatch(m, canEdit) {
    const opts = (regId, selected) => {
        if (!bracketPayload.registrations) return '';
        return bracketPayload.registrations.map(r =>
            `<option value="${r.id}" ${Number(selected) === Number(r.id) ? 'selected' : ''}>${r.teamName}</option>`
        ).join('');
    };
    const winnerSelect = canEdit && m.teamARegistrationId && m.teamBRegistrationId && m.status !== 'COMPLETED'
        ? `<select onchange="recordMatchWinner(${m.id}, this.value)"><option value="">Record winner</option>
            ${bracketPayload.registrations.filter(r =>
                r.id === m.teamARegistrationId || r.id === m.teamBRegistrationId
            ).map(r => `<option value="${r.id}">${r.teamName}</option>`).join('')}
           </select>` : '';
    return `<div class="bracket-match">
        <div class="team-line ${m.winnerRegistrationId === m.teamARegistrationId ? 'winner' : ''}">${m.teamAName || 'BYE / TBD'}</div>
        <div class="team-line ${m.winnerRegistrationId === m.teamBRegistrationId ? 'winner' : ''}">${m.teamBName || 'BYE / TBD'}</div>
        ${m.winnerName ? `<div style="margin-top:4px;color:var(--accent)">Winner: ${m.winnerName}</div>` : ''}
        ${winnerSelect}
    </div>`;
}

async function recordMatchWinner(matchId, winnerRegistrationId) {
    if (!winnerRegistrationId) return;
    const res = await authFetch(`/api/tournaments/${currentTournamentDetailId}/matches/${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ winnerRegistrationId: Number(winnerRegistrationId) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        showToast(data.error || 'Failed to record winner', true);
        return;
    }
    showToast('Winner recorded');
    await loadTournamentBracket();
}

async function generateTournamentBracket() {
    const res = await authFetch(`/api/tournaments/${currentTournamentDetailId}/bracket/generate`, {
        method: 'POST',
        body: '{}'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        showToast(data.error || 'Generate failed — need at least 2 teams', true);
        return;
    }
    bracketPayload = data;
    showToast('Bracket generated');
    renderBracket(document.getElementById('bracketContainer'), bracketPayload);
}

async function editTournamentStatus(id, status) {
    const label = status === 'OPEN' ? 'publish (open for registration)' : 'close (end registration)';
    if (!confirm(`Are you sure you want to ${label} this tournament?`)) {
        return;
    }
    try {
        const t = allTournaments.find(x => x.id === id);
        const body = {
            title: t.title,
            description: t.description,
            startDate: t.startDate,
            endDate: t.endDate,
            status,
            format: t.format || 'SINGLE_ELIMINATION',
            venueFacilityId: t.venueFacility ? t.venueFacility.id : null
        };
        await authFetch(`/api/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Tournament updated');
        loadTournaments();
    } catch (err) {
        showToast('Update failed', true);
    }
}

async function saveTournamentDetail() {
    const t = allTournaments.find(x => x.id === currentTournamentDetailId);
    const venue = document.getElementById('tdVenue').value;
    const body = {
        title: document.getElementById('tdTitle').value.trim(),
        description: document.getElementById('tdDesc').value.trim(),
        startDate: document.getElementById('tdStart').value,
        endDate: document.getElementById('tdEnd').value,
        status: document.getElementById('tdStatus').value,
        format: document.getElementById('tdFormat').value,
        venueFacilityId: venue ? Number(venue) : null
    };
    const res = await authFetch(`/api/tournaments/${currentTournamentDetailId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        showToast('Save failed', true);
        return;
    }
    showToast('Tournament saved');
    closeModal();
    loadTournaments();
}

async function viewRegistrations(tournamentId) {
    openTournamentDetail(tournamentId);
    showTournamentTab('teams');
}

function bootFeaturesUi() {
    setupFeatureUi();
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => setTimeout(updateAdminToolbarsVisibility, 50));
    });
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
        const page = activeNav.dataset.page;
        if (page === 'facilities' && typeof loadFacilities === 'function') loadFacilities();
        else if (page === 'equipment' && typeof loadEquipment === 'function') loadEquipment();
        else if (page === 'tournaments' && typeof loadTournaments === 'function') loadTournaments();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFeaturesUi);
} else {
    bootFeaturesUi();
}
