/* E-Sukan feature extensions: hours, pricing, admin editors, tournament brackets */

let allFacilitiesCache = [];
let facilityCalendarInstance = null;

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
    if (document.getElementById('facilityForm')) {
        document.getElementById('facilityForm').addEventListener('submit', submitFacilityForm);
    }
    if (document.getElementById('campusHoursForm')) {
        document.getElementById('campusHoursForm').addEventListener('submit', submitCampusHours);
    }
    if (document.getElementById('equipmentForm')) {
        document.getElementById('equipmentForm').addEventListener('submit', submitEquipmentForm);
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
        
        try {
            const bookings = await authFetch('/api/bookings/calendar').then(r => r.json());
            renderFacilityCalendar(bookings);
        } catch(e) {
            console.error("Failed to load calendar bookings", e);
        }
    } catch (err) {
        document.getElementById('facilitiesGrid').innerHTML = '<div class="loading-msg">Failed to load facilities</div>';
    }
}

function renderFacilityCalendar(bookings) {
    const calendarEl = document.getElementById('facilityCalendar');
    if (!calendarEl || typeof FullCalendar === 'undefined') return;
    
    if (facilityCalendarInstance) {
        facilityCalendarInstance.destroy();
    }
    
    const events = bookings
        .filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING')
        .map(b => {
            const start = b.bookingDate + 'T' + b.startTime;
            const end = b.bookingDate + 'T' + b.endTime;
            const title = `${b.facility ? b.facility.name : 'Unknown Facility'} - ${b.studentName || 'Student'}`;
            return {
                title: title,
                start: start,
                end: end,
                color: b.status === 'CONFIRMED' ? '#27ae60' : '#f39c12'
            };
        });
        
    facilityCalendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay'
        },
        events: events,
        slotMinTime: '08:00:00',
        slotMaxTime: '23:00:00',
        allDaySlot: false,
        height: 'auto'
    });
    
    facilityCalendarInstance.render();
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
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFeaturesUi);
} else {
    bootFeaturesUi();
}
