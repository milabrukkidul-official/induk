const AVATAR_MALE = 'https://www.w3schools.com/howto/img_avatar.png';
const AVATAR_FEMALE = 'https://www.w3schools.com/howto/img_avatar2.png';

function getAvatar(gender) {
    if (gender === 'P' || gender === 'Perempuan') return AVATAR_FEMALE;
    return AVATAR_MALE;
}

// Nilai default untuk pengaturan (agar langsung terisi di Incognito)
const DEFAULT_SETTINGS = {
    Instansi: 'SDN INDOEK SISWA',
    Alamat: 'Jl. Pendidikan No. 123, Lumajang',
    Kota: 'Lumajang',
    KepalaSekolah: 'SAHRONI, S.Pd.',
    Tanggal: getLocalDateString(),
    LogoUrl: 'https://i.ibb.co.com/KjmVNfP3/LOGO-MI-LABRUK-MINM.png'
};

function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// State management
let state = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    view: localStorage.getItem('active_view') || 'dashboard',
    students: [],
    allStudents: [], // Cache untuk seluruh data
    total: 0,
    page: 1,
    limit: 20,
    search: '',
    loading: false,
    settings: { ...DEFAULT_SETTINGS }
};

// Date Formatter
function formatDateIndo(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    // Clean ISO string if needed
    const cleanDateStr = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const date = new Date(cleanDateStr);
    if (isNaN(date.getTime())) return dateStr;

    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadSettings(); // Panggil segera agar data tanda tangan terisi di Incognito
    if (state.user) {
        initApp();
    }
    // Load local config
    document.getElementById('api-url').value = API.getUrl();
    // Update Sidebar Logo
    const sidebarLogo = document.getElementById('sidebar-logo');
    if (sidebarLogo) {
        sidebarLogo.src = state.settings.LogoUrl || 'https://via.placeholder.com/150x50?text=LOGO';
    }

    updateConfigVisibility();
});

function checkAuth() {
    const authView = document.getElementById('auth-view');
    if (!state.user) {
        authView.classList.remove('hidden');
    } else {
        authView.classList.add('hidden');
        document.getElementById('current-user').innerText = `Logged in as: ${state.user.role === 'admin' ? 'Admin' : state.user.student.NamaLengkap}`;

        // Visibility based on role
        if (state.user.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.student-only').forEach(el => el.classList.add('hidden'));
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.student-only').forEach(el => el.classList.remove('hidden'));
            
            // Redirect students away from admin views
            if (state.view === 'dashboard' || state.view === 'students') {
                state.view = 'profile';
                localStorage.setItem('active_view', 'profile');
            }
        }
    }
}

function initApp() {
    loadSettings();
    // Restore active menu UI
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.getAttribute('onclick').includes(`'${state.view}'`)) {
            l.classList.add('active');
        }
    });
    showView(state.view);
}

async function refreshData() {
    if (state.view === 'dashboard') {
        loadDashboardStats();
    } else if (state.view === 'students') {
        loadStudents();
    }
}

async function loadDashboardStats() {
    const res = await API.request('getStudents', { limit: 1000 });
    if (res && res.data) {
        const students = res.data;
        document.getElementById('total-students-count').innerText = res.total;
        document.getElementById('male-count').innerText = students.filter(s => s.Jenis_Kelamin === 'L' || s.Jenis_Kelamin === 'Laki-laki').length;
        document.getElementById('female-count').innerText = students.filter(s => s.Jenis_Kelamin === 'P' || s.Jenis_Kelamin === 'Perempuan').length;
    }
}

async function loadSettings() {
    // Isi field dengan nilai default dulu (agar tidak kosong saat loading)
    populateSettingsUI(state.settings);

    if (!API.getUrl()) return;

    try {
        const res = await API.request('getSettings');
        if (res) {
            // Gabungkan hasil API dengan default (untuk jaga-jaga jika ada field kosong di API)
            state.settings = { ...DEFAULT_SETTINGS, ...res };
            populateSettingsUI(state.settings);

            // Sinkronkan API URL dari sheet jika ada dan berbeda
            if (res.ApiUrl && res.ApiUrl !== API.getUrl()) {
                API.setUrl(res.ApiUrl);
                document.getElementById('api-url').value = res.ApiUrl;
            }
            return true;
        }
    } catch (e) {
        console.error("Gagal memuat pengaturan:", e);
    }
    return false;
}

