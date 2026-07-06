// =============================================
// E-SUKAN — Frontend (authenticated)
// =============================================

let currentUser = null;
let allBookings = [];
let allEquipment = [];
let allFacilities = [];
let allRentals = [];
let allUsers = [];
let currentStatusTarget = null;

function isAdmin() {
    return currentUser && currentUser.role === 'ADMIN';
}
function isStudent() {
    return currentUser && currentUser.role === 'STUDENT';
}
function isLecturer() {
    return currentUser && currentUser.role === 'LECTURER';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!getEsukanToken()) {
        window.location.href = '/login.html';
        return;
    }
    const meRes = await authFetch('/api/auth/me');
    if (!meRes.ok) {
        setEsukanToken(null);
        window.location.href = '/login.html';
        return;
    }
    currentUser = await meRes.json();

    const av = document.getElementById('userAvatar');
    const initials = (currentUser.fullName || currentUser.username || '?')
        .split(/\s+/)
        .map(s => s[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    av.textContent = initials;
    document.getElementById('userChipName').textContent = currentUser.fullName || currentUser.username;
    document.getElementById('userChipRole').textContent = currentUser.role;

    document.getElementById('logoutChip').addEventListener('click', () => {
        if (confirm('Sign out?')) {
            logoutEsukan();
        }
    });

    const hintB = document.getElementById('bookingProfileHint');
    const hintR = document.getElementById('rentalProfileHint');
    if (hintB) {
        hintB.textContent = `Booking as ${currentUser.fullName} (${currentUser.email})`;
    }
    if (hintR) {
        hintR.textContent = `Renting as ${currentUser.fullName}`;
    }



    initNav();
    loadDashboard();
    setDefaultDates();

    document.getElementById('bookingForm').addEventListener('submit', submitBooking);
    document.getElementById('rentalForm').addEventListener('submit', submitRental);

    const uf = document.getElementById('userCreateForm');
    if (uf) {
        uf.addEventListener('submit', submitCreateUser);
    }
    const pf = document.getElementById('paymentForm');
    if (pf) {
        pf.addEventListener('submit', submitPayment);
    }
});

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bDate').value = today;
    document.getElementById('rDate').value = today;
}

