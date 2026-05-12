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
                            <button class="btn btn-secondary" onclick="editStudent('${s.NIS}')" title="Edit"><i data-lucide="edit-2" style="width:14px"></i></button>
                            <button class="btn btn-secondary" style="color: var(--danger)" onclick="deleteStudent('${s.NIS}')" title="Hapus"><i data-lucide="trash-2" style="width:14px"></i></button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="printStudent('${s.NIS}')" title="Cetak"><i data-lucide="printer" style="width:14px"></i></button>
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

function printStudent(nis) {
    const student = state.students.find(s => s.NIS.toString() === nis.toString());
    if (!student) return;

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
            title: "VI. KETERANGAN PENDIDIKAN SELANJUTNYA",
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
    if (student) {
        const content = document.getElementById('details-content');
        let html = '<div class="grid-2" style="max-height: 60vh; overflow-y: auto;">';
        for (let key in student) {
            let val = student[key];
            // Format dates
            if (key.toLowerCase().includes('tanggal') || key.toLowerCase().includes('tgl')) {
                val = formatDateIndo(val);
            }
            html += `
                <div style="padding: 10px; border-bottom: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${key.replace(/_/g, ' ')}</div>
                    <div style="font-size: 0.95rem; color: var(--text-main);">${val || '-'}</div>
                </div>
            `;
        }
        html += '</div>';
        content.innerHTML = html;
        document.getElementById('details-modal').classList.remove('hidden');
        lucide.createIcons();
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
