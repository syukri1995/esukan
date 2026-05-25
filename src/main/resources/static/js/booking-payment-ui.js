/**
 * Booking fee payment: Pay Now on bookings list + prompt after create.
 */
(function () {
    function fmtRm(n) {
        const v = Number(n || 0);
        return `RM ${v.toFixed(2)}`;
    }

    function canPayBooking(b) {
        const cost = Number(b.estimatedCost || b.estimated_cost || 0);
        return b.status === 'PENDING' && cost > 0 && b.paymentStatus !== 'PAID';
    }

    function paymentLabel(b) {
        if (b.paymentStatus === 'PAID') {
            return typeof paymentStatusBadge === 'function'
                ? paymentStatusBadge('PAID') : '<span class="badge badge-green">PAID</span>';
        }
        if (canPayBooking(b)) {
            return '<span class="badge badge-orange">UNPAID</span>';
        }
        if (!b.paymentStatus || b.paymentStatus === '—') {
            return '<span class="badge badge-gray">—</span>';
        }
        return typeof paymentStatusBadge === 'function'
            ? paymentStatusBadge(b.paymentStatus) : b.paymentStatus;
    }

    function isOwnBooking(b) {
        if (typeof isAdmin === 'function' && isAdmin()) return true;
        if (!currentUser) return false;
        if (b.user && b.user.id === currentUser.id) return true;
        return currentUser.studentIdNumber && b.studentId === currentUser.studentIdNumber;
    }

    function patchBookingsTableHeader() {
        const thead = document.querySelector('#bookingsTable thead tr');
        if (!thead || thead.querySelector('.col-booking-fee')) return;
        const feeTh = document.createElement('th');
        feeTh.className = 'col-booking-fee';
        feeTh.textContent = 'Fee';
        const payTh = document.createElement('th');
        payTh.className = 'col-booking-pay';
        payTh.textContent = 'Payment';
        const statusTh = [...thead.children].find(th => th.textContent.trim() === 'Status');
        if (statusTh) {
            thead.insertBefore(feeTh, statusTh);
            thead.insertBefore(payTh, statusTh.nextElementSibling);
        } else {
            thead.appendChild(feeTh);
            thead.appendChild(payTh);
        }
    }

    function renderBookingsWithPayment(list) {
        const tbody = document.getElementById('bookingsTableBody');
        if (!tbody) return;
        const colCount = 10;
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" class="loading-msg">No bookings found</td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(b => {
            const payBadge = paymentLabel(b);
            const showPay = canPayBooking(b) && isOwnBooking(b);
            return `
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
            <td>${fmtRm(b.estimatedCost)}</td>
            <td>${payBadge}</td>
            <td>${statusBadge(b.status)}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${showPay ? `<button type="button" class="btn-icon btn-confirm" onclick="openBookingPaymentModal(${b.id})">Pay Now</button>` : ''}
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
        </tr>`;
        }).join('');
    }

    window.openBookingPaymentModal = function (bookingId) {
        const b = (typeof allBookings !== 'undefined' ? allBookings : []).find(x => x.id === bookingId);
        if (!b) {
            showToast('Booking not found', true);
            return;
        }
        if (typeof openPaymentGateway === 'function') {
            openPaymentGateway({
                type: 'booking',
                id: bookingId,
                amount: b.estimatedCost,
                label: `Booking #${bookingId}`,
                studentName: b.studentName
            });
        } else {
            showToast('Payment gateway not loaded', true);
        }
    };

    window.promptBookingPayment = function (booking) {
        if (!booking || !canPayBooking(booking)) return;
        if (!confirm(`Booking created. Pay ${fmtRm(booking.estimatedCost)} now to confirm your slot?`)) {
            showToast('Booking saved — pay later from My bookings');
            return;
        }
        openBookingPaymentModal(booking.id);
    };

    const _loadBookings = typeof loadBookings === 'function' ? loadBookings : null;
    if (_loadBookings) {
        loadBookings = async function () {
            const tbody = document.getElementById('bookingsTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="10" class="loading-msg">Loading...</td></tr>';
            }
            try {
                allBookings = await authFetch('/api/bookings').then(r => r.json());
                renderBookingsWithPayment(allBookings);
            } catch (err) {
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="10" class="loading-msg">Failed to load bookings</td></tr>';
                }
            }
        };
    }

    function wireBookingSubmitPaymentPrompt() {
        const form = document.getElementById('bookingForm');
        if (!form || form.dataset.paymentPromptWired) return;
        form.dataset.paymentPromptWired = '1';
        form.addEventListener('submit', function (e) {
            if (!e.bookingPaymentHook) return;
        }, true);
    }

    function patchBookingHoursSubmitSuccess() {
        const form = document.getElementById('bookingForm');
        if (!form) return;
        form.addEventListener('submit', async function bookingPayAfterCreate(e) {
            if (e.defaultPrevented) return;
            e.preventDefault();
            e.stopImmediatePropagation();

            const facilityId = document.getElementById('bFacility').value;
            const start = document.getElementById('bStartTime').value;
            const end = document.getElementById('bEndTime').value;
            if (facilityId && start && end && typeof resolveBookingHours === 'function') {
                const hours = await resolveBookingHours(facilityId);
                if (hours && typeof isSlotWithinHours === 'function' && !isSlotWithinHours(start, end, hours.open, hours.close)) {
                    const errEl = document.getElementById('bookingError');
                    errEl.textContent = `Booking must be within operating hours (${hours.open}–${hours.close}) and end after start.`;
                    errEl.classList.add('visible');
                    return;
                }
            }

            const payload = typeof bookingFormPayload === 'function' ? bookingFormPayload() : null;
            if (!payload) return;

            const errEl = document.getElementById('bookingError');
            const joinBtn = document.getElementById('joinWaitlistBtn');
            errEl.classList.remove('visible');
            if (joinBtn) joinBtn.style.display = 'none';

            try {
                const res = await authFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
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
                closeModal();
                if (typeof loadBookings === 'function') await loadBookings();
                if (typeof loadWaitlist === 'function') await loadWaitlist();
                if (typeof loadDashboard === 'function') await loadDashboard();

                const cost = Number(data.estimatedCost || data.estimated_cost || 0);
                if (cost > 0 && data.status === 'PENDING') {
                    showToast('Booking created — pay now to confirm your slot');
                    window.pendingPayBookingId = data.id;
                    if (typeof allBookings !== 'undefined') {
                        const idx = allBookings.findIndex(x => x.id === data.id);
                        if (idx >= 0) allBookings[idx] = data;
                        else allBookings.unshift(data);
                    }
                    setTimeout(() => {
                        if (typeof openBookingPaymentModal === 'function') {
                            openBookingPaymentModal(data.id);
                        } else {
                            promptBookingPayment(data);
                        }
                    }, 500);
                } else {
                    showToast(cost > 0 ? 'Booking saved' : 'Booking confirmed (no fee for this facility)');
                }
            } catch (err) {
                errEl.textContent = 'Network error. Please try again.';
                errEl.classList.add('visible');
            }
        }, true);
    }

    function boot() {
        patchBookingsTableHeader();
        wireBookingSubmitPaymentPrompt();
        patchBookingHoursSubmitSuccess();
        if (typeof loadBookings === 'function') {
            const nav = document.querySelector('.nav-item[data-page="bookings"]');
            if (nav) {
                nav.addEventListener('click', () => setTimeout(() => loadBookings(), 100));
            }
        }
        if (typeof allBookings !== 'undefined' && allBookings.length) {
            renderBookingsWithPayment(allBookings);
        } else if (typeof loadBookings === 'function') {
            loadBookings();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