function populateSettingsUI(settings) {
    if (document.getElementById('set-kota')) document.getElementById('set-kota').value = settings.Kota || '';
    
    if (document.getElementById('set-tanggal')) {
        let tgl = settings.Tanggal || '';
        // Konversi ke YYYY-MM-DD jika formatnya DD-MM-YYYY agar muncul di input date
        if (tgl.includes('-')) {
            let parts = tgl.split('-');
            if (parts[0].length === 2) { // Jika DD-MM-YYYY
                tgl = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        document.getElementById('set-tanggal').value = tgl;
    }
    
    if (document.getElementById('set-kepala-sekolah')) document.getElementById('set-kepala-sekolah').value = settings.KepalaSekolah || '';
    if (document.getElementById('set-logo-url')) document.getElementById('set-logo-url').value = settings.LogoUrl || '';
    // Jangan isi password dari server (untuk keamanan)
    // Biarkan kosong, user hanya isi jika ingin mengubah
}

function updateConfigVisibility() {
    const hasUrl = !!API.getUrl();
    const loginLink = document.getElementById('login-config-link');
    if (loginLink) {
        if (hasUrl) {
            loginLink.classList.add('hidden');
        } else {
            loginLink.classList.remove('hidden');
        }
    }
}

async function checkConnection() {
    const url = document.getElementById('api-url').value;
    if (!url) return alert('Masukkan URL terlebih dahulu');

    // Temporarily set URL to test
    const oldUrl = API.getUrl();
    API.setUrl(url);

    const res = await API.request('getSettings');
    if (res) {
        alert('Koneksi Berhasil! Data pengaturan ditemukan.');
        loadSettings();
    } else {
        alert('Koneksi Gagal! Periksa kembali URL Script Anda.');
        API.setUrl(oldUrl); // Revert
    }
}

async function loadStudents(forceRefresh = false) {
    if (forceRefresh) state.allStudents = [];

    if (state.allStudents.length === 0) {
        state.loading = true;
        try {
            const res = await API.request('getStudents', { limit: 10000 });
            if (res && res.data) {
                state.allStudents = res.data;
            }
        } catch (error) {
            console.error('Failed to load students:', error);
        } finally {
            state.loading = false;
        }
    }

    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const q = document.getElementById('search-input').value.toLowerCase();

    const filtered = state.allStudents.filter(s => {
        return !q ||
            (s.NamaLengkap && s.NamaLengkap.toLowerCase().includes(q)) ||
            (s.NIS && s.NIS.toString().includes(q)) ||
            (s.Kelas && s.Kelas.toLowerCase().includes(q));
    });

    // Update Dashboard Stats (from total dataset)
    const elTotal = document.getElementById('total-students');
    const elMale = document.getElementById('total-male');
    const elFemale = document.getElementById('total-female');

    if (elTotal) elTotal.innerText = state.allStudents.length;
    if (elMale) elMale.innerText = state.allStudents.filter(s => s.Jenis_Kelamin === 'L').length;
    if (elFemale) elFemale.innerText = state.allStudents.filter(s => s.Jenis_Kelamin === 'P').length;

    // Pagination info
    const total = filtered.length;
    const totalPages = Math.ceil(total / state.limit) || 1;

    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const offset = (state.page - 1) * state.limit;
    state.students = filtered.slice(offset, offset + state.limit);

    renderStudentsTable();
    updatePagination(totalPages);
}

function renderLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;

    if (show) {
        overlay.classList.remove('hidden');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.opacity = '1', 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function renderStudentsTable() {
    const body = document.getElementById('students-body');
    body.innerHTML = state.students.map(s => {
        const avatar = getAvatar(s.Jenis_Kelamin);
        return `
            <tr>
                <td><img src="${s.Foto_URL || avatar}" class="student-thumb" onerror="this.src='${avatar}'"></td>
                <td>${s.NIS}</td>
                <td>${s.NamaLengkap}</td>
                <td>${s.Jenis_Kelamin}</td>
                <td>${s.TempatLahir || '-'}, ${formatDateIndo(s.Tanggal_Lahir)}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-secondary" onclick="viewDetails('${s.NIS}')" title="Detail"><i data-lucide="eye" style="width:14px"></i></button>
                        ${state.user.role === 'admin' ? `
                            <button class="btn btn-secondary" onclick="editStudentExtras('${s.NIS}')" title="Edit Nilai & Lainnya"><i data-lucide="edit-2" style="width:14px"></i></button>
                            <button class="btn btn-secondary" style="color: var(--danger)" onclick="deleteStudent('${s.NIS}')" title="Hapus"><i data-lucide="trash-2" style="width:14px"></i></button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="openPrintModal('${s.NIS}')" title="Cetak"><i data-lucide="printer" style="width:14px"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

// Pagination logic
function updatePagination(totalPages) {
    document.getElementById('current-page').innerText = state.page;
    document.getElementById('total-pages').innerText = totalPages || 1;
}

function goToPage(dir) {
    const totalPages = parseInt(document.getElementById('total-pages').innerText);

    if (dir === 'first') state.page = 1;
    else if (dir === 'last') state.page = totalPages;
    else if (dir === 'prev') state.page = Math.max(1, state.page - 1);
    else if (dir === 'next') state.page = Math.min(totalPages, state.page + 1);
    else if (dir === 'fast-prev') state.page = Math.max(1, state.page - 10);
    else if (dir === 'fast-next') state.page = Math.min(totalPages, state.page + 10);

    applyFiltersAndRender();
}

function changeLimit(val) {
    state.limit = parseInt(val);
    state.page = 1;
    applyFiltersAndRender();
}

let searchTimeout;
function debounceSearch(val) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        state.search = val;
        state.page = 1;
        applyFiltersAndRender();
    }, 500);
}

// Auth Actions
function showLogin(type) {
    document.getElementById('login-selection').classList.add('hidden');
    document.getElementById(`${type}-login`).classList.remove('hidden');
}

function backToSelection() {
    document.getElementById('login-selection').classList.remove('hidden');
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('student-login').classList.add('hidden');
}

async function handleLogin(e, role) {
    e.preventDefault();
    let res;
    if (role === 'admin') {
        const password = document.getElementById('admin-password').value;
        res = await API.request('loginAdmin', {}, { password });
    } else {
        const nis = document.getElementById('student-nis').value;
        const password = document.getElementById('student-password').value;
        res = await API.request('loginStudent', {}, { nis, password });
    }

    if (res && res.success) {
        state.user = { role, student: res.student };
        localStorage.setItem('user', JSON.stringify(state.user));
        checkAuth();
        
        if (role === 'student') {
            showView('profile');
        } else {
            initApp();
        }
    } else {
        alert(res ? res.error : 'Login gagal');
    }
}

function logout() {
    localStorage.removeItem('user');
    state.user = null;
    location.reload();
}

// UI Actions
function showView(view) {
    state.view = view;
    localStorage.setItem('active_view', view);

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    // Find and activate the link
    const links = document.querySelectorAll('.nav-link');
    links.forEach(l => {
        if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(`'${view}'`)) {
            l.classList.add('active');
        }
    });

    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('students-view').classList.add('hidden');
    document.getElementById('profile-view').classList.add('hidden');
    
    const targetView = document.getElementById(`${view}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
        // Trigger animation
        targetView.classList.remove('animate-up');
        void targetView.offsetWidth; // Reflow to restart animation
        targetView.classList.add('animate-up');
        
        if (view === 'profile' && state.user && state.user.student) {
            renderStudentProfile();
        }
    }

    refreshData();
    if (window.innerWidth <= 768) {
        toggleSidebar(false);
    }
}

function renderStudentProfile() {
    const student = state.user.student;
    const content = document.getElementById('profile-content');
    
    let html = `
        <div class="card animate-pop" style="padding: 2rem;">
            <div style="display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-start;">
                <div style="text-align: center;">
                    <img src="${student.Foto_URL || getAvatar(student.Jenis_Kelamin)}" 
                         style="width: 150px; height: 150px; border-radius: 12px; object-fit: cover; border: 4px solid var(--primary); box-shadow: var(--shadow-lg);">
                    <h2 style="margin-top: 1rem; color: var(--primary);">${student.NamaLengkap}</h2>
                    <p style="color: var(--text-muted); font-weight: 600;">NIS: ${student.NIS}</p>
                </div>
                <div style="flex: 1; min-width: 300px;">
                    <div class="grid-2">
    `;
    
    for (let key in student) {
        if (key === 'Password' || key === 'Foto_URL') continue;
        let val = student[key];
        if (key.toLowerCase().includes('tanggal') || key.toLowerCase().includes('tgl')) {
            val = formatDateIndo(val);
        }
        html += `
            <div style="padding: 10px; border-bottom: 1px solid var(--border);">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${key.replace(/_/g, ' ')}</div>
                <div style="font-size: 0.95rem; color: var(--text-main); font-weight: 500;">${val || '-'}</div>
            </div>
        `;
    }
    
    html += `
                    </div>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

function toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (typeof force === 'boolean') {
        if (force) {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        } else {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }
    } else {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

// Config Actions
function toggleConfig() {
    const modal = document.getElementById('config-modal');
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        loadSettings(); // Pre-fill before showing
    }
    modal.classList.toggle('hidden');
}

function saveConfig() {
    const url = document.getElementById('api-url').value;
    API.setUrl(url);

    // Save signature settings
    const settings = {
        Kota: document.getElementById('set-kota').value,
        Tanggal: document.getElementById('set-tanggal').value,
        KepalaSekolah: document.getElementById('set-kepala-sekolah').value,
        LogoUrl: document.getElementById('set-logo-url').value,
        ApiUrl: url
    };

    // Hanya kirim password jika diisi (untuk mengubah password)
    const newPassword = document.getElementById('set-admin-password').value;
    if (newPassword && newPassword.trim() !== '') {
        settings.AdminPassword = newPassword.trim();
    }

    API.request('updateSettings', {}, { settings }).then(res => {
        if (res && res.success) {
            state.settings = { ...state.settings, ...settings };
            alert('Konfigurasi berhasil disimpan.' + (newPassword ? ' Password admin telah diubah.' : ''));
            document.getElementById('set-admin-password').value = ''; // Clear password field
            toggleConfig();
        }
    });
}

// Student Modal Actions
function switchModalTab(tabId) {
    document.querySelectorAll('.modal-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(`link-${tabId}`).classList.add('active');
}

function openStudentModal() {
    document.getElementById('modal-title').innerText = 'Tambah Siswa';
    document.getElementById('student-form').reset();
    switchModalTab('tab-diri');
    const modal = document.getElementById('student-modal');
    modal.classList.remove('hidden');

    // Trigger pop animation
    const content = modal.querySelector('.modal');
    if (content) {
        content.classList.remove('animate-pop');
        void content.offsetWidth;
        content.classList.add('animate-pop');
    }
}

function closeStudentModal() {
    document.getElementById('student-modal').classList.add('hidden');
}

async function handleStudentSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const student = Object.fromEntries(formData.entries());

    const res = await API.request('upsertStudent', {}, { student });
    if (res && res.success) {
        alert('Data berhasil disimpan');
        closeStudentModal();
        loadStudents(true); // Force refresh cache
    }
}

function editStudent(nis) {
    const student = state.students.find(s => s.NIS.toString() === nis.toString());
    if (student) {
        document.getElementById('modal-title').innerText = 'Edit Siswa';
        const form = document.getElementById('student-form');
        form.reset();
        switchModalTab('tab-diri');
        for (let key in student) {
            if (form.elements[key]) {
                let val = student[key];
                form.elements[key].value = val;
            }
        }
        const modal = document.getElementById('student-modal');
        modal.classList.remove('hidden');

        // Trigger pop animation
        const content = modal.querySelector('.modal');
        if (content) {
            content.classList.remove('animate-pop');
            void content.offsetWidth;
            content.classList.add('animate-pop');
        }
    }
}

async function deleteStudent(nis) {
    if (!confirm(`Hapus data siswa dengan NIS ${nis}?`)) return;
    const res = await API.request('deleteStudent', {}, { nis });
    if (res && res.success) {
        alert('Data berhasil dihapus');
        refreshData();
    }
}

async function printStudent(nis) {
    const student = state.students.find(s => s.NIS.toString() === nis.toString());
    if (!student) return;

    // Load extras data
    const resExtras = await API.request('getStudentExtras', {}, { nis });
    const extras = (resExtras && resExtras.success) ? resExtras.data : {};

    const printContent = document.getElementById('print-content');
    let html = "";

    const categories = [
        {
            title: "I. KETERANGAN TENTANG DIRI SISWA",
            fields: [
                ['1. NIS', 'NIS'],
                ['2. Nama Lengkap', 'NamaLengkap'],
                ['3. Nama Panggilan', 'NamaPanggilan'],
                ['4. Jenis Kelamin', 'Jenis_Kelamin'],
                ['5. Tempat Lahir', 'TempatLahir'],
                ['6. Tanggal Lahir', 'Tanggal_Lahir'],
                ['7. Agama', 'Agama'],
                ['8. Jumlah Saudara', 'Jumlah_Saudara'],
                ['9. Bahasa Keluarga', 'Bahasa_Keluarga'],
                ['10. Alamat', 'Alamat'],
                ['11. No Telepon', 'No_Telepon'],
                ['12. Jarak ke Sekolah', 'JarakTempat']
            ]
        },
        {
            title: "II. KETERANGAN TENTANG ORANG TUA KANDUNG",
            fields: [
                ['13. Nama Ayah', 'Nama_Ayah'],
                ['14. Pendidikan Ayah', 'Pendidikan_Ayah'],
                ['15. Pekerjaan Ayah', 'Pekerjaan_Ayah'],
                ['16. Nama Ibu', 'Nama_Ibu'],
                ['17. Pendidikan Ibu', 'Pendidikan_Ibu'],
                ['18. Pekerjaan Ibu', 'Pekerjaan_Ibu']
            ]
        },
        {
            title: "III. KETERANGAN TENTANG PENDIDIKAN SEBELUMNYA",
            fields: [
                ['19. Asal TK', 'Asal_TK'],
                ['20. NPSN TK', 'NPSN_TK'],
                ['21. No Ijazah TK', 'No_Ijazah']
            ]
        },
        {
            title: "IV. KETERANGAN PENERIMAAN SISWA",
            fields: [
                ['22. Mutasi Dari', 'Mutasi_Dari'],
                ['23. Diterima di Kelas', 'Kelas'],
                ['24. Diterima Tanggal', 'Diterima_Tanggal'],
                ['25. Tanggal Masuk', 'Tanggal_Masuk']
            ]
        },
        {
            title: "V. KETERANGAN MUTASI KELUAR",
            fields: [
                ['26. Mutasi Keluar Ke', 'Mutasi_Keluar_Ke'],
                ['27. Tgl Mutasi Keluar', 'Tgl_Mutasi_Keluar'],
                ['28. Sekolah Tujuan', 'Sekolah_Tujuan'],
                ['29. NPSN Sekolah Tujuan', 'NPSN_Sekolah_Tujuan']
            ]
        },
        {
            title: "VI. KETERANGAN KELULUSAN",
            fields: [
                ['30. Tanggal Lulus', 'Tgl_Lulus'],
                ['31. Melanjutkan Ke', 'Melanjutkan_Ke'],
                ['32. No Ijazah Lulus', 'No_Ijazah_Lulus'],
                ['33. Tgl Ijazah Lulus', 'Tgl_Ijazah_Lulus']
            ]
        }
    ];

    categories.forEach(cat => {
        html += `<h3 style="margin-top: 15px; font-size: 14px; border-bottom: 1px solid #000;">${cat.title}</h3>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">`;
        cat.fields.forEach(f => {
            let val = student[f[1]] || '-';
            if (f[1].toLowerCase().includes('tanggal') || f[1].toLowerCase().includes('tgl')) {
                val = formatDateIndo(val);
            }
            html += `<tr>
                <td style="padding: 4px; border: 1px solid #ccc; width: 40%; font-size: 12px;">${f[0]}</td>
                <td style="padding: 4px; border: 1px solid #ccc; font-size: 12px;">${val}</td>
            </tr>`;
        });
        html += `</table>`;
    });

    // VII. NILAI — halaman terpisah, tabel efisien (mapel=baris, kelas+sem=kolom)
    html += buildNilaiPrintSection(extras);

    // VIII. PRESENSI
    html += buildPresensiPrintSection(extras);

    // IX. IJAZAH
    html += buildIjazahPrintSection(extras);

    // X. PENGHARGAAN
    html += buildPenghargaanPrintSection(extras);

    printContent.innerHTML = html;

    // Footer & Header info
    document.getElementById('print-logo').src = state.settings.LogoUrl || 'https://via.placeholder.com/80';

    const printFoto = document.getElementById('print-foto');
    if (student.Foto_URL) {
        printFoto.src = student.Foto_URL;
        printFoto.style.display = 'block';
    } else {
        printFoto.src = '';
        printFoto.style.display = 'none';
    }

    document.getElementById('print-kota').innerText = state.settings.Kota || 'Jakarta';
    document.getElementById('print-tanggal-ttd').innerText = formatDateIndo(state.settings.Tanggal) || '';
    document.getElementById('print-nama-ks').innerText = state.settings.KepalaSekolah || '';

    window.print();
}

function viewDetails(nis) {
    const student = state.allStudents.find(s => s.NIS.toString() === nis.toString());
    if (!student) return;
    
    const content = document.getElementById('details-content');
    const isAdmin = state.user && state.user.role === 'admin';
    
    // Foto siswa di atas
    const avatar = getAvatar(student.Jenis_Kelamin);
    let html = `
        <form id="detail-form" onsubmit="handleDetailSubmit(event, '${nis}')">
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <img src="${student.Foto_URL || avatar}" 
                 style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 3px solid var(--primary); box-shadow: var(--shadow-lg);"
                 onerror="this.src='${avatar}'">
            <h3 style="margin-top: 0.75rem; color: var(--primary);">${student.NamaLengkap}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">NIS: ${student.NIS}</p>
        </div>
        
        <div class="modal-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); overflow-x: auto; padding-bottom: 0.5rem;">
            <a href="javascript:void(0)" onclick="switchDetailTab('detail-tab-diri')" class="tab-link active" id="link-detail-tab-diri">Diri</a>
            <a href="javascript:void(0)" onclick="switchDetailTab('detail-tab-ortu')" class="tab-link" id="link-detail-tab-ortu">Orang Tua</a>
            <a href="javascript:void(0)" onclick="switchDetailTab('detail-tab-pendidikan')" class="tab-link" id="link-detail-tab-pendidikan">Pendidikan</a>
            <a href="javascript:void(0)" onclick="switchDetailTab('detail-tab-mutasi')" class="tab-link" id="link-detail-tab-mutasi">Mutasi</a>
            <a href="javascript:void(0)" onclick="switchDetailTab('detail-tab-lulus')" class="tab-link" id="link-detail-tab-lulus">Lulus</a>
        </div>
    `;
    
    // Tab Diri
    html += `<div id="detail-tab-diri" class="modal-tab-content" style="max-height: 50vh; overflow-y: auto;">`;
    html += renderDetailSection([
        ['Foto URL', 'Foto_URL', 'text'],
        ['NIS', 'NIS', 'text'],
        ['Nama Lengkap', 'NamaLengkap', 'text'],
        ['Nama Panggilan', 'NamaPanggilan', 'text'],
        ['Jenis Kelamin', 'Jenis_Kelamin', 'select', ['L', 'P']],
        ['Tempat Lahir', 'TempatLahir', 'text'],
        ['Tanggal Lahir', 'Tanggal_Lahir', 'date'],
        ['Agama', 'Agama', 'text'],
        ['Jumlah Saudara', 'Jumlah_Saudara', 'number'],
        ['Bahasa Keluarga', 'Bahasa_Keluarga', 'text'],
        ['Alamat', 'Alamat', 'textarea'],
        ['No Telepon', 'No_Telepon', 'text'],
        ['Jarak ke Sekolah (km)', 'JarakTempat', 'text']
    ], student, isAdmin);
    html += `</div>`;
    
    // Tab Orang Tua
    html += `<div id="detail-tab-ortu" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">`;
    html += renderDetailSection([
        ['Nama Ayah', 'Nama_Ayah', 'text'],
        ['Pendidikan Ayah', 'Pendidikan_Ayah', 'text'],
        ['Pekerjaan Ayah', 'Pekerjaan_Ayah', 'text'],
        ['Nama Ibu', 'Nama_Ibu', 'text'],
        ['Pendidikan Ibu', 'Pendidikan_Ibu', 'text'],
        ['Pekerjaan Ibu', 'Pekerjaan_Ibu', 'text']
    ], student, isAdmin);
    html += `</div>`;
    
    // Tab Pendidikan
    html += `<div id="detail-tab-pendidikan" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">`;
    html += renderDetailSection([
        ['Asal TK', 'Asal_TK', 'text'],
        ['NPSN TK', 'NPSN_TK', 'text'],
        ['No Ijazah TK', 'No_Ijazah', 'text'],
        ['Mutasi Dari', 'Mutasi_Dari', 'text'],
        ['Diterima di Kelas', 'Kelas', 'text'],
        ['Diterima Tanggal', 'Diterima_Tanggal', 'date'],
        ['Tanggal Masuk', 'Tanggal_Masuk', 'date']
    ], student, isAdmin);
    html += `</div>`;
    
    // Tab Mutasi Keluar
    html += `<div id="detail-tab-mutasi" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">`;
    html += renderDetailSection([
        ['Mutasi Keluar Ke', 'Mutasi_Keluar_Ke', 'text'],
        ['Tgl Mutasi Keluar', 'Tgl_Mutasi_Keluar', 'date'],
        ['Sekolah Tujuan', 'Sekolah_Tujuan', 'text'],
        ['NPSN Sekolah Tujuan', 'NPSN_Sekolah_Tujuan', 'text']
    ], student, isAdmin);
    html += `</div>`;
    
    // Tab Lulus
    html += `<div id="detail-tab-lulus" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">`;
    html += renderDetailSection([
        ['Tanggal Lulus', 'Tgl_Lulus', 'date'],
        ['Melanjutkan Ke', 'Melanjutkan_Ke', 'text'],
        ['No Ijazah Lulus', 'No_Ijazah_Lulus', 'text'],
        ['Tgl Ijazah Lulus', 'Tgl_Ijazah_Lulus', 'date']
    ], student, isAdmin);
    html += `</div>`;
    
    html += `</form>`;
    
    content.innerHTML = html;
    
    // Update tombol footer
    const modal = document.getElementById('details-modal');
    const footer = modal.querySelector('.modal-footer-buttons');
    if (footer) {
        if (isAdmin) {
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('details-modal').classList.add('hidden')">Tutup</button>
                <button type="submit" form="detail-form" class="btn btn-primary">Simpan Perubahan</button>
            `;
        } else {
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('details-modal').classList.add('hidden')">Tutup</button>
            `;
        }
    }
    
    modal.classList.remove('hidden');
    lucide.createIcons();
}

// Fungsi Edit untuk Nilai, Presensi, Ijazah, Penghargaan
async function editStudentExtras(nis) {
    const student = state.allStudents.find(s => s.NIS.toString() === nis.toString());
    if (!student) return;

    // Fetch data dulu sebelum modal dibuka
    renderLoading(true);
    let fetchedExtras = {};
    try {
        const res = await API.request('getStudentExtras', {}, { nis });
        if (res && res.success) {
            fetchedExtras = res.data || {};
        }
        // Jika res null (API error), tetap lanjut dengan data kosong
    } catch(e) {
        console.warn('Gagal load extras, lanjut dengan data kosong:', e);
    }
    renderLoading(false);

    currentNIS = nis;
    currentExtras = fetchedExtras;
    // Pastikan semua sub-objek ada
    if (!currentExtras.nilai)       currentExtras.nilai = {};
    if (!currentExtras.presensi)    currentExtras.presensi = {};
    if (!currentExtras.ijazah)      currentExtras.ijazah = {};
    if (!currentExtras.penghargaan) currentExtras.penghargaan = [];

    const content = document.getElementById('extras-content');
    
    // Foto siswa di atas
    const avatar = getAvatar(student.Jenis_Kelamin);
    let html = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <img src="${student.Foto_URL || avatar}" 
                 style="width: 100px; height: 100px; border-radius: 12px; object-fit: cover; border: 3px solid var(--primary);"
                 onerror="this.src='${avatar}'">
            <h3 style="margin-top: 0.75rem; color: var(--primary);">${student.NamaLengkap}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">NIS: ${student.NIS}</p>
        </div>
        <div class="modal-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); overflow-x: auto; padding-bottom: 0.5rem;">
            <a href="javascript:void(0)" onclick="switchExtrasTab('extras-tab-nilai')" class="tab-link active" id="link-extras-tab-nilai">Nilai</a>
            <a href="javascript:void(0)" onclick="switchExtrasTab('extras-tab-presensi')" class="tab-link" id="link-extras-tab-presensi">Presensi</a>
            <a href="javascript:void(0)" onclick="switchExtrasTab('extras-tab-ijazah')" class="tab-link" id="link-extras-tab-ijazah">Ijazah</a>
            <a href="javascript:void(0)" onclick="switchExtrasTab('extras-tab-penghargaan')" class="tab-link" id="link-extras-tab-penghargaan">Penghargaan</a>
        </div>
        <div id="extras-tab-nilai" class="modal-tab-content" style="max-height: 50vh; overflow-y: auto;">
            <div id="extras-nilai-content"></div>
        </div>
        <div id="extras-tab-presensi" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">
            <div id="extras-presensi-content"></div>
        </div>
        <div id="extras-tab-ijazah" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">
            <div id="extras-ijazah-content"></div>
        </div>
        <div id="extras-tab-penghargaan" class="modal-tab-content hidden" style="max-height: 50vh; overflow-y: auto;">
            <div id="extras-penghargaan-content"></div>
        </div>
    `;
    
    content.innerHTML = html;

    // Render semua tab (data sudah siap)
    renderNilaiTabForEdit();
    renderPresensiTabForEdit();
    renderIjazahTabForEdit();
    renderPenghargaanTabForEdit();
    
    const modal = document.getElementById('extras-modal');
    modal.classList.remove('hidden');
    lucide.createIcons();
}

async function loadStudentExtrasForEdit(nis) {
    currentNIS = nis;
    const res = await API.request('getStudentExtras', {}, { nis });
    if (res && res.success) {
        currentExtras = res.data || {};
        renderNilaiTabForEdit();
        renderPresensiTabForEdit();
        renderIjazahTabForEdit();
        renderPenghargaanTabForEdit();
    }
}

function switchExtrasTab(tabId) {
    document.querySelectorAll('#extras-content .modal-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#extras-content .tab-link').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(`link-${tabId}`).classList.add('active');
}

// ===== RENDER FUNGSI UNTUK EXTRAS MODAL =====

function renderNilaiTabForEdit() {
    const container = document.getElementById('extras-nilai-content');
    if (!container) return;
    if (!currentExtras.nilai) currentExtras.nilai = {};

    const inputStyle = `style="width:60px;padding:2px 4px;background:var(--bg-main);border:1px solid var(--border);border-radius:4px;color:var(--text-main);text-align:center;"`;

    let html = `<div style="padding:0.5rem;">
        <div style="margin-bottom:1rem;">
            <label style="font-weight:600;">Pilih Kelas:</label>
            <select id="extras-kelas-selector" onchange="switchExtrasKelas()" style="margin-left:0.5rem;padding:0.4rem 0.6rem;background:var(--bg-main);border:1px solid var(--border);border-radius:6px;color:var(--text-main);">
                ${[1,2,3,4,5,6].map(k=>`<option value="${k}">Kelas ${k}</option>`).join('')}
            </select>
        </div>`;

    for (let kelas = 1; kelas <= 6; kelas++) {
        html += `<div id="extras-nilai-kelas-${kelas}" class="extras-nilai-kelas-content" style="display:${kelas===1?'block':'none'};">`;
        html += `<h4 style="color:var(--primary);margin-bottom:0.75rem;">Kelas ${kelas}</h4>`;

        for (let sem = 1; sem <= 2; sem++) {
            html += `<h5 style="margin:1rem 0 0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.25rem;">Semester ${sem}</h5>`;
            html += `<div class="table-container" style="margin-bottom:0.75rem;">
                <table style="width:100%;font-size:0.85rem;">
                <thead><tr>
                    <th style="width:55%;text-align:left;">Mata Pelajaran</th>
                    <th style="width:22.5%;text-align:center;">KKM</th>
                    <th style="width:22.5%;text-align:center;">Nilai</th>
                </tr></thead><tbody>`;

            MATA_PELAJARAN.forEach(kat => {
                html += `<tr><td colspan="3" style="background:var(--bg-main);font-weight:600;padding:0.4rem;">${kat.kategori}</td></tr>`;
                kat.mapel.forEach(mapel => {
                    const key = `k${kelas}_s${sem}_${mapel}`;
                    const kkm   = currentExtras.nilai[key+'_kkm']   || '';
                    const nilai = currentExtras.nilai[key+'_nilai'] || '';
                    html += `<tr>
                        <td style="padding:0.4rem;">${mapel}</td>
                        <td style="padding:0.4rem;text-align:center;"><input type="number" min="0" max="100" data-key="${key}_kkm" value="${kkm}" ${inputStyle}></td>
                        <td style="padding:0.4rem;text-align:center;"><input type="number" min="0" max="100" data-key="${key}_nilai" value="${nilai}" ${inputStyle}></td>
                    </tr>`;
                });
            });

            html += `</tbody></table></div>`;
        }
        html += `</div>`;
    }

    html += `<button type="button" class="btn btn-primary" onclick="saveExtrasNilai()" style="margin-top:0.5rem;">Simpan Nilai</button></div>`;
    container.innerHTML = html;
}

function switchExtrasKelas() {
    const kelas = document.getElementById('extras-kelas-selector').value;
    document.querySelectorAll('.extras-nilai-kelas-content').forEach(el => el.style.display = 'none');
    document.getElementById(`extras-nilai-kelas-${kelas}`).style.display = 'block';
}

async function saveExtrasNilai() {
    document.querySelectorAll('#extras-nilai-content input[data-key]').forEach(input => {
        currentExtras.nilai[input.dataset.key] = input.value;
    });
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    if (res && res.success) alert('Nilai berhasil disimpan!');
    else alert('Gagal menyimpan nilai.');
}

function renderPresensiTabForEdit() {
    const container = document.getElementById('extras-presensi-content');
    if (!container) return;
    if (!currentExtras.presensi) currentExtras.presensi = {};

    const inputStyle = `style="width:80px;padding:0.4rem;background:var(--bg-main);border:1px solid var(--border);border-radius:6px;color:var(--text-main);"`;

    let html = `<div style="padding:0.5rem;">
        <div style="margin-bottom:1rem;">
            <label style="font-weight:600;">Pilih Kelas:</label>
            <select id="extras-presensi-kelas-selector" onchange="switchExtrasPresensiKelas()" style="margin-left:0.5rem;padding:0.4rem 0.6rem;background:var(--bg-main);border:1px solid var(--border);border-radius:6px;color:var(--text-main);">
                ${[1,2,3,4,5,6].map(k=>`<option value="${k}">Kelas ${k}</option>`).join('')}
            </select>
        </div>`;

    for (let kelas = 1; kelas <= 6; kelas++) {
        html += `<div id="extras-presensi-kelas-${kelas}" class="extras-presensi-kelas-content" style="display:${kelas===1?'block':'none'};">`;
        html += `<h4 style="color:var(--primary);margin-bottom:0.75rem;">Kelas ${kelas}</h4>`;

        for (let sem = 1; sem <= 2; sem++) {
            const sakit = currentExtras.presensi[`k${kelas}_s${sem}_sakit`] || '';
            const ijin  = currentExtras.presensi[`k${kelas}_s${sem}_ijin`]  || '';
            const alpa  = currentExtras.presensi[`k${kelas}_s${sem}_alpa`]  || '';
            html += `<h5 style="margin:0.75rem 0 0.5rem;">Semester ${sem}</h5>
            <div class="grid-2" style="gap:1rem;margin-bottom:0.75rem;">
                <div class="form-group"><label>Sakit (hari)</label><input type="number" min="0" data-presensi-key="k${kelas}_s${sem}_sakit" value="${sakit}" ${inputStyle}></div>
                <div class="form-group"><label>Ijin (hari)</label><input type="number" min="0" data-presensi-key="k${kelas}_s${sem}_ijin" value="${ijin}" ${inputStyle}></div>
                <div class="form-group"><label>Alpa (hari)</label><input type="number" min="0" data-presensi-key="k${kelas}_s${sem}_alpa" value="${alpa}" ${inputStyle}></div>
            </div>`;
        }
        html += `</div>`;
    }

    html += `<button type="button" class="btn btn-primary" onclick="saveExtrasPresensi()" style="margin-top:0.5rem;">Simpan Presensi</button></div>`;
    container.innerHTML = html;
}

function switchExtrasPresensiKelas() {
    const kelas = document.getElementById('extras-presensi-kelas-selector').value;
    document.querySelectorAll('.extras-presensi-kelas-content').forEach(el => el.style.display = 'none');
    document.getElementById(`extras-presensi-kelas-${kelas}`).style.display = 'block';
}

async function saveExtrasPresensi() {
    document.querySelectorAll('#extras-presensi-content input[data-presensi-key]').forEach(input => {
        currentExtras.presensi[input.dataset.presensiKey] = input.value;
    });
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    if (res && res.success) alert('Presensi berhasil disimpan!');
    else alert('Gagal menyimpan presensi.');
}

function renderIjazahTabForEdit() {
    const container = document.getElementById('extras-ijazah-content');
    if (!container) return;
    if (!currentExtras.ijazah) currentExtras.ijazah = {};

    const inputStyle = `style="width:100%;padding:0.5rem;background:var(--bg-main);border:1px solid var(--border);border-radius:6px;color:var(--text-main);"`;
    const ij = currentExtras.ijazah;

    const fields = [
        ['Nomor Ijazah Kemenag', 'kemenag_nomor', 'text'],
        ['Kota Ijazah Kemenag',  'kemenag_kota',  'text'],
        ['Tanggal Ijazah Kemenag','kemenag_tanggal','date'],
        ['Nomor Ijazah Maarif',  'maarif_nomor',  'text'],
        ['Kota Ijazah Maarif',   'maarif_kota',   'text'],
        ['Tanggal Ijazah Maarif','maarif_tanggal','date'],
    ];

    let html = `<div style="padding:0.5rem;"><div class="grid-2" style="gap:1rem;">`;
    fields.forEach(f => {
        const val = ij[f[1]] || '';
        const extra = f[2]==='date' ? 'onclick="this.showPicker()"' : '';
        html += `<div class="form-group"><label>${f[0]}</label>
            <input type="${f[2]}" data-ijazah-key="${f[1]}" value="${val}" ${extra} ${inputStyle}>
        </div>`;
    });
    html += `</div><button type="button" class="btn btn-primary" onclick="saveExtrasIjazah()" style="margin-top:1rem;">Simpan Ijazah</button></div>`;
    container.innerHTML = html;
}

async function saveExtrasIjazah() {
    document.querySelectorAll('#extras-ijazah-content input[data-ijazah-key]').forEach(input => {
        currentExtras.ijazah[input.dataset.ijazahKey] = input.value;
    });
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    if (res && res.success) alert('Data ijazah berhasil disimpan!');
    else alert('Gagal menyimpan data ijazah.');
}

function renderPenghargaanTabForEdit() {
    const container = document.getElementById('extras-penghargaan-content');
    if (!container) return;
    if (!currentExtras.penghargaan) currentExtras.penghargaan = [];

    const inputStyle = `style="width:100%;padding:0.5rem;background:var(--bg-main);border:1px solid var(--border);border-radius:6px;color:var(--text-main);"`;

    let html = `<div style="padding:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="addExtrasPenghargaan()" style="margin-bottom:1rem;">
            <i data-lucide="plus"></i> Tambah Penghargaan
        </button>
        <div id="extras-penghargaan-list">`;

    if (currentExtras.penghargaan.length === 0) {
        html += `<p style="color:var(--text-muted);text-align:center;padding:2rem;">Belum ada data penghargaan.</p>`;
    } else {
        currentExtras.penghargaan.forEach((p, idx) => {
            html += `<div style="padding:1rem;margin-bottom:1rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <strong>Penghargaan ${idx+1}</strong>
                    <button type="button" class="btn btn-secondary" onclick="deleteExtrasPenghargaan(${idx})" style="padding:0.25rem 0.5rem;color:var(--danger);">
                        <i data-lucide="trash-2" style="width:14px;"></i>
                    </button>
                </div>
                <div class="grid-2" style="gap:1rem;">
                    <div class="form-group"><label>Nomor Sertifikat</label>
                        <input type="text" data-penghargaan-idx="${idx}" data-penghargaan-field="nomor" value="${p.nomor||''}" ${inputStyle}></div>
                    <div class="form-group"><label>Bidang</label>
                        <input type="text" data-penghargaan-idx="${idx}" data-penghargaan-field="bidang" value="${p.bidang||''}" ${inputStyle}></div>
                    <div class="form-group"><label>Tingkat</label>
                        <select data-penghargaan-idx="${idx}" data-penghargaan-field="tingkat" ${inputStyle}>
                            ${['Madrasah','Kabupaten','Provinsi','Nasional'].map(t=>`<option value="${t}" ${p.tingkat===t?'selected':''}>${t}</option>`).join('')}
                        </select></div>
                    <div class="form-group"><label>Tanggal</label>
                        <input type="date" data-penghargaan-idx="${idx}" data-penghargaan-field="tanggal" value="${p.tanggal||''}" onclick="this.showPicker()" ${inputStyle}></div>
                </div>
            </div>`;
        });
    }

    html += `</div>
        <button type="button" class="btn btn-primary" onclick="saveExtrasPenghargaan()" style="margin-top:0.5rem;">Simpan Penghargaan</button>
    </div>`;
    container.innerHTML = html;
    lucide.createIcons();
}

function addExtrasPenghargaan() {
    currentExtras.penghargaan.push({ nomor:'', bidang:'', tingkat:'Madrasah', tanggal:'' });
    renderPenghargaanTabForEdit();
}

function deleteExtrasPenghargaan(idx) {
    if (confirm('Hapus penghargaan ini?')) {
        currentExtras.penghargaan.splice(idx, 1);
        renderPenghargaanTabForEdit();
    }
}

async function saveExtrasPenghargaan() {
    document.querySelectorAll('#extras-penghargaan-content [data-penghargaan-idx]').forEach(input => {
        const idx   = parseInt(input.dataset.penghargaanIdx);
        const field = input.dataset.penghargaanField;
        currentExtras.penghargaan[idx][field] = input.value;
    });
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    if (res && res.success) alert('Data penghargaan berhasil disimpan!');
    else alert('Gagal menyimpan data penghargaan.');
}

function renderDetailSection(fields, student, isAdmin) {
    let html = '<div class="grid-2">';
    fields.forEach(f => {
        const label = f[0];
        const fieldName = f[1];
        const fieldType = f[2] || 'text';
        const options = f[3] || [];
        let val = student[fieldName] || '';
        
        // Format date untuk input date (YYYY-MM-DD)
        if (fieldType === 'date' && val && val !== '-') {
            if (val.includes('T') || val.includes('Z')) {
                val = val.split('T')[0];
            } else if (val.includes('-')) {
                let parts = val.split('-');
                if (parts[0].length === 2) { // DD-MM-YYYY
                    val = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }
        }
        
        html += `<div class="form-group" style="margin-bottom: 1rem;">`;
        html += `<label style="display: block; margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${label}</label>`;
        
        if (isAdmin) {
            // Mode Edit (Admin)
            if (fieldType === 'textarea') {
                html += `<textarea name="${fieldName}" rows="2" style="width: 100%; padding: 0.6rem 0.75rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">${val}</textarea>`;
            } else if (fieldType === 'select') {
                html += `<select name="${fieldName}" style="width: 100%; padding: 0.6rem 0.75rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">`;
                options.forEach(opt => {
                    html += `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt === 'L' ? 'Laki-laki' : opt === 'P' ? 'Perempuan' : opt}</option>`;
                });
                html += `</select>`;
            } else if (fieldType === 'date') {
                html += `<input type="date" name="${fieldName}" value="${val}" onclick="this.showPicker()" style="width: 100%; padding: 0.6rem 0.75rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">`;
            } else {
                html += `<input type="${fieldType}" name="${fieldName}" value="${val}" style="width: 100%; padding: 0.6rem 0.75rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-family: inherit; font-size: 0.9rem;">`;
            }
        } else {
            // Mode View Only (Student)
            let displayVal = val || '-';
            if (fieldType === 'date' && val) {
                displayVal = formatDateIndo(val);
            }
            html += `<div style="padding: 0.6rem 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); font-size: 0.95rem; font-weight: 500;">${displayVal}</div>`;
        }
        
        html += `</div>`;
    });
    html += '</div>';
    return html;
}

function switchDetailTab(tabId) {
    document.querySelectorAll('#details-content .modal-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#details-content .tab-link').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(`link-${tabId}`).classList.add('active');
}

async function handleDetailSubmit(e, nis) {
    e.preventDefault();
    
    if (!state.user || state.user.role !== 'admin') {
        alert('Hanya admin yang dapat mengedit data siswa.');
        return;
    }
    
    const formData = new FormData(e.target);
    const student = Object.fromEntries(formData.entries());
    
    // Pastikan NIS tidak berubah
    student.NIS = nis;
    
    renderLoading(true);
    
    const res = await API.request('upsertStudent', {}, { student });
    
    renderLoading(false);
    
    if (res && res.success) {
        alert('Data berhasil disimpan!');
        document.getElementById('details-modal').classList.add('hidden');
        loadStudents(true); // Refresh data
    } else {
        alert('Gagal menyimpan data: ' + (res ? res.error : 'Unknown error'));
    }
}

// Excel Upload
async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length > 0) {
            if (!confirm(`Upload ${data.length} data siswa?`)) return;

            const res = await API.request('bulkUpload', {}, { students: data });
            if (res && res.success) {
                alert(`Berhasil upload ${res.count} siswa.`);
                refreshData();
            }
        }
    };
    reader.readAsBinaryString(file);
}