function initNav() {
    const role = currentUser.role;
    document.querySelectorAll('.nav-item').forEach(item => {
        const roles = item.dataset.roles;
        if (roles && !roles.split(',').includes(role)) {
            item.style.display = 'none';
            return;
        }
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
}

function navigateTo(page) {
    const el = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (!el || el.style.display === 'none') {
        return;
    }

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) {
        pageEl.classList.add('active');
    }

    const titles = {
        dashboard: 'Dashboard',
        facilities: 'Facilities',
        bookings: 'My bookings',
        equipment: 'Equipment',
        rentals: 'Rentals',
        returned: 'Returned equipment',
        users: 'Users'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    const btn = document.getElementById('topbarActionBtn');
    if (page === 'rentals' || page === 'equipment') {
        btn.textContent = '+ New Rental';
        btn.style.display = '';
    } else if (page === 'users' || page === 'returned') {
        btn.style.display = 'none';
    } else {
        btn.textContent = '+ New Booking';
        btn.style.display = '';
    }

    switch (page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'facilities':
            loadFacilities();
            break;
        case 'bookings':
            loadBookings();
            loadWaitlist();
            break;
        case 'equipment':
            loadEquipment();
            break;
        case 'rentals':
            loadRentals();
            break;
        case 'returned':
            loadReturned();
            break;

        case 'users':
            loadUsers();
            break;
    }
}

function openPrimaryAction() {
    const activePage = document.querySelector('.nav-item.active')?.dataset.page;
    if (activePage === 'rentals' || activePage === 'equipment') {
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
            authFetch('/api/bookings/dashboard').then(r => r.json()),
            authFetch('/api/equipment/health-report').then(r => r.json()),
            authFetch(`/api/bookings/date/${new Date().toISOString().split('T')[0]}`).then(r => r.json())
        ]);

        document.getElementById('stat-total').textContent = stats.totalBookings ?? 0;
        document.getElementById('stat-today').textContent = stats.todayBookings ?? 0;
        document.getElementById('stat-pending').textContent = stats.pendingBookings ?? 0;

        const unhealthy = (healthReport.damaged ?? 0) + (healthReport.inMaintenance ?? 0);
        document.getElementById('stat-unhealthy').textContent = unhealthy;

        const total = (healthReport.available ?? 0) + (healthReport.damaged ?? 0) + (healthReport.inMaintenance ?? 0);
        renderHealthBars(healthReport, total);

        renderTodayTable(todayBookings);

        loadFacilitiesForSelect();
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function renderHealthBars(report, total) {
    const container = document.getElementById('healthBars');
    if (total === 0) {
        container.innerHTML = '<div class="loading-msg">No equipment data</div>';
        return;
    }

    const items = [
        { label: 'Available', count: report.available ?? 0, cls: 'bar-green' },
        { label: 'Damaged', count: report.damaged ?? 0, cls: 'bar-red' },
        { label: 'In Maintenance', count: report.inMaintenance ?? 0, cls: 'bar-orange' }
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
        const facilities = await authFetch('/api/facilities/active').then(r => r.json());
        const sel = document.getElementById('peakFacilitySelect');
        sel.innerHTML = '<option value="">Select facility...</option>' +
            facilities.map(f => {
                const costText = (f.costPerHour || f.cost_per_hour) ? ` - RM ${Number(f.costPerHour || f.cost_per_hour).toFixed(2)}/hr` : ' - RM 0.00/hr';
                return `<option value="${f.id}">${f.name}${costText}</option>`;
            }).join('');
    } catch (err) {
        console.error(err);
    }
}

async function loadPeakHours() {
    const facilityId = document.getElementById('peakFacilitySelect').value;
    const container = document.getElementById('peakChart');
    if (!facilityId) {
        container.innerHTML = '<div class="loading-msg">Select a facility to view peak hours</div>';
        return;
    }

    try {
        const data = await authFetch(`/api/bookings/peak-hours/${facilityId}`).then(r => r.json());
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
                ${isAdmin() && b.status === 'PENDING' ? `
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
        allFacilities = await authFetch('/api/facilities').then(r => r.json());
        renderFacilities(allFacilities);
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

    grid.innerHTML = list.map(f => `
        <div class="facility-card">
            <div class="facility-card-icon">${f.type === 'BADMINTON' ? '🏸' : '⚽'}</div>
            <div class="facility-card-name">${f.name}</div>
            <div class="facility-card-desc">${f.description ?? 'No description'}</div>
            <div class="facility-card-meta">
                <span class="badge ${f.type === 'BADMINTON' ? 'badge-blue' : 'badge-orange'}">${f.type}</span>
                <span class="badge ${f.isActive ? 'badge-green' : 'badge-gray'}">${f.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
                <button class="btn-icon" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="showFacilityDetails(${f.id})">🔍 Details</button>
            </div>
        </div>`).join('');
}

function filterFacilities(btn, type) {
    document.querySelectorAll('#page-facilities .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = type === 'ALL' ? allFacilities : allFacilities.filter(f => f.type === type);
    renderFacilities(filtered);
}

// =============================================
// BOOKINGS
// =============================================
async function loadWaitlist() {
    const tbody = document.getElementById('waitlistTableBody');
    const countEl = document.getElementById('waitlistCount');
    if (!tbody) {
        return;
    }
    try {
        const list = await authFetch('/api/waitlist').then(r => r.json());
        const rows = Array.isArray(list) ? list : [];
        countEl.textContent = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`;
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">No waitlist entries</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(w => `
            <tr>
                <td>${w.id}</td>
                <td>${w.facility?.name ?? '—'}</td>
                <td>${w.bookingDate}</td>
                <td>${formatTime(w.startTime)} – ${formatTime(w.endTime)}</td>
                <td>${w.status === 'WAITING' ? '#' + (w.queuePosition ?? '—') : '—'}</td>
                <td>${statusBadge(w.status)}</td>
                <td class="actions-cell">
                    ${w.status === 'WAITING' ? `<button class="btn-icon btn-cancel" onclick="leaveWaitlist(${w.id})" title="Leave waitlist">✕</button>` : ''}
                    ${w.promotedBookingId ? `<span class="stat-sub">Booking #${w.promotedBookingId}</span>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Failed to load waitlist</td></tr>';
        countEl.textContent = '—';
    }
}

async function leaveWaitlist(id) {
    if (!confirm('Leave this waitlist?')) {
        return;
    }
    try {
        const res = await authFetch(`/api/waitlist/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || 'Could not leave waitlist', true);
            return;
        }
        showToast('Removed from waitlist');
        await loadWaitlist();
    } catch (err) {
        showToast('Action failed', true);
    }
}

function bookingFormPayload() {
    const start = document.getElementById('bStartTime').value;
    const end = document.getElementById('bEndTime').value;
    return {
        facilityId: document.getElementById('bFacility').value,
        bookingDate: document.getElementById('bDate').value,
        startTime: start.length === 5 ? `${start}:00` : start,
        endTime: end.length === 5 ? `${end}:00` : end,
        notes: document.getElementById('bNotes').value
    };
}

async function joinWaitlistFromForm() {
    const errEl = document.getElementById('bookingError');
    const joinBtn = document.getElementById('joinWaitlistBtn');
    errEl.classList.remove('visible');
    try {
        const res = await authFetch('/api/waitlist', {
            method: 'POST',
            body: JSON.stringify(bookingFormPayload())
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            errEl.textContent = data.error || 'Could not join waitlist';
            errEl.classList.add('visible');
            return;
        }
        showToast(`Joined waitlist (#${data.queuePosition ?? '?'})`);
        if (joinBtn) {
            joinBtn.style.display = 'none';
        }
        closeModal();
        await loadWaitlist();
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.classList.add('visible');
    }
}

async function loadBookings() {
    const tbody = document.getElementById('bookingsTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading-msg">Loading...</td></tr>';
    try {
        allBookings = await authFetch('/api/bookings').then(r => r.json());
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
                    <button class="btn-icon" onclick="showBookingDetails(${b.id})">🔍 Details</button>
                    ${isAdmin() && b.status === 'PENDING' ? `
                        <button class="btn-icon btn-confirm" onclick="quickStatus(${b.id}, 'CONFIRMED', 'bookings')">✓</button>
                        <button class="btn-icon btn-cancel" onclick="quickStatus(${b.id}, 'CANCELLED', 'bookings')">✕</button>
                    ` : ''}
                    ${isAdmin() ? `
                        <button class="btn-icon" onclick="openStatusModal('booking', ${b.id})">✏</button>
                        <button class="btn-icon btn-cancel" onclick="deleteRecord('bookings', ${b.id})">🗑</button>
                    ` : (b.status === 'PENDING' ? `
                        <button class="btn-icon btn-cancel" onclick="deleteRecord('bookings', ${b.id})" title="Cancel request">🗑</button>
                    ` : '')}
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
        allEquipment = await authFetch('/api/equipment').then(r => r.json());
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

    const colspan = isAdmin() ? 7 : 6;
    tbody.innerHTML = list.map(e => `
        <tr>
            <td style="color:var(--text3)">#${e.id}</td>
            <td><strong>${e.name}</strong></td>
            <td><span class="badge badge-gray">${e.category}</span></td>
            <td>${equipmentStatusBadge(e.status)}</td>
            <td>${e.quantity}</td>
            <td style="color:var(--text3);font-size:12px">${formatDateTime(e.lastUpdated)}</td>
            ${isAdmin() ? `
            <td>
                <div style="display:flex;gap:6px">
                    <button class="btn-icon" onclick="openStatusModal('equipment', ${e.id})">✏ Status</button>
                    <button class="btn-icon btn-cancel" onclick="deleteRecord('equipment', ${e.id})">🗑</button>
                </div>
            </td>` : '<td>—</td>'}
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
    tbody.innerHTML = '<tr><td colspan="10" class="loading-msg">Loading...</td></tr>';
    try {
        allRentals = await authFetch('/api/rentals').then(r => r.json());
        renderRentals(allRentals);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading-msg">Failed to load rentals</td></tr>';
    }
}

function renderRentals(list) {
    const tbody = document.getElementById('rentalsTableBody');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading-msg">No rentals found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(r => {
        const showPay = false;
        return `
        <tr data-rental-id="${r.id}">
            <td style="color:var(--text3)">#${r.id}</td>
            <td>${r.studentName}</td>
            <td>${r.studentId}</td>
            <td>${r.equipment?.name ?? '—'}</td>
            <td>${r.quantity}</td>
            <td>${r.rentalDate} ${r.startTime ? '@ ' + formatTime(r.startTime) : ''}</td>
            <td>${r.returnDate ?? '<span style="color:var(--text3)">—</span>'}</td>
            <td>${rentalStatusBadge(r.status)}</td>
            <td>${paymentStatusBadge(r.paymentStatus)}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button type="button" class="btn-icon" onclick="showRentalDetails(${r.id})">🔍 Details</button>
                    ${showPay ? `<button type="button" class="btn-icon btn-confirm" onclick="openPaymentModal(${r.id})">Pay Now</button>` : ''}
                    ${r.status === 'ACTIVE' ? `<button class="btn-icon btn-return" onclick="returnEquipment(${r.id})">↩ Return</button>` : ''}
                    ${isAdmin() ? `<button class="btn-icon btn-cancel" onclick="deleteRecord('rentals', ${r.id})">🗑</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterRentals(btn, status) {
    document.querySelectorAll('#page-rentals .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = status === 'ALL' ? allRentals : allRentals.filter(r => r.status === status);
    renderRentals(filtered);
}

async function loadReturned() {
    const tbody = document.getElementById('returnedTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Loading...</td></tr>';
    try {
        const list = await authFetch('/api/rentals').then(r => r.json());
        const returned = list.filter(r => r.status === 'RETURNED');
        if (returned.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">No returned items yet</td></tr>';
            return;
        }
        tbody.innerHTML = returned.map(r => `
            <tr>
                <td style="color:var(--text3)">#${r.id}</td>
                <td>${r.equipment?.name ?? '—'}</td>
                <td>${r.quantity}</td>
                <td>${r.rentalDate} ${r.startTime ? '@ ' + formatTime(r.startTime) : ''}</td>
                <td>${r.returnDate ?? '—'}</td>
                <td>${rentalStatusBadge(r.status)}</td>
                <td>
                    <button class="btn-icon" onclick="showRentalDetails(${r.id})">🔍 Details</button>
                </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-msg">Failed to load</td></tr>';
    }
}

// =============================================
// ADMIN USERS
// =============================================
async function loadUsers() {
    if (!isAdmin()) {
        return;
    }
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Loading...</td></tr>';
    try {
        allUsers = await authFetch('/api/admin/users').then(r => r.json());
        tbody.innerHTML = allUsers.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td>${u.fullName}</td>
                <td><span class="badge badge-gray">${u.role}</span></td>
                <td>${u.enabled ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn-icon" onclick="toggleUser(${u.id}, ${!u.enabled})">${u.enabled ? 'Disable' : 'Enable'}</button>
                    ${u.role === 'STUDENT' ? `<button class="btn-icon" onclick="setUserRole(${u.id},'LECTURER')">Make lecturer</button>` : ''}
                    ${u.role === 'LECTURER' ? `<button class="btn-icon" onclick="setUserRole(${u.id},'STUDENT')">Make student</button>` : ''}
                </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Failed</td></tr>';
    }
}

function openUserCreateModal() {
    document.getElementById('userCreateError').classList.remove('visible');
    document.getElementById('userCreateForm').reset();
    openModal('userCreateModal');
}

async function submitCreateUser(e) {
    e.preventDefault();
    const errEl = document.getElementById('userCreateError');
    errEl.classList.remove('visible');
    const body = {
        username: document.getElementById('nuUsername').value.trim(),
        email: document.getElementById('nuEmail').value.trim(),
        fullName: document.getElementById('nuFullName').value.trim(),
        studentIdNumber: document.getElementById('nuStudentId').value.trim() || null,
        role: document.getElementById('nuRole').value,
        password: document.getElementById('nuPassword').value
    };
    const res = await authFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        errEl.textContent = data.error || 'Failed';
        errEl.classList.add('visible');
        return;
    }
    showToast('User created');
    closeModal();
    loadUsers();
}

async function toggleUser(id, enabled) {
    await authFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled })
    });
    loadUsers();
}

async function setUserRole(id, role) {
    await authFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, enabled: true })
    });
    loadUsers();
}

