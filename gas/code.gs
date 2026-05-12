/**
 * Buku Induk Siswa - GAS Backend
 * Deploy as Web App with "Execute as: Me" and "Who has access: Anyone"
 */

const CONFIG = {
  SHEET_NAME: 'Data_Siswa',
  SETTINGS_SHEET: 'Settings',
  ADMIN_PASSWORD: 'admin123',
};

const HEADERS = [
  "NIS", "NamaLengkap", "NamaPanggilan", "Jenis_Kelamin", "TempatLahir", 
  "Tanggal_Lahir", "Agama", "Jumlah_Saudara", "Bahasa_Keluarga", "Alamat", 
  "No_Telepon", "JarakTempat", "Tanggal_Masuk", "Nama_Ayah", "Pendidikan_Ayah", 
  "Pekerjaan_Ayah", "Nama_Ibu", "Pendidikan_Ibu", "Pekerjaan_Ibu", "Asal_TK", 
  "NPSN_TK", "No_Ijazah", "Mutasi_Dari", "Kelas", "Diterima_Tanggal", "Foto_URL", 
  "Mutasi_Keluar_Ke", "Tgl_Mutasi_Keluar", "Sekolah_Tujuan", "NPSN_Sekolah_Tujuan", 
  "Tgl_Lulus", "Melanjutkan_Ke", "Tgl_Ijazah_Lulus", "No_Ijazah_Lulus", "Password"
];

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getStudents') {
    return handleGetStudents(e.parameter);
  } else if (action === 'getStudent') {
    return handleGetStudent(e.parameter.nis);
  } else if (action === 'getSettings') {
    return handleGetSettings();
  }
  
  return responseJSON({ error: 'Invalid action' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return responseJSON({ error: 'Invalid JSON' });
  }

  const action = data.action;

  if (action === 'loginAdmin') {
    return handleLoginAdmin(data.password);
  } else if (action === 'loginStudent') {
    return handleLoginStudent(data.nis, data.password);
  } else if (action === 'upsertStudent') {
    return handleUpsertStudent(data.student);
  } else if (action === 'deleteStudent') {
    return handleDeleteStudent(data.nis);
  } else if (action === 'bulkUpload') {
    return handleBulkUpload(data.students);
  } else if (action === 'updateSettings') {
    return handleUpdateSettings(data.settings);
  }

  return responseJSON({ error: 'Invalid action' });
}

function handleLoginAdmin(password) {
  if (password === CONFIG.ADMIN_PASSWORD) {
    return responseJSON({ success: true, role: 'admin' });
  }
  return responseJSON({ success: false, error: 'Wrong password' });
}

function handleLoginStudent(nis, password) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nisIdx = headers.indexOf('NIS');
  const passIdx = headers.indexOf('Password');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][nisIdx].toString() === nis.toString()) {
      const studentPass = data[i][passIdx] ? data[i][passIdx].toString() : data[i][headers.indexOf('Tanggal_Lahir')].toString();
      if (studentPass === password.toString()) {
        const studentObj = {};
        headers.forEach((h, idx) => { studentObj[h] = data[i][idx]; });
        return responseJSON({ success: true, role: 'student', student: studentObj });
      }
    }
  }
  return responseJSON({ success: false, error: 'Invalid NIS or password' });
}

function handleGetStudents(params) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return responseJSON({ data: [], total: 0 });

  const headers = data[0];
  const students = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  });

  // Jika request untuk client-side (limit besar dan tanpa search), kirim semua data
  if (!params.q && (!params.limit || params.limit >= 5000)) {
    return responseJSON({
      data: students,
      total: students.length,
      page: 1,
      limit: students.length,
      totalPages: 1
    });
  }

  // Fallback untuk server-side filtering/pagination (jika masih digunakan)
  let filtered = students;
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = students.filter(s => 
      (s.NamaLengkap && s.NamaLengkap.toLowerCase().includes(q)) || 
      (s.NIS && s.NIS.toString().includes(q))
    );
  }

  const total = filtered.length;
  const limit = parseInt(params.limit) || 20;
  const page = parseInt(params.page) || 1;
  const offset = (page - 1) * limit;
  
  return responseJSON({
    data: filtered.slice(offset, offset + limit),
    total: total,
    page: page,
    limit: limit,
    totalPages: Math.ceil(total / limit)
  });
}

function handleUpsertStudent(student) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nisIdx = headers.indexOf('NIS');
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][nisIdx].toString() === student.NIS.toString()) {
      rowIndex = i + 1;
      break;
    }
  }

  const rowValues = headers.map(h => student[h] || '');
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return responseJSON({ success: true });
}

function handleBulkUpload(students) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nisIdx = headers.indexOf('NIS');
  
  const existingNisMap = {};
  for (let i = 1; i < data.length; i++) {
    existingNisMap[data[i][nisIdx].toString()] = i + 1;
  }

  students.forEach(student => {
    const rowValues = headers.map(h => student[h] || '');
    const rowIndex = existingNisMap[student.NIS.toString()];
    
    if (rowIndex) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  });

  return responseJSON({ success: true, count: students.length });
}

function handleDeleteStudent(nis) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nisIdx = headers.indexOf('NIS');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][nisIdx].toString() === nis.toString()) {
      sheet.deleteRow(i + 1);
      return responseJSON({ success: true });
    }
  }
  return responseJSON({ success: false, error: 'Student not found' });
}

function handleGetSettings() {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return responseJSON(settings);
}

function handleUpdateSettings(settings) {
  const sheet = getSettingsSheet();
  sheet.clear();
  sheet.appendRow(['Key', 'Value']);
  for (const key in settings) {
    sheet.appendRow([key, settings[key]]);
  }
  return responseJSON({ success: true });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    sheet.appendRow(['Key', 'Value']);
    sheet.appendRow(['Kota', 'Jakarta']);
    sheet.appendRow(['Tanggal', Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd')]);
    sheet.appendRow(['KepalaSekolah', 'Nama Kepala Sekolah, M.Pd']);
    sheet.appendRow(['ApiUrl', '']);
    sheet.appendRow(['LogoUrl', 'https://via.placeholder.com/80']);
  }
  return sheet;
}

function handleGetStudent(nis) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nisIdx = headers.indexOf('NIS');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][nisIdx].toString() === nis.toString()) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = data[i][idx]; });
      return responseJSON(obj);
    }
  }
  return responseJSON({ error: 'Not found' });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