// ===== FUNGSI UNTUK NILAI, PRESENSI, IJAZAH, PENGHARGAAN =====

const MATA_PELAJARAN = [
    { kategori: 'I. MATA PELAJARAN UTAMA', mapel: [
        'Al-qur\'an Hadits',
        'Aqidah Akhlaq',
        'Fiqih',
        'Sejarah Kebudayaan Islam',
        'Pendidikan Kewarganegaraan',
        'Bahasa Indonesia',
        'Bahasa Arab',
        'Matematika',
        'Ilmu Pengetahuan Alam - Sosial',
        'Seni Budaya dan Keterampilan',
        'Pend. Jasmani, Olah Raga dan Kesehatan'
    ]},
    { kategori: 'II. Muatan Lokal', mapel: [
        'Bahasa Jawa',
        'Bahasa Inggris',
        'Ke-NU-an / Aswaja',
        'Nahwu-Shorof',
        'Pego'
    ]}
];

let currentExtras = {};
let currentNIS = '';

async function loadStudentExtras(nis) {
    currentNIS = nis;
    const res = await API.request('getStudentExtras', {}, { nis });
    
    if (res && res.success) {
        currentExtras = res.data || {};
        // Fungsi ini tidak digunakan lagi, diganti dengan loadStudentExtrasForEdit
    }
}