// =============================================
// MODALS
// =============================================
async function openBookingModal() {
    try {
        const facilities = await authFetch('/api/facilities/active').then(r => r.json());
        const sel = document.getElementById('bFacility');
        sel.innerHTML = '<option value="">Select a facility...</option>' +
            facilities.map(f => {
                const costText = (f.costPerHour || f.cost_per_hour) ? ` - RM ${Number(f.costPerHour || f.cost_per_hour).toFixed(2)}/hr` : ' - RM 0.00/hr';
                return `<option value="${f.id}">${f.name} (${f.type})${costText}</option>`;
            }).join('');
    } catch (err) {
        console.error(err);
    }

    document.getElementById('bookingError').classList.remove('visible');
    const joinBtn = document.getElementById('joinWaitlistBtn');
    if (joinBtn) {
        joinBtn.style.display = 'none';
    }
    document.getElementById('bookingForm').reset();
    setDefaultDates();
    openModal('bookingModal');
}

async function openRentalModal() {
    try {
        const equipment = await authFetch('/api/equipment/status/AVAILABLE').then(r => r.json());
        const sel = document.getElementById('rEquipment');
        sel.innerHTML = '<option value="">Select equipment...</option>' +
            equipment.map(eq => {
                const costText = (eq.costPerHour || eq.cost_per_hour) ? ` - RM ${Number(eq.costPerHour || eq.cost_per_hour).toFixed(2)}/hr` : ' - RM 0.00/hr';
                return `<option value="${eq.id}">${eq.name} (${eq.quantity} available)${costText}</option>`;
            }).join('');
    } catch (err) {
        console.error(err);
    }

    document.getElementById('rentalError').classList.remove('visible');
    document.getElementById('rentalForm').reset();
    setDefaultDates();
    openModal('rentalModal');
}

