/* Mock payment gateway for rental deposits */
let gatewaySelectedMethod = 'CARD';
let gatewaySelectedWallet = 'tng';

function initPaymentGateway() {
    const modal = document.getElementById('paymentModal');
    if (!modal) {
        return;
    }
    document.querySelectorAll('#methodTiles .method-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            document.querySelectorAll('#methodTiles .method-tile').forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            gatewaySelectedMethod = tile.dataset.method;
        });
    });
    document.querySelectorAll('.wallet-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            document.querySelectorAll('.wallet-tile').forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            gatewaySelectedWallet = tile.dataset.wallet;
        });
    });
    const cardInput = document.getElementById('payCardNumber');
    if (cardInput) {
        cardInput.addEventListener('input', formatCardNumber);
    }
    const expiryInput = document.getElementById('payCardExpiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', formatCardExpiry);
    }
}

function formatCardNumber(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatCardExpiry(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) {
        v = v.slice(0, 2) + '/' + v.slice(2);
    }
    e.target.value = v;
}

function showGatewayStep(step) {
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`gatewayStep${i}`);
        if (el) {
            el.classList.toggle('active', i === step);
        }
    }
    const modal = document.getElementById('paymentModal');
    if (modal && step !== 5) {
        modal.classList.remove('failure-mode');
    }
}

function clearGatewayErrors() {
    ['paymentMethodError', 'paymentDetailsError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('visible');
            el.textContent = '';
        }
    });
}

function showGatewayError(id, message) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = message;
        el.classList.add('visible');
    }
}

function ensurePayTargetFields() {
    const modal = document.getElementById('paymentModal');
    if (!modal || document.getElementById('payBookingId')) return;
    const rentalInput = document.getElementById('payRentalId');
    if (rentalInput) {
        const bookingInput = document.createElement('input');
        bookingInput.type = 'hidden';
        bookingInput.id = 'payBookingId';
        bookingInput.value = '';
        rentalInput.after(bookingInput);
    }
    const typeInput = document.createElement('input');
    typeInput.type = 'hidden';
    typeInput.id = 'payTargetType';
    typeInput.value = 'rental';
    document.getElementById('payRentalId')?.before(typeInput);
}

