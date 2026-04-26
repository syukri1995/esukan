// =============================================
// E-SUKAN — Frontend Application Logic
// =============================================

const API = '';  // Spring Boot serves static files, so no prefix needed

// ---- State ----
let allBookings = [];
let allEquipment = [];
let allFacilities = [];
let allRentals = [];
let currentStatusTarget = null;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    loadDashboard();
    setDefaultDates();

    document.getElementById('bookingForm').addEventListener('submit', submitBooking);
    document.getElementById('rentalForm').addEventListener('submit', submitRental);
});

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bDate').value = today;
    document.getElementById('rDate').value = today;
}

// ---- Navigation ----
function initNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Update title
    const titles = {
        dashboard: 'Dashboard',
        facilities: 'Facilities',
        bookings: 'Bookings',
        equipment: 'Equipment',
        rentals: 'Rentals'
    };
    document.getElementById('pageTitle').textContent = titles[page];

    // Update action button
    const btn = document.getElementById('topbarActionBtn');
    if (page === 'rentals') {
        btn.textContent = '+ New Rental';
    } else {
        btn.textContent = '+ New Booking';
    }

    // Lazy load page data
    switch (page) {
        case 'dashboard':  loadDashboard(); break;
        case 'facilities': loadFacilities(); break;
        case 'bookings':   loadBookings(); break;
        case 'equipment':  loadEquipment(); break;
        case 'rentals':    loadRentals(); break;
    }
}

function openPrimaryAction() {
    const activePage = document.querySelector('.nav-item.active')?.dataset.page;
    if (activePage === 'rentals') {
        openRentalModal();
    } else {
        openBookingModal();
    }
}

