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
  } else if (action === 'getStudentExtras') {
    return handleGetStudentExtras(data.nis);
  } else if (action === 'saveStudentExtras') {
    return handleSaveStudentExtras(data.nis, data.extras);
  }

  return responseJSON({ error: 'Invalid action' });
}

function handleLoginAdmin(password) {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getDisplayValues();
  let adminPass = CONFIG.ADMIN_PASSWORD;
  
  // Cari password admin terbaru dari sheet Settings
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'AdminPassword') {
      adminPass = data[i][1];
      break;
    }
  }
  
  if (password === adminPass.toString()) {
    return responseJSON({ success: true, role: 'admin' });
  }
  return responseJSON({ success: false, error: 'Wrong password' });
}

function handleLoginStudent(nis, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet();
  const data = sheet.getDataRange().getDisplayValues(); // Use display values for initial search
  const headers = data[0].map(h => h.toString().trim());
  const tz = ss.getSpreadsheetTimeZone();
  
  const nisIdx = headers.indexOf('NIS');
  const passIdx = headers.indexOf('Password');
  const tglIdx = headers.indexOf('Tanggal_Lahir');
  
  const inputNis = nis.toString().trim();
  const inputPass = password.toString().trim();
  
  for (let i = 1; i < data.length; i++) {
    // Clean database NIS (remove dots/commas) to match input 4631 vs 4.631
    let dbNisRaw = data[i][nisIdx].toString().trim();
    let dbNisClean = dbNisRaw.replace(/[.,\s]/g, '');
    
    if (dbNisClean === inputNis || dbNisRaw === inputNis) {
      let dbPass = data[i][passIdx].toString().trim();
      
      if (!dbPass) {
        let dbTgl = data[i][tglIdx].toString().trim();
        // Try to convert to Date if it looks like ISO
        if (dbTgl.includes('T') || dbTgl.includes('Z')) {
          try {
            let d = new Date(dbTgl);
            dbPass = Utilities.formatDate(d, tz, "dd-MM-yyyy");
          } catch(e) { dbPass = dbTgl; }
        } else {
          // Normalize normal date strings (YYYY-MM-DD -> DD-MM-YYYY)
          let parts = dbTgl.split(/[T ]/)[0].split(/[-/]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              dbPass = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
              dbPass = parts.join('-');
            }
          } else {
            dbPass = dbTgl;
          }
        }
      }
      
      if (dbPass === inputPass) {
        const studentObj = rowToObject(data[i], headers);
        return responseJSON({ success: true, role: 'student', student: studentObj });
      }
    }
  }
  return responseJSON({ success: false, error: 'Invalid NIS or password' });
}

function rowToObject(row, headers) {
  const obj = {};
  headers.forEach((h, idx) => {
    obj[h] = row[idx];
  });
  return obj;
}

function handleGetStudents(params) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return responseJSON({ data: [], total: 0 });

  const headers = data[0];
  const students = data.slice(1).map(row => rowToObject(row, headers));

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
  const data = sheet.getDataRange().getDisplayValues();
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
  const data = sheet.getDataRange().getDisplayValues();
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
  const data = sheet.getDataRange().getDisplayValues();
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
  const data = sheet.getDataRange().getDisplayValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      settings[data[i][0]] = data[i][1];
    }
  }
  // Jangan kembalikan password admin ke frontend untuk keamanan
  if (settings.AdminPassword) {
    delete settings.AdminPassword;
  }
  return responseJSON(settings);
}

function handleUpdateSettings(settings) {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (const key in settings) {
    let found = false;
    const value = settings[key];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value]);
    }
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
    sheet.appendRow(['AdminPassword', CONFIG.ADMIN_PASSWORD]);
    sheet.appendRow(['LogoUrl', 'https://via.placeholder.com/80']);
  }
  return sheet;
}

function handleGetStudent(nis) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  const nisIdx = headers.indexOf('NIS');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][nisIdx].toString() === nis.toString()) {
      const obj = rowToObject(data[i], headers);
      return responseJSON(obj);
    }
  }
  return responseJSON({ error: 'Not found' });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== FUNGSI UNTUK NILAI, PRESENSI, IJAZAH, PENGHARGAAN =====

function getExtrasSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Data_Extras');
  if (!sheet) {
    sheet = ss.insertSheet('Data_Extras');
    sheet.appendRow(['NIS', 'DataJSON']);
  }
  return sheet;
}

function handleGetStudentExtras(nis) {
  const sheet = getExtrasSheet();
  const data = sheet.getDataRange().getDisplayValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === nis.toString()) {
      try {
        const extras = JSON.parse(data[i][1]);
        return responseJSON({ success: true, data: extras });
      } catch (e) {
        return responseJSON({ success: true, data: {} });
      }
    }
  }
  
  // Return empty structure if not found
  return responseJSON({ success: true, data: {} });
}

function handleSaveStudentExtras(nis, extras) {
  const sheet = getExtrasSheet();
  const data = sheet.getDataRange().getDisplayValues();
  const jsonString = JSON.stringify(extras);
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === nis.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 2).setValue(jsonString);
  } else {
    sheet.appendRow([nis, jsonString]);
  }
  
  return responseJSON({ success: true });
}
