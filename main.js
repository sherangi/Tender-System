let provider;
let signer;
let contract;
let userAddress = null;

const contractAddress = "0x0BA9aE1Ee413768A4fe2B7539CC5A551969D43E0"; 

const abi = [
{
    "inputs":[
        {"internalType":"address","name":"user1","type":"address"},
        {"internalType":"address","name":"user2","type":"address"},
        {"internalType":"address","name":"user3","type":"address"}
    ],
    "stateMutability":"nonpayable",
    "type":"constructor"
},
{"inputs":[],"name":"biddingEndTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"biddingOpen","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"bids","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"uint256","name":"biddingDurationInSeconds","type":"uint256"}],"name":"createTender","outputs":[],"stateMutability":"nonpayable","type":"function"},
{"inputs":[],"name":"finalizeTender","outputs":[],"stateMutability":"nonpayable","type":"function"},
{"inputs":[],"name":"getVotingResult","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"getWinner","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"hasBid","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"hasVoted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"highestBid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"highestBidder","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isAuthorized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"noVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"placeOrUpdateBid","outputs":[],"stateMutability":"payable","type":"function"},
{"inputs":[],"name":"voteNo","outputs":[],"stateMutability":"nonpayable","type":"function"},
{"inputs":[],"name":"voteYes","outputs":[],"stateMutability":"nonpayable","type":"function"},
{"inputs":[],"name":"votingClosed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
{"inputs":[],"name":"yesVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

// ================= HELPERS =================
function el(id) { return document.getElementById(id); }
function setEl(id, val) { const e = el(id); if (e) e.innerText = val; }

// ================= CONNECT WALLET =================

async function connectWallet() {
    if (!window.ethereum) { alert("Install MetaMask"); return; }

    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);
    userAddress = await signer.getAddress();

    // Update connect button
    const connectBtn = document.querySelector('.connect-btn');
    if (connectBtn) {
        connectBtn.style.background = 'linear-gradient(135deg, rgba(16,185,129,.88), rgba(52,211,153,.88))';
        connectBtn.innerHTML = '<span class="mm-fox">✓</span> Connected';
    }

    // Load voters on admin dashboard
    loadAuthorizedVoters();

    // Show connected notification
    const shortAddr = userAddress.slice(0,6) + '...' + userAddress.slice(-4);
    alert('✅ Wallet Connected!\n\nAddress: ' + shortAddr);

    updateDashboard();

    // Auto-refresh every 10 seconds
    setInterval(updateDashboard, 10000);
}

// ================= AUTHORIZED VOTERS =================

function loadAuthorizedVoters() {
    const voterList = el('voterList');
    if (!voterList) return;
    const addrs = [
        '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
        '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
        '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db'
    ];
    const icons = ['🧑💼', '👩💼', '🧑⚖️'];
    const roles = ['Procurement Officer', 'Finance Director', 'Legal Advisor'];
    voterList.innerHTML = addrs.map((a, i) => `
        <div class="voter-card">
          <span class="v-avatar">${icons[i]}</span>
          <div class="v-info">
            <span class="v-role">${roles[i]}</span>
            <span class="v-addr" title="${a}">${a.slice(0,10)}…${a.slice(-6)}</span>
          </div>
          <span class="v-badge">#${i+1}</span>
        </div>`).join('');
}

// ================= PIE CHART UPDATE =================

function updatePieChart(bids) {
    // bids = [{addr, amount}]
    const colors = ['#6366f1','#8b5cf6','#ec4899','#22d3ee','#10b981','#f59e0b'];
    const total = bids.reduce((s, b) => s + b.amount, 0);

    // Admin pie
    const adminLegend = el('bidLegend');
    const adminPie = el('pieChart');

    // Bidder pie
    const bdLegend = el('bdLegend');
    const bdPie = el('bdPieChart');

    if (bids.length === 0) {
        if (adminLegend) adminLegend.innerHTML = '<div class="legend-item"><span class="dot" style="background:#6366f1"></span>No bids yet</div>';
        if (bdLegend) bdLegend.innerHTML = '<div class="bd-legend-item"><span class="bd-dot" style="background:#6366f1"></span>No bids yet</div>';
        return;
    }

    // Build SVG pie paths
    let paths = '';
    let legendHtml = '';
    let bdLegendHtml = '';
    let startAngle = -Math.PI / 2;

    bids.forEach((b, i) => {
        const slice = (b.amount / total) * 2 * Math.PI;
        const endAngle = startAngle + slice;
        const x1 = 50 + 40 * Math.cos(startAngle);
        const y1 = 50 + 40 * Math.sin(startAngle);
        const x2 = 50 + 40 * Math.cos(endAngle);
        const y2 = 50 + 40 * Math.sin(endAngle);
        const large = slice > Math.PI ? 1 : 0;
        const color = colors[i % colors.length];
        paths += `<path d="M 50 50 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 40 40 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
        const pct = ((b.amount / total) * 100).toFixed(1);
        const shortAddr = b.addr.slice(0,6) + '…' + b.addr.slice(-4);
        legendHtml += `<div class="legend-item"><span class="dot" style="background:${color}"></span>${shortAddr} (${pct}%)</div>`;
        bdLegendHtml += `<div class="bd-legend-item"><span class="bd-dot" style="background:${color}"></span>${shortAddr} (${pct}%)</div>`;
        startAngle = endAngle;
    });

    if (adminPie) adminPie.innerHTML = paths;
    if (adminLegend) adminLegend.innerHTML = legendHtml;
    if (bdPie) bdPie.innerHTML = paths;
    if (bdLegend) bdLegend.innerHTML = bdLegendHtml;
}

// ================= DASHBOARD UPDATE =================

async function updateDashboard() {
    if (!contract) return;

    try {
        const yes = await contract.yesVotes();
        const no = await contract.noVotes();
        const highest = await contract.highestBid();
        const highestBidder = await contract.highestBidder();
        const votingClosed = await contract.votingClosed();
        const biddingOpen = await contract.biddingOpen();

        const yesNum = yes.toNumber();
        const noNum = no.toNumber();
        const total = yesNum + noNum;
        const highestEth = ethers.utils.formatEther(highest);

        // ---- Admin dashboard elements ----
        setEl('totalVotes', total);
        setEl('totalBids', highestEth + ' ETH');

        if (el('yesCount')) el('yesCount').innerText = yesNum;
        if (el('noCount')) el('noCount').innerText = noNum;

        const yesPercent = total > 0 ? (yesNum / total) * 100 : 0;
        const noPercent  = total > 0 ? (noNum  / total) * 100 : 0;

        if (el('yesBar')) { el('yesBar').style.width = yesPercent + '%'; }
        if (el('noBar'))  { el('noBar').style.width  = noPercent  + '%'; }
        if (el('yesPercent')) el('yesPercent').innerText = Math.round(yesPercent) + '%';
        if (el('noPercent'))  el('noPercent').innerText  = Math.round(noPercent)  + '%';

        // KPI progress bars
        if (el('votesProgress')) el('votesProgress').style.width = ((total / 3) * 100) + '%';
        if (el('bidsProgress'))  el('bidsProgress').style.width  = Math.min(parseFloat(highestEth) * 10, 100) + '%';

        // Voting status
        const statusEl = el('votingStatus');
        if (statusEl) {
            statusEl.innerText = !votingClosed ? 'Ongoing' : biddingOpen ? 'Approved' : 'Closed';
        }

        // ---- Bidder dashboard elements ----
        setEl('bd-highestBid', highestEth + ' ETH');

        // Active bidders count from localStorage bidders
        const bidders = JSON.parse(localStorage.getItem('bidders') || '[]');
        setEl('bd-activeBidders', bidders.length);
        setEl('participants', bidders.length);
        if (el('participantsProgress')) el('participantsProgress').style.width = Math.min(bidders.length * 20, 100) + '%';

        // ---- Pie chart: build bids array ----
        const bidsData = [];
        if (highestBidder && highestBidder !== '0x0000000000000000000000000000000000000000') {
            bidsData.push({ addr: highestBidder, amount: parseFloat(highestEth) });
        }
        updatePieChart(bidsData);

    } catch (err) {
        console.log("Dashboard update error:", err);
    }
}

// ================= VOTING =================

async function voteYes() {
    if (!contract) { alert("Connect wallet first"); return; }
    try {
        const tx = await contract.voteYes();
        await tx.wait();
        // Save local vote record
        const admin = JSON.parse(localStorage.getItem('currentAdmin') || '{}');
        if (admin.role) {
            const votes = JSON.parse(localStorage.getItem('adminVotes') || '{}');
            votes[admin.role] = 'yes';
            localStorage.setItem('adminVotes', JSON.stringify(votes));
        }
        alert("Vote YES successful");
        updateDashboard();
    } catch (err) { alert(err.reason || "Transaction failed"); }
}

async function voteNo() {
    if (!contract) { alert("Connect wallet first"); return; }
    try {
        const tx = await contract.voteNo();
        await tx.wait();
        // Save local vote record
        const admin = JSON.parse(localStorage.getItem('currentAdmin') || '{}');
        if (admin.role) {
            const votes = JSON.parse(localStorage.getItem('adminVotes') || '{}');
            votes[admin.role] = 'no';
            localStorage.setItem('adminVotes', JSON.stringify(votes));
        }
        alert("Vote NO successful");
        updateDashboard();
    } catch (err) { alert(err.reason || "Transaction failed"); }
}

// ================= CREATE TENDER =================

async function createTender() {
    if (!contract) { alert("Connect wallet first"); return; }
    try {
        const duration = el("duration").value;
        if (!duration) { alert("Enter bidding duration"); return; }
        const tx = await contract.createTender(duration);
        await tx.wait();
        alert("Tender created successfully");
        updateDashboard();
    } catch (err) { alert(err.reason || "Transaction failed"); }
}

// ================= PLACE BID =================

async function placeBid() {
    if (!contract) { alert("Connect wallet first"); return; }
    try {
        const amount = el("bidAmount").value;
        if (!amount) { alert("Enter bid amount"); return; }
        const value = ethers.utils.parseEther(amount);
        const tx = await contract.placeOrUpdateBid({ value });
        await tx.wait();
        alert("Bid placed successfully");
        updateDashboard();
    } catch (err) { alert(err.reason || "Transaction failed"); }
}

// ================= FINALIZE =================

async function finalizeTender() {
    if (!contract) { alert("Connect wallet first"); return; }
    try {
        const tx = await contract.finalizeTender();
        await tx.wait();
        alert("✅ Tender finalized!");
        // getWinner requires biddingOpen = false
        try {
            const winner = await contract.getWinner();
            const addr = winner[0];
            const amount = ethers.utils.formatEther(winner[1]);
            const winnerInfo = el('winnerInfo');
            if (winnerInfo) winnerInfo.innerHTML = `🏆 <strong>${addr.slice(0,10)}...${addr.slice(-6)}</strong><br>${amount} ETH`;
            alert("🏆 Winner: " + addr + "\nAmount: " + amount + " ETH");
        } catch(e) { console.log('getWinner:', e.reason); }
        updateDashboard();
    } catch (err) { alert(err.reason || "Transaction failed"); }
}

// ================= AUTHENTICATION =================

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm && !loginForm.getAttribute('onsubmit')) {
        loginForm.addEventListener('submit', handleLogin);
        const emailEl = document.getElementById('email');
        const passEl = document.getElementById('password');
        if (emailEl) emailEl.addEventListener('blur', (e) => validateEmail(e.target));
        if (passEl) passEl.addEventListener('blur', (e) => validatePassword(e.target));
    }

    if (registerForm && !registerForm.getAttribute('onsubmit')) {
        registerForm.addEventListener('submit', handleRegister);
        ['fullName','email','password','confirmPassword','organization'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('blur', (e) => {
                if (id === 'fullName') validateFullName(e.target);
                else if (id === 'email') validateEmail(e.target);
                else if (id === 'password') validatePassword(e.target);
                else if (id === 'confirmPassword') validateConfirmPassword(document.getElementById('password'), e.target);
                else if (id === 'organization') validateOrganization(e.target);
            });
        });
    }
});

function validateEmail(input) {
    const err = el('emailError');
    if (!input.value.trim()) { showError(input, err, 'Email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) { showError(input, err, 'Invalid email format'); return false; }
    showSuccess(input, err); return true;
}

function validatePassword(input) {
    const err = el('passwordError');
    if (!input.value) { showError(input, err, 'Password is required'); return false; }
    if (input.value.length < 6) { showError(input, err, 'Password must be at least 6 characters'); return false; }
    showSuccess(input, err); return true;
}

function validateFullName(input) {
    const err = el('fullNameError');
    if (!input.value.trim()) { showError(input, err, 'Full name is required'); return false; }
    if (input.value.trim().length < 3) { showError(input, err, 'Name must be at least 3 characters'); return false; }
    showSuccess(input, err); return true;
}

function validateConfirmPassword(passwordInput, confirmInput) {
    const err = el('confirmPasswordError');
    if (!confirmInput.value) { showError(confirmInput, err, 'Please confirm your password'); return false; }
    if (passwordInput.value !== confirmInput.value) { showError(confirmInput, err, 'Passwords do not match'); return false; }
    showSuccess(confirmInput, err); return true;
}

function validateOrganization(input) {
    const err = el('organizationError');
    if (!input.value.trim()) { showError(input, err, 'Organization is required'); return false; }
    showSuccess(input, err); return true;
}

function showError(input, errorElement, message) {
    if (!input || !errorElement) return;
    input.classList.add('error'); input.classList.remove('success');
    errorElement.textContent = message;
}

function showSuccess(input, errorElement) {
    if (!input || !errorElement) return;
    input.classList.remove('error'); input.classList.add('success');
    errorElement.textContent = '';
}

function handleLogin(e) {
    e.preventDefault();
    const emailInput = el('email');
    const passwordInput = el('password');
    if (validateEmail(emailInput) && validatePassword(passwordInput)) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === emailInput.value.trim() && u.password === passwordInput.value);
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            alert('Login successful! Please connect your MetaMask wallet.');
            window.location.href = 'index.html';
        } else {
            alert('Invalid email or password');
        }
    }
}

function handleRegister(e) {
    e.preventDefault();
    const fullNameInput = el('fullName');
    const emailInput = el('email');
    const passwordInput = el('password');
    const confirmPasswordInput = el('confirmPassword');
    const organizationInput = el('organization');

    if (validateFullName(fullNameInput) && validateEmail(emailInput) &&
        validatePassword(passwordInput) && validateConfirmPassword(passwordInput, confirmPasswordInput) &&
        validateOrganization(organizationInput)) {

        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.some(u => u.email === emailInput.value.trim())) {
            alert('Email already registered'); return;
        }
        users.push({
            fullName: fullNameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value,
            organization: organizationInput.value.trim(),
            registeredAt: new Date().toISOString()
        });
        localStorage.setItem('users', JSON.stringify(users));
        alert('Registration successful! Please login.');
        window.location.href = 'login.html';
    }
}

// ================= LOGOUT & SESSION =================

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

function checkUserSession() {
    const currentUser = localStorage.getItem('currentUser');
    const userInfo = el('userInfo');
    const logoutBtn = el('logoutBtn');
    if (currentUser && userInfo && logoutBtn) {
        const user = JSON.parse(currentUser);
        userInfo.textContent = `👤 ${user.fullName}`;
        userInfo.style.display = 'inline';
        logoutBtn.style.display = 'flex';
        setTimeout(() => {
            if (!userAddress && window.ethereum) {
                if (confirm('Connect your MetaMask wallet to access all features?')) connectWallet();
            }
        }, 500);
    }
}

if (el('userInfo')) checkUserSession();

// ================= BIDDER AUTH =================

window.handleBidderLogin = function(event) {
    event.preventDefault();
    const emailStr = el('email').value.trim();
    const passStr = el('password').value;
    const storedBidders = JSON.parse(localStorage.getItem('bidders') || '[]');
    const validUser = storedBidders.find(b => b.email === emailStr && b.password === passStr);

    if (validUser) {
        localStorage.setItem('currentBidder', JSON.stringify(validUser));
        const successToast = el('successToast');
        if (successToast) successToast.style.display = 'block';
        setTimeout(() => { window.location.href = 'bidder_dashboard.html'; }, 1500);
    } else {
        const modal = el('errorModal');
        if (modal) modal.style.display = 'block';
        el('email').style.border = '1px solid rgba(239,68,68,0.8)';
        el('password').style.border = '1px solid rgba(239,68,68,0.8)';
        setTimeout(() => {
            el('email').style.border = '';
            el('password').style.border = '';
        }, 3000);
    }
};

window.handleBidderRegister = function(event) {
    event.preventDefault();
    const username = el('username')?.value.trim() || '';
    const email = el('email')?.value.trim() || '';
    const password = el('password').value;
    const confirmPassword = el('confirmPassword').value;
    const errorToast = el('errorToast');

    const storedBidders = JSON.parse(localStorage.getItem('bidders') || '[]');

    if (password !== confirmPassword) {
        if (errorToast) { errorToast.textContent = 'Passwords do not match.'; errorToast.style.display = 'block'; }
        el('password').style.border = '1px solid rgba(239,68,68,0.8)';
        el('confirmPassword').style.border = '1px solid rgba(239,68,68,0.8)';
        setTimeout(() => {
            if (errorToast) errorToast.style.display = 'none';
            el('password').style.border = '';
            el('confirmPassword').style.border = '';
        }, 3000);
        return;
    }

    if (storedBidders.some(b => b.email === email || b.username === username)) {
        if (errorToast) { errorToast.textContent = 'Username or email already exists.'; errorToast.style.display = 'block'; }
        setTimeout(() => { if (errorToast) errorToast.style.display = 'none'; }, 3000);
        return;
    }

    storedBidders.push({ username, email, password });
    localStorage.setItem('bidders', JSON.stringify(storedBidders));

    const successToast = el('successToast');
    if (successToast) successToast.style.display = 'block';
    setTimeout(() => { window.location.href = 'bidder_login.html'; }, 1500);
};