function openStatusModal(type, id) {
    if (!isAdmin()) {
        return;
    }
    const title = document.getElementById('statusModalTitle');
    const sel = document.getElementById('statusSelect');
    currentStatusTarget = { type, id };

    if (type === 'booking') {
        title.textContent = 'Update Booking Status';
        sel.innerHTML = ['PENDING', 'CONFIRMED', 'CANCELLED'].map(s =>
            `<option value="${s}">${s}</option>`).join('');
    } else if (type === 'equipment') {
        title.textContent = 'Update Equipment Status';
        sel.innerHTML = ['AVAILABLE', 'DAMAGED', 'IN_MAINTENANCE'].map(s =>
            `<option value="${s}">${s.replace('_', ' ')}</option>`).join('');
    }

    openModal('statusModal');
}

async function submitStatusUpdate() {
    if (!currentStatusTarget || !isAdmin()) {
        return;
    }
    const { type, id } = currentStatusTarget;
    const status = document.getElementById('statusSelect').value;

    try {
        if (type === 'booking') {
            await authFetch(`/api/bookings/${id}/status?status=${status}`, { method: 'PATCH' });
            await loadBookings();
            await loadWaitlist();
            showToast('Booking status updated');
        } else if (type === 'equipment') {
            await authFetch(`/api/equipment/${id}/status?status=${status}`, { method: 'PATCH' });
            await loadEquipment();
            showToast('Equipment status updated');
        }
        closeModal();
    } catch (err) {
        showToast('Update failed', true);
    }
}