function renderNilaiTab() {
    const isAdmin = state.user && state.user.role === 'admin';
    const container = document.getElementById('nilai-content');
    if (!container) return;
    
    if (!currentExtras.nilai) currentExtras.nilai = {};
    
    let html = '<div style="padding: 1rem;">';
    
    // Selector Kelas
    html += `
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Pilih Kelas:</label>
            <select id="kelas-selector" onchange="switchKelas()" style="width: 200px; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                <option value="1">Kelas 1</option>
                <option value="2">Kelas 2</option>
                <option value="3">Kelas 3</option>
                <option value="4">Kelas 4</option>
                <option value="5">Kelas 5</option>
                <option value="6">Kelas 6</option>
            </select>
        </div>
    `;
    
    // Render untuk setiap kelas
    for (let kelas = 1; kelas <= 6; kelas++) {
        html += `<div id="nilai-kelas-${kelas}" class="nilai-kelas-content" style="display: ${kelas === 1 ? 'block' : 'none'};">`;
        html += `<h3 style="margin-bottom: 1rem; color: var(--primary);">Kelas ${kelas}</h3>`;
        
        // Semester 1 & 2
        for (let sem = 1; sem <= 2; sem++) {
            html += `<h4 style="margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">Semester ${sem}</h4>`;
            html += `<div class="table-container" style="margin-bottom: 1rem;">`;
            html += `<table style="width: 100%; font-size: 0.85rem;">`;
            html += `<thead><tr><th style="width: 50%;">Mata Pelajaran</th><th>KKM</th><th>Nilai</th></tr></thead><tbody>`;
            
            MATA_PELAJARAN.forEach(kategori => {
                html += `<tr><td colspan="3" style="background: var(--bg-main); font-weight: 600; padding: 0.5rem;">${kategori.kategori}</td></tr>`;
                kategori.mapel.forEach(mapel => {
                    const key = `k${kelas}_s${sem}_${mapel}`;
                    const kkm = currentExtras.nilai[key + '_kkm'] || '';
                    const nilai = currentExtras.nilai[key + '_nilai'] || '';
                    
                    if (isAdmin) {
                        html += `<tr>
                            <td style="padding: 0.5rem;">${mapel}</td>
                            <td style="padding: 0.5rem;"><input type="number" data-key="${key}_kkm" value="${kkm}" style="width: 60px; padding: 0.25rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 4px; color: var(--text-main);"></td>
                            <td style="padding: 0.5rem;"><input type="number" data-key="${key}_nilai" value="${nilai}" style="width: 60px; padding: 0.25rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 4px; color: var(--text-main);"></td>
                        </tr>`;
                    } else {
                        html += `<tr>
                            <td style="padding: 0.5rem;">${mapel}</td>
                            <td style="padding: 0.5rem;">${kkm || '-'}</td>
                            <td style="padding: 0.5rem;">${nilai || '-'}</td>
                        </tr>`;
                    }
                });
            });
            
            html += `</tbody></table></div>`;
        }
        
        html += `</div>`;
    }
    
    if (isAdmin) {
        html += `<button type="button" class="btn btn-primary" onclick="saveNilai()" style="margin-top: 1rem;">Simpan Nilai</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function switchKelas() {
    const kelas = document.getElementById('kelas-selector').value;
    document.querySelectorAll('.nilai-kelas-content').forEach(el => el.style.display = 'none');
    document.getElementById(`nilai-kelas-${kelas}`).style.display = 'block';
}

async function saveNilai() {
    // Collect all nilai inputs
    const inputs = document.querySelectorAll('#nilai-content input[data-key]');
    inputs.forEach(input => {
        currentExtras.nilai[input.dataset.key] = input.value;
    });
    
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    
    if (res && res.success) {
        alert('Nilai berhasil disimpan!');
    } else {
        alert('Gagal menyimpan nilai.');
    }
}

function renderPresensiTab() {
    const isAdmin = state.user && state.user.role === 'admin';
    const container = document.getElementById('presensi-content');
    if (!container) return;
    
    if (!currentExtras.presensi) currentExtras.presensi = {};
    
    let html = '<div style="padding: 1rem;">';
    html += '<h3 style="margin-bottom: 1rem; color: var(--primary);">Data Presensi</h3>';
    
    // Selector Kelas
    html += `
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Pilih Kelas:</label>
            <select id="presensi-kelas-selector" onchange="switchPresensiKelas()" style="width: 200px; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                <option value="1">Kelas 1</option>
                <option value="2">Kelas 2</option>
                <option value="3">Kelas 3</option>
                <option value="4">Kelas 4</option>
                <option value="5">Kelas 5</option>
                <option value="6">Kelas 6</option>
            </select>
        </div>
    `;
    
    for (let kelas = 1; kelas <= 6; kelas++) {
        html += `<div id="presensi-kelas-${kelas}" class="presensi-kelas-content" style="display: ${kelas === 1 ? 'block' : 'none'};">`;
        html += `<h4 style="margin-bottom: 1rem;">Kelas ${kelas}</h4>`;
        
        for (let sem = 1; sem <= 2; sem++) {
            html += `<h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">Semester ${sem}</h5>`;
            html += `<div class="grid-2" style="gap: 1rem; margin-bottom: 1rem;">`;
            
            const sakit = currentExtras.presensi[`k${kelas}_s${sem}_sakit`] || '';
            const ijin = currentExtras.presensi[`k${kelas}_s${sem}_ijin`] || '';
            const alpa = currentExtras.presensi[`k${kelas}_s${sem}_alpa`] || '';
            
            if (isAdmin) {
                html += `
                    <div class="form-group">
                        <label>Sakit (hari)</label>
                        <input type="number" data-presensi-key="k${kelas}_s${sem}_sakit" value="${sakit}" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                    </div>
                    <div class="form-group">
                        <label>Ijin (hari)</label>
                        <input type="number" data-presensi-key="k${kelas}_s${sem}_ijin" value="${ijin}" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                    </div>
                    <div class="form-group">
                        <label>Alpa (hari)</label>
                        <input type="number" data-presensi-key="k${kelas}_s${sem}_alpa" value="${alpa}" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                    </div>
                `;
            } else {
                html += `
                    <div><strong>Sakit:</strong> ${sakit || '0'} hari</div>
                    <div><strong>Ijin:</strong> ${ijin || '0'} hari</div>
                    <div><strong>Alpa:</strong> ${alpa || '0'} hari</div>
                `;
            }
            
            html += `</div>`;
        }
        
        html += `</div>`;
    }
    
    if (isAdmin) {
        html += `<button type="button" class="btn btn-primary" onclick="savePresensi()" style="margin-top: 1rem;">Simpan Presensi</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function switchPresensiKelas() {
    const kelas = document.getElementById('presensi-kelas-selector').value;
    document.querySelectorAll('.presensi-kelas-content').forEach(el => el.style.display = 'none');
    document.getElementById(`presensi-kelas-${kelas}`).style.display = 'block';
}

async function savePresensi() {
    const inputs = document.querySelectorAll('#presensi-content input[data-presensi-key]');
    inputs.forEach(input => {
        currentExtras.presensi[input.dataset.presensiKey] = input.value;
    });
    
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    
    if (res && res.success) {
        alert('Presensi berhasil disimpan!');
    } else {
        alert('Gagal menyimpan presensi.');
    }
}

function renderIjazahTab() {
    const isAdmin = state.user && state.user.role === 'admin';
    const container = document.getElementById('ijazah-content');
    if (!container) return;
    
    if (!currentExtras.ijazah) currentExtras.ijazah = {};
    
    let html = '<div style="padding: 1rem;">';
    html += '<h3 style="margin-bottom: 1rem; color: var(--primary);">Data Ijazah</h3>';
    
    html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Ijazah Kemenag</h4>';
    html += '<div class="grid-2" style="gap: 1rem;">';
    
    const fields = [
        ['Nomor Ijazah Kemenag', 'kemenag_nomor'],
        ['Kota Ijazah Kemenag', 'kemenag_kota'],
        ['Tanggal Ijazah Kemenag', 'kemenag_tanggal', 'date'],
        ['Nomor Ijazah Maarif', 'maarif_nomor'],
        ['Kota Ijazah Maarif', 'maarif_kota'],
        ['Tanggal Ijazah Maarif', 'maarif_tanggal', 'date']
    ];
    
    fields.forEach(f => {
        const val = currentExtras.ijazah[f[1]] || '';
        if (isAdmin) {
            const inputType = f[2] || 'text';
            html += `
                <div class="form-group">
                    <label>${f[0]}</label>
                    <input type="${inputType}" data-ijazah-key="${f[1]}" value="${val}" ${inputType === 'date' ? 'onclick="this.showPicker()"' : ''} style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                </div>
            `;
        } else {
            const displayVal = (f[2] === 'date' && val) ? formatDateIndo(val) : (val || '-');
            html += `<div><strong>${f[0]}:</strong> ${displayVal}</div>`;
        }
    });
    
    html += '</div>';
    
    if (isAdmin) {
        html += `<button type="button" class="btn btn-primary" onclick="saveIjazah()" style="margin-top: 1rem;">Simpan Ijazah</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function saveIjazah() {
    const inputs = document.querySelectorAll('#ijazah-content input[data-ijazah-key]');
    inputs.forEach(input => {
        currentExtras.ijazah[input.dataset.ijazahKey] = input.value;
    });
    
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    
    if (res && res.success) {
        alert('Data ijazah berhasil disimpan!');
    } else {
        alert('Gagal menyimpan data ijazah.');
    }
}

function renderPenghargaanTab() {
    const isAdmin = state.user && state.user.role === 'admin';
    const container = document.getElementById('penghargaan-content');
    if (!container) return;
    
    if (!currentExtras.penghargaan) currentExtras.penghargaan = [];
    
    let html = '<div style="padding: 1rem;">';
    html += '<h3 style="margin-bottom: 1rem; color: var(--primary);">Data Penghargaan</h3>';
    
    if (isAdmin) {
        html += `<button type="button" class="btn btn-secondary" onclick="addPenghargaan()" style="margin-bottom: 1rem;"><i data-lucide="plus"></i> Tambah Penghargaan</button>`;
    }
    
    html += '<div id="penghargaan-list">';
    
    currentExtras.penghargaan.forEach((p, idx) => {
        html += `<div class="card" style="padding: 1rem; margin-bottom: 1rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;">`;
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">`;
        html += `<h4 style="margin: 0;">Penghargaan ${idx + 1}</h4>`;
        if (isAdmin) {
            html += `<button type="button" class="btn btn-secondary" onclick="deletePenghargaan(${idx})" style="padding: 0.25rem 0.5rem; color: var(--danger);"><i data-lucide="trash-2" style="width: 14px;"></i></button>`;
        }
        html += `</div>`;
        html += `<div class="grid-2" style="gap: 1rem;">`;
        
        if (isAdmin) {
            html += `
                <div class="form-group">
                    <label>Nomor Sertifikat</label>
                    <input type="text" data-penghargaan-idx="${idx}" data-penghargaan-field="nomor" value="${p.nomor || ''}" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                </div>
                <div class="form-group">
                    <label>Bidang</label>
                    <input type="text" data-penghargaan-idx="${idx}" data-penghargaan-field="bidang" value="${p.bidang || ''}" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                </div>
                <div class="form-group">
                    <label>Tingkat</label>
                    <select data-penghargaan-idx="${idx}" data-penghargaan-field="tingkat" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                        <option value="Madrasah" ${p.tingkat === 'Madrasah' ? 'selected' : ''}>Madrasah</option>
                        <option value="Kabupaten" ${p.tingkat === 'Kabupaten' ? 'selected' : ''}>Kabupaten</option>
                        <option value="Provinsi" ${p.tingkat === 'Provinsi' ? 'selected' : ''}>Provinsi</option>
                        <option value="Nasional" ${p.tingkat === 'Nasional' ? 'selected' : ''}>Nasional</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Tanggal</label>
                    <input type="date" data-penghargaan-idx="${idx}" data-penghargaan-field="tanggal" value="${p.tanggal || ''}" onclick="this.showPicker()" style="width: 100%; padding: 0.5rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main);">
                </div>
            `;
        } else {
            html += `
                <div><strong>Nomor Sertifikat:</strong> ${p.nomor || '-'}</div>
                <div><strong>Bidang:</strong> ${p.bidang || '-'}</div>
                <div><strong>Tingkat:</strong> ${p.tingkat || '-'}</div>
                <div><strong>Tanggal:</strong> ${p.tanggal ? formatDateIndo(p.tanggal) : '-'}</div>
            `;
        }
        
        html += `</div></div>`;
    });
    
    if (currentExtras.penghargaan.length === 0) {
        html += `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Belum ada data penghargaan.</p>`;
    }
    
    html += '</div>';
    
    if (isAdmin) {
        html += `<button type="button" class="btn btn-primary" onclick="savePenghargaan()" style="margin-top: 1rem;">Simpan Penghargaan</button>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
    lucide.createIcons();
}

function addPenghargaan() {
    currentExtras.penghargaan.push({ nomor: '', bidang: '', tingkat: 'Madrasah', tanggal: '' });
    renderPenghargaanTab();
}

function deletePenghargaan(idx) {
    if (confirm('Hapus penghargaan ini?')) {
        currentExtras.penghargaan.splice(idx, 1);
        renderPenghargaanTab();
    }
}

async function savePenghargaan() {
    // Collect all penghargaan inputs
    const inputs = document.querySelectorAll('#penghargaan-content [data-penghargaan-idx]');
    inputs.forEach(input => {
        const idx = parseInt(input.dataset.penghargaanIdx);
        const field = input.dataset.penghargaanField;
        currentExtras.penghargaan[idx][field] = input.value;
    });
    
    renderLoading(true);
    const res = await API.request('saveStudentExtras', {}, { nis: currentNIS, extras: currentExtras });
    renderLoading(false);
    
    if (res && res.success) {
        alert('Data penghargaan berhasil disimpan!');
    } else {
        alert('Gagal menyimpan data penghargaan.');
    }
}


// ===== FUNGSI CETAK TERPISAH =====

// Helper: render tabel nilai efisien (mata pelajaran = baris, kelas+semester = kolom)
function buildNilaiTableHTML(extras) {
    // Header: Mata Pelajaran | K1S1 KKM | K1S1 Nilai | K1S2 KKM | K1S2 Nilai | ... K6S2 Nilai
    const border = 'border: 1px solid #000;';
    const thBase = `style="${border} padding: 3px; text-align: center; font-size: 9px; background: #e8e8e8;"`;
    const tdBase = `style="${border} padding: 3px; text-align: center; font-size: 9px;"`;
    const tdMapel = `style="${border} padding: 3px; font-size: 9px;"`;
    const tdKat = `style="${border} padding: 3px; font-size: 9px; font-weight: 700; background: #f0f0f0;"`;

    let html = `
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
                <tr>
                    <th rowspan="3" style="${border} padding: 3px; text-align: left; font-size: 9px; background: #e8e8e8; width: 28%;">Mata Pelajaran</th>`;

    // Kelas header (span 4 kolom: KKM S1, Nilai S1, KKM S2, Nilai S2)
    for (let k = 1; k <= 6; k++) {
        html += `<th colspan="4" ${thBase}>Kelas ${k}</th>`;
    }
    html += `</tr><tr>`;

    // Semester header (span 2 kolom: KKM, Nilai)
    for (let k = 1; k <= 6; k++) {
        html += `<th colspan="2" ${thBase}>Sem 1</th><th colspan="2" ${thBase}>Sem 2</th>`;
    }
    html += `</tr><tr>`;

    // KKM / Nilai header
    for (let k = 1; k <= 6; k++) {
        for (let s = 1; s <= 2; s++) {
            html += `<th ${thBase} style="${border} padding: 2px; font-size: 8px; background: #e8e8e8; width: 3.5%;">KKM</th>`;
            html += `<th ${thBase} style="${border} padding: 2px; font-size: 8px; background: #e8e8e8; width: 3.5%;">Nilai</th>`;
        }
    }
    html += `</tr></thead><tbody>`;

    // Baris data
    MATA_PELAJARAN.forEach(kategori => {
        const colSpan = 1 + (6 * 4); // 1 kolom mapel + 24 kolom nilai
        html += `<tr><td colspan="${colSpan}" ${tdKat}>${kategori.kategori}</td></tr>`;

        kategori.mapel.forEach(mapel => {
            html += `<tr><td ${tdMapel}>${mapel}</td>`;
            for (let k = 1; k <= 6; k++) {
                for (let s = 1; s <= 2; s++) {
                    const key = `k${k}_s${s}_${mapel}`;
                    const kkm   = (extras.nilai && extras.nilai[key + '_kkm'])   || '';
                    const nilai = (extras.nilai && extras.nilai[key + '_nilai']) || '';
                    html += `<td ${tdBase}>${kkm}</td><td ${tdBase}>${nilai}</td>`;
                }
            }
            html += `</tr>`;
        });
    });

    html += `</tbody></table>`;
    return html;
}

function buildNilaiPrintSection(extras) {
    let html = `<div style="page-break-before: always;"></div>`;
    html += `<h3 style="margin-top: 0; font-size: 14px; border-bottom: 2px solid #000; margin-bottom: 8px;">VII. NILAI MATA PELAJARAN</h3>`;
    html += buildNilaiTableHTML(extras);
    return html;
}

function buildPresensiPrintSection(extras) {
    let html = `<h3 style="margin-top: 20px; font-size: 14px; border-bottom: 1px solid #000; page-break-before: always;">VIII. PRESENSI</h3>`;
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">`;
    html += `<thead><tr>
        <th style="border: 1px solid #000; padding: 4px;">Kelas</th>
        <th style="border: 1px solid #000; padding: 4px;">Semester</th>
        <th style="border: 1px solid #000; padding: 4px;">Sakit (hari)</th>
        <th style="border: 1px solid #000; padding: 4px;">Ijin (hari)</th>
        <th style="border: 1px solid #000; padding: 4px;">Alpa (hari)</th>
    </tr></thead><tbody>`;
    for (let kelas = 1; kelas <= 6; kelas++) {
        for (let sem = 1; sem <= 2; sem++) {
            const sakit = (extras.presensi && extras.presensi[`k${kelas}_s${sem}_sakit`]) || '0';
            const ijin  = (extras.presensi && extras.presensi[`k${kelas}_s${sem}_ijin`])  || '0';
            const alpa  = (extras.presensi && extras.presensi[`k${kelas}_s${sem}_alpa`])  || '0';
            html += `<tr>
                ${sem === 1 ? `<td rowspan="2" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: 600;">Kelas ${kelas}</td>` : ''}
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">Semester ${sem}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sakit}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${ijin}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${alpa}</td>
            </tr>`;
        }
    }
    html += `</tbody></table>`;
    return html;
}

function buildIjazahPrintSection(extras) {
    const ij = extras.ijazah || {};
    let html = `<h3 style="margin-top: 20px; font-size: 14px; border-bottom: 1px solid #000;">IX. IJAZAH</h3>`;
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">`;
    html += `<thead><tr>
        <th style="border: 1px solid #000; padding: 4px; background: #e8e8e8;">Jenis Ijazah</th>
        <th style="border: 1px solid #000; padding: 4px; background: #e8e8e8;">Nomor Ijazah</th>
        <th style="border: 1px solid #000; padding: 4px; background: #e8e8e8;">Kota</th>
        <th style="border: 1px solid #000; padding: 4px; background: #e8e8e8;">Tanggal</th>
    </tr></thead><tbody>`;
    html += `<tr>
        <td style="border: 1px solid #000; padding: 4px; font-weight: 600;">Kemenag</td>
        <td style="border: 1px solid #000; padding: 4px;">${ij.kemenag_nomor || '-'}</td>
        <td style="border: 1px solid #000; padding: 4px;">${ij.kemenag_kota || '-'}</td>
        <td style="border: 1px solid #000; padding: 4px;">${ij.kemenag_tanggal ? formatDateIndo(ij.kemenag_tanggal) : '-'}</td>
    </tr>`;
    html += `<tr>
        <td style="border: 1px solid #000; padding: 4px; font-weight: 600;">Maarif</td>
        <td style="border: 1px solid #000; padding: 4px;">${ij.maarif_nomor || '-'}</td>
        <td style="border: 1px solid #000; padding: 4px;">${ij.maarif_kota || '-'}</td>
        <td style="border: 1px solid #000; padding: 4px;">${ij.maarif_tanggal ? formatDateIndo(ij.maarif_tanggal) : '-'}</td>
    </tr>`;
    html += `</tbody></table>`;
    return html;
}

function buildPenghargaanPrintSection(extras) {
    let html = `<h3 style="margin-top: 20px; font-size: 14px; border-bottom: 1px solid #000;">X. PENGHARGAAN</h3>`;
    if (extras.penghargaan && extras.penghargaan.length > 0) {
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">`;
        html += `<thead><tr>
            <th style="border: 1px solid #000; padding: 4px;">No</th>
            <th style="border: 1px solid #000; padding: 4px;">Nomor Sertifikat</th>
            <th style="border: 1px solid #000; padding: 4px;">Bidang</th>
            <th style="border: 1px solid #000; padding: 4px;">Tingkat</th>
            <th style="border: 1px solid #000; padding: 4px;">Tanggal</th>
        </tr></thead><tbody>`;
        extras.penghargaan.forEach((p, idx) => {
            html += `<tr>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding: 4px;">${p.nomor || '-'}</td>
                <td style="border: 1px solid #000; padding: 4px;">${p.bidang || '-'}</td>
                <td style="border: 1px solid #000; padding: 4px;">${p.tingkat || '-'}</td>
                <td style="border: 1px solid #000; padding: 4px;">${p.tanggal ? formatDateIndo(p.tanggal) : '-'}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
    } else {
        html += `<p style="font-size: 11px; padding: 10px;">Tidak ada data penghargaan.</p>`;
    }
    return html;
}

async function openPrintModal(nis) {
    const student = state.allStudents.find(s => s.NIS.toString() === nis.toString());
    if (!student) return;

    renderLoading(true);
    
    // Load extras data
    const resExtras = await API.request('getStudentExtras', {}, { nis });
    const extras = (resExtras && resExtras.success) ? resExtras.data : {};

    const printContent = document.getElementById('print-preview-content');
    let html = "";

    // Header
    html += `<div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px;">`;
    html += `<img src="${state.settings.LogoUrl || 'https://via.placeholder.com/80'}" alt="Logo" style="width: 100px; height: 100px; object-fit: contain;">`;
    html += `<div style="text-align: center;">`;
    html += `<h1 style="margin: 0; font-size: 26px;">BUKU INDUK SISWA</h1>`;
    html += `<h2 style="margin: 0; font-size: 22px; font-weight: 600;">MI NURUL ISLAM LABRUK KIDUL</h2>`;
    html += `</div></div>`;
    html += `<hr style="border: 0; border-top: 2px solid #000; margin-bottom: 20px;">`;

    const categories = [
        {
            title: "I. KETERANGAN TENTANG DIRI SISWA",
            fields: [
                ['1. NIS', 'NIS'],
                ['2. Nama Lengkap', 'NamaLengkap'],
                ['3. Nama Panggilan', 'NamaPanggilan'],
                ['4. Jenis Kelamin', 'Jenis_Kelamin'],
                ['5. Tempat Lahir', 'TempatLahir'],
                ['6. Tanggal Lahir', 'Tanggal_Lahir'],
                ['7. Agama', 'Agama'],
                ['8. Jumlah Saudara', 'Jumlah_Saudara'],
                ['9. Bahasa Keluarga', 'Bahasa_Keluarga'],
                ['10. Alamat', 'Alamat'],
                ['11. No Telepon', 'No_Telepon'],
                ['12. Jarak ke Sekolah', 'JarakTempat']
            ]
        },
        {
            title: "II. KETERANGAN TENTANG ORANG TUA KANDUNG",
            fields: [
                ['13. Nama Ayah', 'Nama_Ayah'],
                ['14. Pendidikan Ayah', 'Pendidikan_Ayah'],
                ['15. Pekerjaan Ayah', 'Pekerjaan_Ayah'],
                ['16. Nama Ibu', 'Nama_Ibu'],
                ['17. Pendidikan Ibu', 'Pendidikan_Ibu'],
                ['18. Pekerjaan Ibu', 'Pekerjaan_Ibu']
            ]
        },
        {
            title: "III. KETERANGAN TENTANG PENDIDIKAN SEBELUMNYA",
            fields: [
                ['19. Asal TK', 'Asal_TK'],
                ['20. NPSN TK', 'NPSN_TK'],
                ['21. No Ijazah TK', 'No_Ijazah']
            ]
        },
        {
            title: "IV. KETERANGAN PENERIMAAN SISWA",
            fields: [
                ['22. Mutasi Dari', 'Mutasi_Dari'],
                ['23. Diterima di Kelas', 'Kelas'],
                ['24. Diterima Tanggal', 'Diterima_Tanggal'],
                ['25. Tanggal Masuk', 'Tanggal_Masuk']
            ]
        },
        {
            title: "V. KETERANGAN MUTASI KELUAR",
            fields: [
                ['26. Mutasi Keluar Ke', 'Mutasi_Keluar_Ke'],
                ['27. Tgl Mutasi Keluar', 'Tgl_Mutasi_Keluar'],
                ['28. Sekolah Tujuan', 'Sekolah_Tujuan'],
                ['29. NPSN Sekolah Tujuan', 'NPSN_Sekolah_Tujuan']
            ]
        },
        {
            title: "VI. KETERANGAN KELULUSAN",
            fields: [
                ['30. Tanggal Lulus', 'Tgl_Lulus'],
                ['31. Melanjutkan Ke', 'Melanjutkan_Ke'],
                ['32. No Ijazah Lulus', 'No_Ijazah_Lulus'],
                ['33. Tgl Ijazah Lulus', 'Tgl_Ijazah_Lulus']
            ]
        }
    ];

    categories.forEach(cat => {
        html += `<h3 style="margin-top: 15px; font-size: 14px; border-bottom: 1px solid #000;">${cat.title}</h3>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">`;
        cat.fields.forEach(f => {
            let val = student[f[1]] || '-';
            if (f[1].toLowerCase().includes('tanggal') || f[1].toLowerCase().includes('tgl')) {
                val = formatDateIndo(val);
            }
            html += `
                <tr>
                    <td style="padding: 4px; border: 1px solid #ccc; width: 40%; font-size: 12px;">${f[0]}</td>
                    <td style="padding: 4px; border: 1px solid #ccc; font-size: 12px;">${val}</td>
                </tr>
            `;
        });
        html += `</table>`;
    });

    // VII–X: gunakan helper yang sama dengan printStudent
    html += buildNilaiPrintSection(extras);
    html += buildPresensiPrintSection(extras);
    html += buildIjazahPrintSection(extras);
    html += buildPenghargaanPrintSection(extras);

    // Footer
    html += `<div style="margin-top: 3rem; display: flex; justify-content: space-between; align-items: flex-end;">`;
    if (student.Foto_URL) {
        html += `<div style="width: 3cm; height: 4cm; border: 1px dashed #000; display: flex; align-items: center; justify-content: center;">`;
        html += `<img src="${student.Foto_URL}" style="width: 100%; height: 100%; object-fit: cover;">`;
        html += `</div>`;
    } else {
        html += `<div style="width: 3cm; height: 4cm; border: 1px dashed #000;"></div>`;
    }
    html += `<div style="text-align: center;">`;
    html += `<p>${state.settings.Kota || 'Jakarta'}, ${formatDateIndo(state.settings.Tanggal) || ''}</p>`;
    html += `<p>Kepala Sekolah,</p>`;
    html += `<br><br><br>`;
    html += `<p><strong>${state.settings.KepalaSekolah || ''}</strong></p>`;
    html += `</div></div>`;

    printContent.innerHTML = html;
    
    renderLoading(false);
    document.getElementById('print-modal').classList.remove('hidden');
}

function executePrint() {
    const printContent = document.getElementById('print-preview-content').innerHTML;
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write('<html><head><title>Cetak Buku Induk</title>');
    printWindow.document.write(`<style>
        @page { size: A4; margin: 10mm; }
        @page :nth(2) { size: A4 landscape; margin: 8mm; }
        body { font-family: Arial, sans-serif; color: #000; font-size: 11px; }
        table { border-collapse: collapse; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>`);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
}