// =============================================
// DASHBOARD
// =============================================
async function loadDashboard() {
    try {
        const [stats, healthReport, todayBookings] = await Promise.all([
            fetch(`${API}/api/bookings/dashboard`).then(r => r.json()),
            fetch(`${API}/api/equipment/health-report`).then(r => r.json()),
            fetch(`${API}/api/bookings/date/${new Date().toISOString().split('T')[0]}`).then(r => r.json())
        ]);

        // Stats
        document.getElementById('stat-total').textContent = stats.totalBookings ?? 0;
        document.getElementById('stat-today').textContent = stats.todayBookings ?? 0;
        document.getElementById('stat-pending').textContent = stats.pendingBookings ?? 0;

        // Equipment health
        const unhealthy = (healthReport.damaged ?? 0) + (healthReport.inMaintenance ?? 0);
        document.getElementById('stat-unhealthy').textContent = unhealthy;

        const total = (healthReport.available ?? 0) + (healthReport.damaged ?? 0) + (healthReport.inMaintenance ?? 0);
        renderHealthBars(healthReport, total);

        // Today's table
        renderTodayTable(todayBookings);

        // Load facilities for peak hours selector
        loadFacilitiesForSelect();

    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function renderHealthBars(report, total) {
    const container = document.getElementById('healthBars');
    if (total === 0) { container.innerHTML = '<div class="loading-msg">No equipment data</div>'; return; }

    const items = [
        { label: 'Available',       count: report.available ?? 0,      cls: 'bar-green'  },
        { label: 'Damaged',         count: report.damaged ?? 0,         cls: 'bar-red'    },
        { label: 'In Maintenance',  count: report.inMaintenance ?? 0,   cls: 'bar-orange' },
    ];

    container.innerHTML = items.map(item => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return `
            <div class="health-item">
                <div class="health-label">
                    <span>${item.label}</span>
                    <span>${item.count} items (${pct}%)</span>
                </div>
                <div class="health-bar-track">
                    <div class="health-bar-fill ${item.cls}" style="width:${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

async function loadFacilitiesForSelect() {
    try {
        const facilities = await fetch(`${API}/api/facilities/active`).then(r => r.json());
        const sel = document.getElementById('peakFacilitySelect');
        sel.innerHTML = '<option value="">Select facility...</option>' +
            facilities.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    } catch (err) { console.error(err); }
}

async function loadPeakHours() {
    const facilityId = document.getElementById('peakFacilitySelect').value;
    const container = document.getElementById('peakChart');
    if (!facilityId) { container.innerHTML = '<div class="loading-msg">Select a facility to view peak hours</div>'; return; }

    try {
        const data = await fetch(`${API}/api/bookings/peak-hours/${facilityId}`).then(r => r.json());
        const entries = Object.entries(data);

        if (entries.length === 0) {
            container.innerHTML = '<div class="loading-msg">No booking data for this facility yet</div>';
            return;
        }

        const maxCount = Math.max(...entries.map(([, v]) => v));
        container.innerHTML = entries.map(([time, count]) => {
            const pct = Math.round((count / maxCount) * 100);
            const label = formatTime(time);
            return `
                <div class="peak-bar-row">
                    <div class="peak-time">${label}</div>
                    <div class="peak-bar-wrap">
                        <div class="peak-bar-inner" style="width:${pct}%">${count}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = '<div class="loading-msg">Error loading data</div>';
    }
}

function renderTodayTable(bookings) {
    const tbody = document.getElementById('todayTableBody');
    document.getElementById('todayCount').textContent = `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`;

    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">No bookings today</td></tr>';
        return;
    }

    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${b.studentName}</td>
            <td><span style="color:var(--text2)">${b.studentId}</span></td>
            <td>${b.facility?.name ?? '—'}</td>
            <td>${formatTime(b.startTime)} – ${formatTime(b.endTime)}</td>
            <td>${statusBadge(b.status)}</td>
            <td>
                ${b.status === 'PENDING' ? `
                    <button class="btn-icon btn-confirm" onclick="quickStatus(${b.id}, 'CONFIRMED', 'bookings')">✓ Confirm</button>
                    <button class="btn-icon btn-cancel" onclick="quickStatus(${b.id}, 'CANCELLED', 'bookings')">✕ Cancel</button>
                ` : '—'}
            </td>
        </tr>`).join('');
}

// =============================================
// FACILITIES
// =============================================
async function loadFacilities() {
    try {
        allFacilities = await fetch(`${API}/api/facilities`).then(r => r.json());
        renderFacilities(allFacilities);
    } catch (err) {
        document.getElementById('facilitiesGrid').innerHTML = '<div class="loading-msg">Failed to load facilities</div>';
    }
}

function renderFacilities(list) {
    const grid = document.getElementById('facilitiesGrid');
    if (list.length === 0) { grid.innerHTML = '<div class="loading-msg">No facilities found</div>'; return; }

    grid.innerHTML = list.map(f => `
        <div class="facility-card">
            <div class="facility-card-icon">${f.type === 'BADMINTON' ? '🏸' : '⚽'}</div>
            <div class="facility-card-name">${f.name}</div>
            <div class="facility-card-desc">${f.description ?? 'No description'}</div>
            <div class="facility-card-meta">
                <span class="badge ${f.type === 'BADMINTON' ? 'badge-blue' : 'badge-orange'}">${f.type}</span>
                <span class="badge ${f.isActive ? 'badge-green' : 'badge-gray'}">${f.isActive ? 'Active' : 'Inactive'}</span>
            </div>
        </div>`).join('');
}

function filterFacilities(btn, type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = type === 'ALL' ? allFacilities : allFacilities.filter(f => f.type === type);
    renderFacilities(filtered);
}

// =============================================
// BOOKINGS
// =============================================
async function loadBookings() {
    const tbody = document.getElementById('bookingsTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">Loading...</td></tr>';
    try {
        allBookings = await fetch(`${API}/api/bookings`).then(r => r.json());
        renderBookings(allBookings);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">Failed to load bookings</td></tr>';
    }
}

function renderBookings(list) {
    const tbody = document.getElementById('bookingsTableBody');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">No bookings found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(b => `
        <tr>
            <td style="color:var(--text3)">#${b.id}</td>
            <td>
                <div>${b.studentName}</div>
                <div style="font-size:12px;color:var(--text3)">${b.studentEmail}</div>
            </td>
            <td>${b.studentId}</td>
            <td>${b.facility?.name ?? '—'}</td>
            <td>${b.bookingDate}</td>
            <td>${formatTime(b.startTime)} – ${formatTime(b.endTime)}</td>
            <td>${statusBadge(b.status)}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${b.status === 'PENDING' ? `
                        <button class="btn-icon btn-confirm" onclick="quickStatus(${b.id}, 'CONFIRMED', 'bookings')">✓</button>
                        <button class="btn-icon btn-cancel" onclick="quickStatus(${b.id}, 'CANCELLED', 'bookings')">✕</button>
                    ` : ''}
                    <button class="btn-icon" onclick="openStatusModal('booking', ${b.id})">✏</button>
                    <button class="btn-icon btn-cancel" onclick="deleteRecord('bookings', ${b.id})">🗑</button>
                </div>
            </td>
        </tr>`).join('');
}

function filterBookings(btn, status) {
    document.querySelectorAll('#page-bookings .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = status === 'ALL' ? allBookings : allBookings.filter(b => b.status === status);
    renderBookings(filtered);
}

// =============================================
// EQUIPMENT
// =============================================
async function loadEquipment() {
    const tbody = document.getElementById('equipmentTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Loading...</td></tr>';
    try {
        allEquipment = await fetch(`${API}/api/equipment`).then(r => r.json());
        renderEquipment(allEquipment);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Failed to load equipment</td></tr>';
    }
}

function renderEquipment(list) {
    const tbody = document.getElementById('equipmentTableBody');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">No equipment found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(e => `
        <tr>
            <td style="color:var(--text3)">#${e.id}</td>
            <td><strong>${e.name}</strong></td>
            <td><span class="badge badge-gray">${e.category}</span></td>
            <td>${equipmentStatusBadge(e.status)}</td>
            <td>${e.quantity}</td>
            <td style="color:var(--text3);font-size:12px">${formatDateTime(e.lastUpdated)}</td>
            <td>
                <div style="display:flex;gap:6px">
                    <button class="btn-icon" onclick="openStatusModal('equipment', ${e.id})">✏ Status</button>
                    <button class="btn-icon btn-cancel" onclick="deleteRecord('equipment', ${e.id})">🗑</button>
                </div>
            </td>
        </tr>`).join('');
}

function filterEquipment(btn, status) {
    document.querySelectorAll('#page-equipment .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = status === 'ALL' ? allEquipment : allEquipment.filter(e => e.status === status);
    renderEquipment(filtered);
}

// =============================================
// RENTALS
// =============================================
async function loadRentals() {
    const tbody = document.getElementById('rentalsTableBody');
    tbody.innerHTML = '<tr><td colspan="9" class="loading-msg">Loading...</td></tr>';
    try {
        allRentals = await fetch(`${API}/api/rentals`).then(r => r.json());
        renderRentals(allRentals);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-msg">Failed to load rentals</td></tr>';
    }
}

function renderRentals(list) {
    const tbody = document.getElementById('rentalsTableBody');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-msg">No rentals found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(r => `
        <tr>
            <td style="color:var(--text3)">#${r.id}</td>
            <td>${r.studentName}</td>
            <td>${r.studentId}</td>
            <td>${r.equipment?.name ?? '—'}</td>
            <td>${r.quantity}</td>
            <td>${r.rentalDate}</td>
            <td>${r.returnDate ?? '<span style="color:var(--text3)">—</span>'}</td>
            <td>${rentalStatusBadge(r.status)}</td>
            <td>
                <div style="display:flex;gap:6px">
                    ${r.status === 'ACTIVE' ? `<button class="btn-icon btn-return" onclick="returnEquipment(${r.id})">↩ Return</button>` : ''}
                    <button class="btn-icon btn-cancel" onclick="deleteRecord('rentals', ${r.id})">🗑</button>
                </div>
            </td>
        </tr>`).join('');
}

function filterRentals(btn, status) {
    document.querySelectorAll('#page-rentals .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = status === 'ALL' ? allRentals : allRentals.filter(r => r.status === status);
    renderRentals(filtered);
}

// =============================================
// MODALS
// =============================================
async function openBookingModal() {
    // Load facilities
    try {
        const facilities = await fetch(`${API}/api/facilities/active`).then(r => r.json());
        const sel = document.getElementById('bFacility');
        sel.innerHTML = '<option value="">Select a facility...</option>' +
            facilities.map(f => `<option value="${f.id}">${f.name} (${f.type})</option>`).join('');
    } catch (err) { console.error(err); }

    document.getElementById('bookingError').classList.remove('visible');
    document.getElementById('bookingForm').reset();
    setDefaultDates();
    openModal('bookingModal');
}

async function openRentalModal() {
    try {
        const equipment = await fetch(`${API}/api/equipment/status/AVAILABLE`).then(r => r.json());
        const sel = document.getElementById('rEquipment');
        sel.innerHTML = '<option value="">Select equipment...</option>' +
            equipment.map(e => `<option value="${e.id}">${e.name} (${e.quantity} available)</option>`).join('');
    } catch (err) { console.error(err); }

    document.getElementById('rentalError').classList.remove('visible');
    document.getElementById('rentalForm').reset();
    setDefaultDates();
    openModal('rentalModal');
}

function openStatusModal(type, id) {
    const title = document.getElementById('statusModalTitle');
    const sel = document.getElementById('statusSelect');
    currentStatusTarget = { type, id };

    if (type === 'booking') {
        title.textContent = 'Update Booking Status';
        sel.innerHTML = ['PENDING','CONFIRMED','CANCELLED'].map(s =>
            `<option value="${s}">${s}</option>`).join('');
    } else if (type === 'equipment') {
        title.textContent = 'Update Equipment Status';
        sel.innerHTML = ['AVAILABLE','DAMAGED','IN_MAINTENANCE'].map(s =>
            `<option value="${s}">${s.replace('_',' ')}</option>`).join('');
    }

    openModal('statusModal');
}

async function submitStatusUpdate() {
    if (!currentStatusTarget) return;
    const { type, id } = currentStatusTarget;
    const status = document.getElementById('statusSelect').value;

    try {
        if (type === 'booking') {
            await fetch(`${API}/api/bookings/${id}/status?status=${status}`, { method: 'PATCH' });
            await loadBookings();
            showToast('Booking status updated');
        } else if (type === 'equipment') {
            await fetch(`${API}/api/equipment/${id}/status?status=${status}`, { method: 'PATCH' });
            await loadEquipment();
            showToast('Equipment status updated');
        }
        closeModal();
    } catch (err) {
        showToast('Update failed', true);
    }
}

async function quickStatus(id, status, type) {
    try {
        await fetch(`${API}/api/bookings/${id}/status?status=${status}`, { method: 'PATCH' });
        showToast(`Booking ${status.toLowerCase()}`);
        if (type === 'bookings') await loadBookings();
        await loadDashboard();
    } catch (err) {
        showToast('Action failed', true);
    }
}

async function returnEquipment(id) {
    try {
        await fetch(`${API}/api/rentals/${id}/return`, { method: 'PATCH' });
        showToast('Equipment returned successfully');
        await loadRentals();
    } catch (err) {
        showToast('Return failed', true);
    }
}

async function deleteRecord(resource, id) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
        await fetch(`${API}/api/${resource}/${id}`, { method: 'DELETE' });
        showToast('Record deleted');
        if (resource === 'bookings') await loadBookings();
        else if (resource === 'equipment') await loadEquipment();
        else if (resource === 'rentals') await loadRentals();
    } catch (err) {
        showToast('Delete failed', true);
    }
}

// =============================================
// FORM SUBMISSIONS
// =============================================
async function submitBooking(e) {
    e.preventDefault();
    const errEl = document.getElementById('bookingError');
    errEl.classList.remove('visible');

    const payload = {
        studentName:  document.getElementById('bStudentName').value,
        studentId:    document.getElementById('bStudentId').value,
        studentEmail: document.getElementById('bStudentEmail').value,
        facilityId:   document.getElementById('bFacility').value,
        bookingDate:  document.getElementById('bDate').value,
        startTime:    document.getElementById('bStartTime').value,
        endTime:      document.getElementById('bEndTime').value,
        notes:        document.getElementById('bNotes').value,
    };

    try {
        const res = await fetch(`${API}/api/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error ?? 'Booking failed';
            errEl.classList.add('visible');
            return;
        }
        showToast('Booking created successfully!');
        closeModal();
        await loadBookings();
        await loadDashboard();
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.classList.add('visible');
    }
}