async function quickStatus(id, status, type) {
    if (!isAdmin()) {
        return;
    }
    try {
        await authFetch(`/api/bookings/${id}/status?status=${status}`, { method: 'PATCH' });
        showToast(`Booking ${status.toLowerCase()}`);
        if (type === 'bookings') {
            await loadBookings();
            await loadWaitlist();
        }
        await loadDashboard();
    } catch (err) {
        showToast('Action failed', true);
    }
}

async function returnEquipment(id) {
    openPaymentModal(id);
}

async function deleteRecord(resource, id) {
    if (!confirm('Are you sure you want to delete this record?')) {
        return;
    }
    try {
        await authFetch(`/api/${resource}/${id}`, { method: 'DELETE' });
        showToast('Record deleted');
        if (resource === 'bookings') {
            await loadBookings();
            await loadWaitlist();
        } else if (resource === 'equipment') {
            await loadEquipment();
        } else if (resource === 'rentals') {
            await loadRentals();
        }
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
    const joinBtn = document.getElementById('joinWaitlistBtn');
    errEl.classList.remove('visible');
    if (joinBtn) {
        joinBtn.style.display = 'none';
    }

    const payload = bookingFormPayload();

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
        await loadBookings();
        await loadWaitlist();
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
        equipmentId: document.getElementById('rEquipment').value,
        quantity: document.getElementById('rQuantity').value,
        rentalDate: document.getElementById('rDate').value,
        startTime: document.getElementById('rStartTime').value
    };

    try {
        const res = await authFetch('/api/rentals', {
            method: 'POST',
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
        PENDING: 'badge-orange',
        CONFIRMED: 'badge-green',
        CANCELLED: 'badge-gray',
        WAITING: 'badge-orange',
        PROMOTED: 'badge-green'
    };
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${status}</span>`;
}

function equipmentStatusBadge(status) {
    const map = {
        AVAILABLE: 'badge-green',
        DAMAGED: 'badge-red',
        IN_MAINTENANCE: 'badge-orange'
    };
    const label = status.replace('_', ' ');
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${label}</span>`;
}

function rentalStatusBadge(status) {
    const map = {
        ACTIVE: 'badge-blue',
        RETURNED: 'badge-green',
        OVERDUE: 'badge-red'
    };
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${status}</span>`;
}

function paymentStatusBadge(status) {
    if (!status) {
        return '<span class="badge badge-gray">—</span>';
    }
    const map = {
        PENDING: 'badge-orange',
        PAID: 'badge-green',
        FAILED: 'badge-red'
    };
    return `<span class="badge ${map[status] ?? 'badge-gray'}">${status}</span>`;
}

function openPaymentModal(rentalId) {
    const r = allRentals.find(x => x.id === rentalId);
    const dep = r && r.depositAmount != null ? Number(r.depositAmount).toFixed(2) : '0.00';
    document.getElementById('paymentError').classList.remove('visible');
    document.getElementById('payRentalId').value = String(rentalId);
    document.getElementById('payAmount').value = dep;
    document.getElementById('payMethod').value = 'CASH';
    openModal('paymentModal');
}

async function submitPayment(e) {
    e.preventDefault();
    const errEl = document.getElementById('paymentError');
    errEl.classList.remove('visible');
    const rentalId = document.getElementById('payRentalId').value;
    const method = document.getElementById('payMethod').value;
    try {
        const createRes = await authFetch('/api/payments', {
            method: 'POST',
            body: JSON.stringify({ rentalId: Number(rentalId), method })
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
            errEl.textContent = createData.error || 'Could not create payment';
            errEl.classList.add('visible');
            return;
        }
        const payRes = await authFetch(`/api/payments/${createData.id}/pay`, { method: 'PATCH' });
        const payData = await payRes.json().catch(() => ({}));
        if (!payRes.ok) {
            errEl.textContent = payData.error || 'Could not complete payment';
            errEl.classList.add('visible');
            return;
        }
        showToast('Payment recorded');
        closeModal();
        await loadRentals();
    } catch (err) {
        errEl.textContent = 'Network error';
        errEl.classList.add('visible');
    }
}

function formatTime(t) {
    if (!t) {
        return '—';
    }
    const parts = t.toString().split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function formatDateTime(dt) {
    if (!dt) {
        return '—';
    }
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

// =============================================
// DETAIL MODALS VIEW TRIGGERS
// =============================================
async function showFacilityDetails(facilityId) {
    try {
        const facility = await authFetch(`/api/facilities/${facilityId}`).then(r => r.json());
        
        // Load equipment if empty to resolve names
        if (!allEquipment || allEquipment.length === 0) {
            allEquipment = await authFetch('/api/equipment').then(r => r.json());
        }

        const eqNames = (facility.equipmentIds || []).map(id => {
            const eq = allEquipment.find(e => e.id === id);
            return eq ? eq.name : `#${id}`;
        });

        document.getElementById('fdTitle').textContent = facility.name;
        document.getElementById('fdDesc').textContent = facility.description || 'No description available.';
        document.getElementById('fdCost').textContent = `RM ${(facility.costPerHour || 0).toFixed(2)}`;
        
        const openTime = formatTime(facility.effectiveOpenTime || facility.openTime);
        const closeTime = formatTime(facility.effectiveCloseTime || facility.closeTime);
        document.getElementById('fdHours').textContent = `${openTime} – ${closeTime}`;
        
        const statusBadge = document.getElementById('fdStatusBadge');
        statusBadge.textContent = facility.isActive ? 'Active' : 'Inactive';
        statusBadge.className = `badge ${facility.isActive ? 'badge-green' : 'badge-gray'}`;

        const typeBadge = document.getElementById('fdTypeBadge');
        typeBadge.textContent = facility.type;
        typeBadge.className = `badge ${facility.type === 'BADMINTON' ? 'badge-blue' : 'badge-orange'}`;

        document.getElementById('fdIcon').textContent = facility.type === 'BADMINTON' ? '🏸' : '⚽';

        const eqListDiv = document.getElementById('fdEquipmentList');
        if (eqNames.length > 0) {
            eqListDiv.innerHTML = eqNames.map(name => `<span class="badge badge-gray">${name}</span>`).join('');
        } else {
            eqListDiv.innerHTML = '<span style="font-size: 13px; color: var(--text3);">No equipment associated</span>';
        }

        const bookBtn = document.getElementById('fdBookBtn');
        if (facility.isActive) {
            bookBtn.style.display = 'block';
            bookBtn.onclick = () => {
                closeModal();
                openBookingModal(facility.id);
            };
        } else {
            bookBtn.style.display = 'none';
        }

        openModal('facilityDetailModal');
    } catch (err) {
        console.error(err);
        showToast('Failed to load facility details');
    }
}