function openPaymentGateway(opts) {
    ensurePayTargetFields();
    const type = opts.type || 'rental';
    const id = opts.id;
    const amount = Number(opts.amount || 0).toFixed(2);
    clearGatewayErrors();
    document.getElementById('payTargetType').value = type;
    document.getElementById('payRentalId').value = type === 'rental' ? String(id) : '';
    const bookingEl = document.getElementById('payBookingId');
    if (bookingEl) bookingEl.value = type === 'booking' ? String(id) : '';
    document.getElementById('paySummaryRef').textContent = opts.label || (type === 'booking' ? `Booking #${id}` : `Rental #${id}`);
    document.getElementById('paySummaryStudent').textContent = opts.studentName || '—';
    document.getElementById('paySummaryAmount').textContent = `RM ${amount}`;
    document.getElementById('payCashRef').textContent = `#${id}`;

    gatewaySelectedMethod = 'CARD';
    gatewaySelectedWallet = 'tng';
    document.querySelectorAll('#methodTiles .method-tile').forEach(t => {
        t.classList.toggle('active', t.dataset.method === 'CARD');
    });
    document.querySelectorAll('.wallet-tile').forEach(t => {
        t.classList.toggle('active', t.dataset.wallet === 'tng');
    });

    ['payCardNumber', 'payCardName', 'payCardExpiry', 'payCardCvv'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const bank = document.getElementById('payBankCode');
    if (bank) bank.value = 'maybank';

    document.getElementById('gatewayResultSuccess').classList.remove('visible');
    document.getElementById('gatewayResultFailure').classList.remove('visible');
    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.remove('failure-mode');
    showGatewayStep(1);
    openModal('paymentModal');
}

function openPaymentModal(rentalId) {
    const r = allRentals.find(x => x.id === rentalId);
    openPaymentGateway({
        type: 'rental',
        id: rentalId,
        amount: r && r.depositAmount != null ? r.depositAmount : 0,
        label: `Rental #${rentalId}`,
        studentName: r ? r.studentName : '—'
    });
}

function closePaymentGateway() {
    closeModal();
}

function proceedToPaymentDetails() {
    clearGatewayErrors();
    const active = document.querySelector('#methodTiles .method-tile.active');
    if (!active) {
        showGatewayError('paymentMethodError', 'Please select a payment method');
        return;
    }
    gatewaySelectedMethod = active.dataset.method;
    showGatewayDetailsPanel(gatewaySelectedMethod);
    showGatewayStep(3);
}

function showGatewayDetailsPanel(method) {
    const titles = {
        CARD: 'Card details',
        ONLINE_BANKING: 'Online banking',
        E_WALLET: 'E-wallet',
        CASH: 'Cash payment'
    };
    document.getElementById('gatewayDetailsTitle').textContent = titles[method] || 'Payment details';
    document.querySelectorAll('.gateway-details-panel').forEach(p => p.classList.remove('active'));
    const map = {
        CARD: 'detailsCard',
        ONLINE_BANKING: 'detailsBanking',
        E_WALLET: 'detailsWallet',
        CASH: 'detailsCash'
    };
    const panel = document.getElementById(map[method]);
    if (panel) {
        panel.classList.add('active');
    }
}

function validateGatewayDetails() {
    if (gatewaySelectedMethod === 'CASH') {
        return true;
    }
    if (gatewaySelectedMethod === 'CARD') {
        const num = document.getElementById('payCardNumber').value.replace(/\D/g, '');
        const name = document.getElementById('payCardName').value.trim();
        const exp = document.getElementById('payCardExpiry').value.trim();
        const cvv = document.getElementById('payCardCvv').value.trim();
        if (num.length < 15) {
            showGatewayError('paymentDetailsError', 'Enter a valid card number');
            return false;
        }
        if (!name) {
            showGatewayError('paymentDetailsError', 'Enter the name on card');
            return false;
        }
        if (!/^\d{2}\/\d{2}$/.test(exp)) {
            showGatewayError('paymentDetailsError', 'Enter expiry as MM/YY');
            return false;
        }
        if (cvv.length < 3) {
            showGatewayError('paymentDetailsError', 'Enter a valid CVV');
            return false;
        }
        return true;
    }
    if (gatewaySelectedMethod === 'ONLINE_BANKING') {
        if (!document.getElementById('payBankCode').value) {
            showGatewayError('paymentDetailsError', 'Select your bank');
            return false;
        }
        return true;
    }
    if (gatewaySelectedMethod === 'E_WALLET') {
        if (!gatewaySelectedWallet) {
            showGatewayError('paymentDetailsError', 'Select an e-wallet provider');
            return false;
        }
        return true;
    }
    return true;
}

function buildProcessPayload() {
    const payload = {};
    if (gatewaySelectedMethod === 'CARD') {
        payload.cardNumber = document.getElementById('payCardNumber').value;
    } else if (gatewaySelectedMethod === 'ONLINE_BANKING') {
        payload.bankCode = document.getElementById('payBankCode').value;
    } else if (gatewaySelectedMethod === 'E_WALLET') {
        payload.walletProvider = gatewaySelectedWallet;
    }
    return payload;
}

async function submitGatewayPayment() {
    clearGatewayErrors();
    if (!validateGatewayDetails()) {
        return;
    }

    ensurePayTargetFields();
    const targetType = document.getElementById('payTargetType')?.value || 'rental';
    const createBody = { method: gatewaySelectedMethod };
    if (targetType === 'booking') {
        const bookingId = document.getElementById('payBookingId')?.value;
        createBody.bookingId = Number(bookingId);
    } else {
        createBody.rentalId = Number(document.getElementById('payRentalId').value);
    }
    const submitBtn = document.getElementById('paySubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
    }

    try {
        const createRes = await authFetch('/api/payments', {
            method: 'POST',
            body: JSON.stringify(createBody)
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
            showGatewayError('paymentDetailsError', createData.error || 'Could not create payment');
            return;
        }

        showGatewayStep(4);
        await new Promise(r => setTimeout(r, 1800));

        const processRes = await authFetch(`/api/payments/${createData.id}/process`, {
            method: 'POST',
            body: JSON.stringify(buildProcessPayload())
        });
        const processData = await processRes.json().catch(() => ({}));

        const modal = document.getElementById('paymentModal');
        document.getElementById('gatewayResultSuccess').classList.remove('visible');
        document.getElementById('gatewayResultFailure').classList.remove('visible');

        if (processRes.ok && processData.status === 'PAID') {
            document.getElementById('payTxnRef').textContent = processData.transactionRef || '—';
            
            const receiptBtn = document.getElementById('viewReceiptBtn');
            if (receiptBtn && processData.transactionRef) {
                receiptBtn.href = `/receipt.html?ref=${processData.transactionRef}`;
            }

            document.getElementById('gatewayResultSuccess').classList.add('visible');
            if (modal) modal.classList.remove('failure-mode');
            showToast('Payment successful');
        } else {
            document.getElementById('payFailureMessage').textContent =
                processData.message || processData.error || 'Payment could not be completed';
            document.getElementById('gatewayResultFailure').classList.add('visible');
            if (modal) modal.classList.add('failure-mode');
        }
        showGatewayStep(5);
    } catch (err) {
        showGatewayStep(3);
        showGatewayError('paymentDetailsError', 'Network error. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

function retryGatewayPayment() {
    clearGatewayErrors();
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('failure-mode');
    }
    document.getElementById('gatewayResultSuccess').classList.remove('visible');
    document.getElementById('gatewayResultFailure').classList.remove('visible');
    showGatewayDetailsPanel(gatewaySelectedMethod);
    showGatewayStep(3);
}

async function finishPaymentGateway() {
    closePaymentGateway();
    if (typeof loadRentals === 'function') await loadRentals();
    if (typeof loadBookings === 'function') await loadBookings();
    if (typeof loadDashboard === 'function') await loadDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
    ensurePayTargetFields();
    initPaymentGateway();
});

(function loadFeatureScripts() {
    const chain = [
        { src: '/js/features-ui.js', key: 'featuresUi' },
        { src: '/js/modal-fix.js', key: 'modalFix' },
        { src: '/js/booking-hours-fix.js', key: 'bookingHoursFix' },
        { src: '/js/booking-payment-ui.js', key: 'bookingPaymentUi' },
        { src: '/js/booking-pricing-ui.js', key: 'bookingPricingUi' }
    ];
    function loadNext(i, done) {
        if (i >= chain.length) {
            if (done) done();
            return;
        }
        const item = chain[i];
        const attr = 'data-' + item.key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        const existing = document.querySelector('script[' + attr + ']');
        if (existing) {
            loadNext(i + 1, done);
            return;
        }
        const s = document.createElement('script');
        s.src = item.src;
        s.dataset[item.key] = '1';
        s.onload = () => loadNext(i + 1, done);
        s.onerror = () => loadNext(i + 1, done);
        document.body.appendChild(s);
    }
    if (document.querySelector('script[data-features-ui]')) {
        return;
    }
    loadNext(0, null);
})();