async function submitRental(e) {
    e.preventDefault();
    const errEl = document.getElementById('rentalError');
    errEl.classList.remove('visible');

    const payload = {
        studentName: document.getElementById('rStudentName').value,
        studentId:   document.getElementById('rStudentId').value,
        equipmentId: document.getElementById('rEquipment').value,
        quantity:    document.getElementById('rQuantity').value,
        rentalDate:  document.getElementById('rDate').value,
    };

    try {
        const res = await fetch(`${API}/api/rentals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error ?? 'Rental failed';
            errEl.classList.add('visible');
            return;
        }
        showToast('Rental created successfully!');
        closeModal();
        await loadRentals();
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.classList.add('visible');
    }
}

// =============================================
// MODAL HELPERS
// =============================================
function openModal(id) {
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById(id).classList.add('open');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
    currentStatusTarget = null;
}

// =============================================
// UTILITY
// =============================================
function statusBadge(status) {
    const map = {
        PENDING:   'badge-orange',
        CONFIRMED: 'badge-green',
        CANCELLED: 'badge-gray',
    };
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${status}</span>`;
}

function equipmentStatusBadge(status) {
    const map = {
        AVAILABLE:      'badge-green',
        DAMAGED:        'badge-red',
        IN_MAINTENANCE: 'badge-orange',
    };
    const label = status.replace('_', ' ');
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${label}</span>`;
}

function rentalStatusBadge(status) {
    const map = {
        ACTIVE:   'badge-blue',
        RETURNED: 'badge-green',
        OVERDUE:  'badge-red',
    };
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${status}</span>`;
}

function formatTime(t) {
    if (!t) return '—';
    const parts = t.toString().split(':');
    const h = parseInt(parts[0]);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function formatDateTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

let toastTimer;
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