async function showRentalDetails(rentalId) {
    try {
        let rental = allRentals.find(r => r.id === rentalId);
        if (!rental) {
            rental = await authFetch(`/api/rentals/${rentalId}`).then(r => r.json());
        }

        document.getElementById('rdTitle').textContent = `Rental Details #${rental.id}`;
        document.getElementById('rdStudentName').textContent = rental.studentName;
        document.getElementById('rdStudentId').textContent = rental.studentId;
        document.getElementById('rdEquipmentName').textContent = rental.equipment?.name || '—';
        document.getElementById('rdEquipmentCategory').textContent = rental.equipment?.category || '—';
        document.getElementById('rdQuantity').textContent = rental.quantity;
        document.getElementById('rdRentalDate').textContent = rental.rentalDate;
        document.getElementById('rdStartTime').textContent = rental.startTime ? formatTime(rental.startTime) : '—';
        document.getElementById('rdReturnDate').textContent = rental.returnDate || 'Not returned yet';
        document.getElementById('rdDeposit').textContent = `RM ${(rental.depositAmount || 0).toFixed(2)}`;

        const statusContainer = document.getElementById('rdStatusBadgeContainer');
        statusContainer.innerHTML = rentalStatusBadge(rental.status);

        const payStatusContainer = document.getElementById('rdPaymentStatusContainer');
        payStatusContainer.innerHTML = paymentStatusBadge(rental.paymentStatus);

        document.getElementById('rdCreatedAt').textContent = formatDateTime(rental.createdAt);

        const actionSection = document.getElementById('rdActionSection');
        if (rental.status === 'ACTIVE') {
            const showPay = false;
            actionSection.innerHTML = `
                ${showPay ? `<button type="button" class="btn-primary" onclick="closeModal(); openPaymentModal(${rental.id})">Pay Now</button>` : ''}
                <button type="button" class="btn-secondary btn-return" onclick="closeModal(); returnEquipment(${rental.id})">↩ Return</button>
            `;
        } else {
            actionSection.innerHTML = '';
        }

        openModal('rentalDetailModal');
    } catch (err) {
        console.error(err);
        showToast('Failed to load rental details');
    }
}

