// =============================================
// E-SUKAN — Frontend (authenticated)
// =============================================

let currentUser = null;
let allBookings = [];
let allEquipment = [];
let allFacilities = [];
let allRentals = [];
let allTournaments = [];
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

    if (isLecturer() || isAdmin()) {
        const tb = document.getElementById('tournamentToolbar');
        if (tb) {
            tb.style.display = 'flex';
        }
    }

    initNav();
    loadDashboard();
    setDefaultDates();

    document.getElementById('bookingForm').addEventListener('submit', submitBooking);
    document.getElementById('rentalForm').addEventListener('submit', submitRental);
    const tf = document.getElementById('tournamentForm');
    if (tf) {
        tf.addEventListener('submit', submitTournament);
    }
    const rf = document.getElementById('registerTeamForm');
    if (rf) {
        rf.addEventListener('submit', submitRegisterTeam);
    }
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
        tournaments: 'Tournaments',
        users: 'Users'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    const btn = document.getElementById('topbarActionBtn');
    if (page === 'rentals') {
        btn.textContent = '+ New Rental';
        btn.style.display = '';
    } else if (page === 'tournaments' && (isLecturer() || isAdmin())) {
        btn.textContent = '+ New Tournament';
        btn.style.display = '';
    } else if (page === 'users') {
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
        case 'tournaments':
            loadTournaments();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

function openPrimaryAction() {
    const activePage = document.querySelector('.nav-item.active')?.dataset.page;
    if (activePage === 'rentals') {
        openRentalModal();
    } else if (activePage === 'tournaments' && (isLecturer() || isAdmin())) {
        openTournamentModal();
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
            facilities.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
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
        const showPay = r.status === 'ACTIVE' && r.paymentStatus !== 'PAID';
        return `
        <tr data-rental-id="${r.id}">
            <td style="color:var(--text3)">#${r.id}</td>
            <td>${r.studentName}</td>
            <td>${r.studentId}</td>
            <td>${r.equipment?.name ?? '—'}</td>
            <td>${r.quantity}</td>
            <td>${r.rentalDate}</td>
            <td>${r.returnDate ?? '<span style="color:var(--text3)">—</span>'}</td>
            <td>${rentalStatusBadge(r.status)}</td>
            <td>${paymentStatusBadge(r.paymentStatus)}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
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
    tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Loading...</td></tr>';
    try {
        const list = await authFetch('/api/rentals').then(r => r.json());
        const returned = list.filter(r => r.status === 'RETURNED');
        if (returned.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">No returned items yet</td></tr>';
            return;
        }
        tbody.innerHTML = returned.map(r => `
            <tr>
                <td style="color:var(--text3)">#${r.id}</td>
                <td>${r.equipment?.name ?? '—'}</td>
                <td>${r.quantity}</td>
                <td>${r.rentalDate}</td>
                <td>${r.returnDate ?? '—'}</td>
                <td>${rentalStatusBadge(r.status)}</td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Failed to load</td></tr>';
    }
}

// =============================================
// TOURNAMENTS
// =============================================
async function loadTournaments() {
    const tbody = document.getElementById('tournamentsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-msg">Loading...</td></tr>';
    try {
        allTournaments = await authFetch('/api/tournaments').then(r => r.json());
        if (allTournaments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-msg">No tournaments</td></tr>';
            return;
        }
        tbody.innerHTML = allTournaments.map(t => {
            const org = t.organizer?.fullName || t.organizer?.username || '—';
            const canEdit = isAdmin() || (t.organizer && t.organizer.id === currentUser.id);
            return `
            <tr>
                <td><strong>${t.title}</strong><div style="font-size:12px;color:var(--text3);max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.description || ''}</div></td>
                <td>${t.startDate} → ${t.endDate}</td>
                <td><span class="badge badge-gray">${t.status}</span></td>
                <td>${org}</td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        ${isStudent() && t.status === 'OPEN' ? `<button class="btn-icon btn-confirm" onclick="openRegisterTeam(${t.id})">Register</button>` : ''}
                        ${canEdit ? `
                            <button class="btn-icon" onclick="editTournamentStatus(${t.id},'OPEN')">Publish</button>
                            <button class="btn-icon" onclick="editTournamentStatus(${t.id},'CLOSED')">Close</button>
                            <button class="btn-icon btn-cancel" onclick="deleteTournament(${t.id})">🗑</button>
                        ` : ''}
                        ${canEdit || isAdmin() ? `<button class="btn-icon" onclick="viewRegistrations(${t.id})">Teams</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-msg">Failed to load</td></tr>';
    }
}

function openTournamentModal() {
    document.getElementById('tournamentError').classList.remove('visible');
    document.getElementById('tournamentForm').reset();
    const t = new Date().toISOString().split('T')[0];
    document.getElementById('tStart').value = t;
    document.getElementById('tEnd').value = t;
    openModal('tournamentModal');
}

async function submitTournament(e) {
    e.preventDefault();
    const errEl = document.getElementById('tournamentError');
    errEl.classList.remove('visible');
    const body = {
        title: document.getElementById('tTitle').value.trim(),
        description: document.getElementById('tDesc').value.trim(),
        startDate: document.getElementById('tStart').value,
        endDate: document.getElementById('tEnd').value,
        status: document.getElementById('tStatus').value
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

async function editTournamentStatus(id, status) {
    try {
        const t = allTournaments.find(x => x.id === id);
        const body = {
            title: t.title,
            description: t.description,
            startDate: t.startDate,
            endDate: t.endDate,
            status
        };
        await authFetch(`/api/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Tournament updated');
        loadTournaments();
    } catch (err) {
        showToast('Update failed', true);
    }
}

async function deleteTournament(id) {
    if (!confirm('Delete this tournament?')) {
        return;
    }
    const res = await authFetch(`/api/tournaments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        showToast('Delete failed', true);
        return;
    }
    showToast('Deleted');
    loadTournaments();
}

function openRegisterTeam(tournamentId) {
    document.getElementById('registerTeamError').classList.remove('visible');
    document.getElementById('regTournamentId').value = tournamentId;
    document.getElementById('regTeamName').value = '';
    document.getElementById('regTeamEmail').value = currentUser.email || '';
    openModal('registerTeamModal');
}

async function submitRegisterTeam(e) {
    e.preventDefault();
    const errEl = document.getElementById('registerTeamError');
    errEl.classList.remove('visible');
    const id = document.getElementById('regTournamentId').value;
    const res = await authFetch(`/api/tournaments/${id}/registrations`, {
        method: 'POST',
        body: JSON.stringify({
            teamName: document.getElementById('regTeamName').value.trim(),
            contactEmail: document.getElementById('regTeamEmail').value.trim()
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        errEl.textContent = data.error || 'Failed';
        errEl.classList.add('visible');
        return;
    }
    showToast('Team registered');
    closeModal();
}

async function viewRegistrations(tournamentId) {
    try {
        const res = await authFetch(`/api/tournaments/${tournamentId}/registrations`);
        const list = await res.json();
        const msg = list.length === 0 ? 'No teams yet.' : list.map(r => `• ${r.teamName} (${r.contactEmail || ''})`).join('\n');
        alert(msg);
    } catch (err) {
        showToast('Could not load teams', true);
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
            facilities.map(f => `<option value="${f.id}">${f.name} (${f.type})</option>`).join('');
    } catch (err) {
        console.error(err);
    }

    document.getElementById('bookingError').classList.remove('visible');
    document.getElementById('bookingForm').reset();
    setDefaultDates();
    openModal('bookingModal');
}

async function openRentalModal() {
    try {
        const equipment = await authFetch('/api/equipment/status/AVAILABLE').then(r => r.json());
        const sel = document.getElementById('rEquipment');
        sel.innerHTML = '<option value="">Select equipment...</option>' +
            equipment.map(eq => `<option value="${eq.id}">${eq.name} (${eq.quantity} available)</option>`).join('');
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
        }
        await loadDashboard();
    } catch (err) {
        showToast('Action failed', true);
    }
}

async function returnEquipment(id) {
    try {
        await authFetch(`/api/rentals/${id}/return`, { method: 'PATCH' });
        showToast('Equipment returned successfully');
        await loadRentals();
    } catch (err) {
        showToast('Return failed', true);
    }
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
    errEl.classList.remove('visible');

    const payload = {
        facilityId: document.getElementById('bFacility').value,
        bookingDate: document.getElementById('bDate').value,
        startTime: document.getElementById('bStartTime').value,
        endTime: document.getElementById('bEndTime').value,
        notes: document.getElementById('bNotes').value
    };

    try {
        const res = await authFetch('/api/bookings', {
            method: 'POST',
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
        equipmentId: document.getElementById('rEquipment').value,
        quantity: document.getElementById('rQuantity').value,
        rentalDate: document.getElementById('rDate').value
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
        CANCELLED: 'badge-gray'
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