async function showBookingDetails(bookingId) {
    try {
        let booking = allBookings.find(b => b.id === bookingId);
        if (!booking) {
            booking = await authFetch(`/api/bookings/${bookingId}`).then(r => r.json());
        }

        document.getElementById('bdTitle').textContent = `Booking Details #${booking.id}`;
        document.getElementById('bdStudentName').textContent = booking.studentName;
        document.getElementById('bdStudentId').textContent = booking.studentId;
        document.getElementById('bdStudentEmail').textContent = booking.studentEmail;
        document.getElementById('bdFacilityName').textContent = booking.facility?.name || '—';
        document.getElementById('bdFacilityType').textContent = booking.facility?.type || '—';
        document.getElementById('bdBookingDate').textContent = booking.bookingDate;
        
        const openTime = formatTime(booking.startTime);
        const closeTime = formatTime(booking.endTime);
        document.getElementById('bdTime').textContent = `${openTime} – ${closeTime}`;
        
        document.getElementById('bdCost').textContent = `RM ${(booking.estimatedCost || 0).toFixed(2)}`;
        
        const statusContainer = document.getElementById('bdStatusContainer');
        statusContainer.innerHTML = statusBadge(booking.status);

        const payStatusContainer = document.getElementById('bdPaymentStatusContainer');
        payStatusContainer.innerHTML = paymentStatusBadge(booking.paymentStatus);

        document.getElementById('bdNotes').textContent = booking.notes || '—';

        document.getElementById('bdCreatedAt').textContent = formatDateTime(booking.createdAt);

        const actionSection = document.getElementById('bdActionSection');
        if (isAdmin() && booking.status === 'PENDING') {
            actionSection.innerHTML = `
                <button type="button" class="btn-primary btn-confirm" onclick="closeModal(); quickStatus(${booking.id}, 'CONFIRMED', 'bookings')">✓ Confirm</button>
                <button type="button" class="btn-secondary btn-cancel" onclick="closeModal(); quickStatus(${booking.id}, 'CANCELLED', 'bookings')">✕ Cancel</button>
            `;
        } else {
            actionSection.innerHTML = '';
        }

        openModal('bookingDetailModal');
    } catch (err) {
        console.error(err);
        showToast('Failed to load booking details');
    }
}
