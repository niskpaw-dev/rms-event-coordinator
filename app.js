const form = document.getElementById("performanceForm");
const list = document.getElementById("performanceList");

const guruInput = document.getElementById("guru");
const perguruanInput = document.getElementById("perguruan");
const pesilatInput = document.getElementById("pesilat");
const catatanInput = document.getElementById("catatan");

const submitButton = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");

let editId = null;
let idToDelete = null;
let performancesData = {}; // Cache untuk menyimpan data persembahan
let allPerformances = []; // Menyimpan semua data untuk tapisan lokal
let currentExportList = []; // Menyimpan senarai yang telah ditapis & disusun untuk eksport
let searchQuery = "";
let selectedCategoryFilter = "";

const searchInput = document.getElementById("searchPerguruan");
const clearSearchBtn = document.getElementById("clearSearchBtn");

let searchTimeout;
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchQuery = e.target.value.toLowerCase();
    
    // Tunjuk/sorok butang clear berdasarkan nilai input
    if (clearSearchBtn) {
      if (searchQuery.length > 0) {
        clearSearchBtn.classList.remove("hidden");
      } else {
        clearSearchBtn.classList.add("hidden");
      }
    }

    searchTimeout = setTimeout(() => {
      renderList(); // Kemaskini paparan selepas pengguna berhenti menaip (300ms)
    }, 300);
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.classList.add("hidden"); // Sorokkan butang semula
    renderList(); // Kemaskini semula paparan (reset)
  });
}

const filterKategori = document.getElementById("filterKategori");
if (filterKategori) {
  filterKategori.addEventListener("change", (e) => {
    selectedCategoryFilter = e.target.value;
    renderList(); // Kemaskini senarai jika kategori dipilih
  });
}

const sortOption = document.getElementById("sortOption");
if (sortOption) {
  sortOption.addEventListener("change", () => {
    renderList(); // Render semula senarai jika pilihan susunan diubah
  });
}

// =========================
// KATEGORI DINAMIK
// =========================

let availableCategories = ["Seni Tari", "Tempur Kosong", "Tempur Belantan", "Tempur Parang", "Tempur Keris", "Lompatan Harimau", "Lompatan Gelung Api", "Pecah Genting"];

function renderCategoryCheckboxes() {
  const container = document.getElementById("kategoriCheckboxes");
  if (!container) return;
  
  const checkedBoxes = Array.from(document.querySelectorAll('input[name="kategori"]:checked')).map(cb => cb.value);
  container.innerHTML = "";
  
  availableCategories.forEach(cat => {
    const isChecked = checkedBoxes.includes(cat) ? "checked" : "";
    container.innerHTML += `
      <label class="flex items-start gap-2 cursor-pointer group">
        <input type="checkbox" name="kategori" value="${escapeHTML(cat)}" class="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-900" ${isChecked}>
        <span class="text-sm md:text-base text-gray-300 group-hover:text-white transition leading-tight">${escapeHTML(cat)}</span>
      </label>
    `;
  });

  // Turut kemas kini pilihan di dalam kotak filter carian
  if (filterKategori) {
    const currentFilter = filterKategori.value; // Simpan pilihan semasa (jika ada)
    filterKategori.innerHTML = '<option value="">Semua Kategori</option>';
    availableCategories.forEach(cat => {
      filterKategori.innerHTML += `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    });
    filterKategori.value = currentFilter; // Pulihkan pilihan semasa
  }
}

function addNewCategoryForm() {
  const newCategory = prompt("Sila masukkan nama kategori baru:");
  if (newCategory && newCategory.trim() !== "") {
    const clean = newCategory.trim();
    if (!availableCategories.includes(clean)) {
      availableCategories.push(clean);
      renderCategoryCheckboxes();
    }
    setTimeout(() => {
      const allCb = Array.from(document.querySelectorAll('input[name="kategori"]'));
      const cb = allCb.find(c => c.value === clean);
      if (cb) {
         cb.checked = true;
         document.getElementById('kategoriError').classList.add('hidden');
      }
    }, 10);
  }
}

renderCategoryCheckboxes(); // Init

// =========================
// URUS KATEGORI (MODAL)
// =========================

function openCategoryModal() {
  const catList = document.getElementById("categoryList");
  catList.innerHTML = "";
  
  
  if (availableCategories.length === 0) {
    catList.innerHTML = `<p class="text-gray-400 text-sm">Tiada kategori dijumpai.</p>`;
  } else {
    availableCategories.forEach(catName => {
      catList.innerHTML += `
        <div class="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-gray-700">
          <span class="font-medium text-sm md:text-base">${escapeHTML(catName)}</span>
          <div class="flex gap-3">
            <button type="button" onclick="editCategoryName('${escapeHTML(catName).replace(/'/g, "\\'")}')" class="text-blue-400 hover:text-blue-300 text-sm font-bold transition">Edit</button>
            <button type="button" onclick="deleteCategoryName('${escapeHTML(catName).replace(/'/g, "\\'")}')" class="text-red-400 hover:text-red-300 text-sm font-bold transition">Padam</button>
          </div>
        </div>
      `;
    });
  }
  
  document.getElementById("categoryModal").classList.remove("hidden");
}

function closeCategoryModal() {
  document.getElementById("categoryModal").classList.add("hidden");
}

async function editCategoryName(oldName) {
  const newName = prompt(`Masukkan nama baharu untuk "${oldName}":\n\n(Ini akan turut mengemaskini semua persembahan yang menggunakan kategori ini dalam database)`, oldName);
  if (!newName || newName.trim() === "" || newName === oldName) return;
  
  const finalName = newName.trim();

  try {
    const batch = db.batch();
    let hasUpdates = false;

    // 1. Array format
    const snapshotArr = await db.collection("performances").where("kategori", "array-contains", oldName).get();
    snapshotArr.forEach(doc => {
      let data = doc.data();
      let newCats = data.kategori.map(c => c === oldName ? finalName : c);
      batch.update(doc.ref, { kategori: newCats });
      hasUpdates = true;
    });

    // 2. String format (legacy)
    const snapshotStr = await db.collection("performances").where("kategori", "==", oldName).get();
    snapshotStr.forEach(doc => {
      batch.update(doc.ref, { kategori: [finalName] });
      hasUpdates = true;
    });

    if (hasUpdates) await batch.commit();

    const idx = availableCategories.indexOf(oldName);
    if (idx !== -1) availableCategories[idx] = finalName;
    renderCategoryCheckboxes();

    showToast("Kategori berjaya dikemaskini.", "success");
    openCategoryModal(); // Segarkan senarai
  } catch (error) {
    console.error(error);
    showToast("Ralat mengemaskini kategori.", "error");
  }
}

async function deleteCategoryName(oldName) {
  const confirmDel = confirm(`Adakah awak pasti mahu memadam kategori "${oldName}"?\n\nNota: Mana-mana persembahan yang sedang menggunakan kategori ini akan kehilangan tag kategorinya.`);
  if (!confirmDel) return;

  try {
    const batch = db.batch();
    let hasUpdates = false;

    const snapshotArr = await db.collection("performances").where("kategori", "array-contains", oldName).get();
    snapshotArr.forEach(doc => {
      let data = doc.data();
      let newCats = data.kategori.filter(c => c !== oldName);
      batch.update(doc.ref, { kategori: newCats });
      hasUpdates = true;
    });

    const snapshotStr = await db.collection("performances").where("kategori", "==", oldName).get();
    snapshotStr.forEach(doc => {
      batch.update(doc.ref, { kategori: [] });
      hasUpdates = true;
    });

    if (hasUpdates) await batch.commit();

    availableCategories = availableCategories.filter(c => c !== oldName);
    renderCategoryCheckboxes();

    showToast("Kategori berjaya dipadam.", "success");
    openCategoryModal(); // Segarkan senarai
  } catch (error) {
    console.error(error);
    showToast("Ralat memadam kategori.", "error");
  }
}

// =========================
// UTILITIES
// =========================

function escapeHTML(str) {
  if (!str) return "";
  return str.toString().replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const icon = type === 'success' ? '✅' : '⚠️';
  
  toast.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300 opacity-0 translate-y-5 flex items-center gap-3 font-medium`;
  toast.innerHTML = `<span class="text-xl">${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => toast.classList.remove('opacity-0', 'translate-y-5'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-5');
    setTimeout(() => toast.remove(), 300); // Buang dari DOM selepas animasi
  }, 3000);
}

function getCategoryStyles(category) {
  switch (category) {
    case "Seni Tari": return { border: "border-l-4 border-pink-500", pill: "bg-pink-600" };
    case "Tempur Kosong": return { border: "border-l-4 border-blue-500", pill: "bg-blue-600" };
    case "Tempur Belantan": return { border: "border-l-4 border-green-500", pill: "bg-green-600" };
    case "Tempur Parang": return { border: "border-l-4 border-red-500", pill: "bg-red-600" };
    case "Tempur Keris": return { border: "border-l-4 border-purple-500", pill: "bg-purple-600" };
    case "Lompatan Harimau": return { border: "border-l-4 border-orange-500", pill: "bg-orange-600" };
    case "Lompatan Gelung Api": return { border: "border-l-4 border-orange-700", pill: "bg-orange-700" };
    case "Pecah Genting": return { border: "border-l-4 border-gray-400", pill: "bg-gray-600" };
    default: return { border: "border-l-4 border-teal-500", pill: "bg-teal-600" };
  }
}

function playPopSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return; // Abaikan jika pelayar web lama
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.07);
    
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.07);
  } catch (e) { }
}

// =========================
// SUBMIT / UPDATE
// =========================

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  playPopSound(); // Mainkan bunyi 'pop' apabila butang ditekan

  const jumlahPesilat = parseInt(pesilatInput.value);
  if (jumlahPesilat < 1) {
    showToast("Jumlah pesilat mestilah sekurang-kurangnya 1 orang.", "error");
    return;
  }

  const checkedBoxes = Array.from(document.querySelectorAll('input[name="kategori"]:checked')).map(cb => cb.value);
  if (checkedBoxes.length === 0) {
    document.getElementById('kategoriError').classList.remove('hidden');
    return;
  } else {
    document.getElementById('kategoriError').classList.add('hidden');
  }

  const data = {
    guru: toTitleCase(guruInput.value.trim()),
    perguruan: toTitleCase(perguruanInput.value.trim()),
    kategori: checkedBoxes,
    pesilat: jumlahPesilat,
    catatan: catatanInput.value.trim(),
  };

  // Animasi Loading pada Butang
  submitButton.disabled = true;
  submitButton.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 inline-block text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Menyimpan...`;
  submitButton.classList.add("opacity-75", "cursor-not-allowed");

  try {

    // UPDATE MODE
    if (editId) {
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

      await db.collection("performances")
        .doc(editId)
        .update(data);

      showToast("Persembahan berjaya dikemaskini.", "success");
      
      cancelEdit(); // Reset form & UI kembali ke mod asal

    } else {

      // ADD MODE
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("performances").add(data);

      showToast("Persembahan berjaya ditambah.", "success");
      form.reset();
      document.querySelectorAll('input[name="kategori"]').forEach(cb => cb.checked = false);

    }

  } catch (error) {

    console.error(error);
    showToast("Ralat berlaku semasa menyimpan data.", "error");

  } finally {
    // Mengembalikan butang kepada keadaan asal sama ada berjaya atau ralat
    submitButton.disabled = false;
    submitButton.classList.remove("opacity-75", "cursor-not-allowed");
    submitButton.innerText = editId ? "Update Persembahan" : "Simpan Persembahan";
  }

});

// =========================
// REALTIME LISTENER
// =========================

db.collection("performances")
  .orderBy("createdAt", "desc")
  .onSnapshot((snapshot) => {

    allPerformances = [];
    performancesData = {};

    snapshot.forEach((doc) => {
      const item = doc.data();
      item.id = doc.id; // Simpan rujukan ID
      
      performancesData[doc.id] = item; 
      allPerformances.push(item);
    });

    renderList();

  }, (error) => {
    console.error("Ralat menarik data dari Firestore (Live Listener): ", error);
    showToast("Gagal memuat turun senarai persembahan.", "error");
  });

function renderList() {
    let totalPesilat = 0;
    let perguruanSet = new Set();
    let kategoriSet = new Set();
    let htmlContent = "";
    let renderedCount = 0;
    
    currentExportList = []; // Kosongkan senarai eksport sebelum melukis (render) yang baharu

    // Salin array asal supaya kita tidak mengganggu susunan asal dari Firebase
    let listToRender = [...allPerformances];

    // Semak fungsi isihan (sort) mana yang dipilih
    if (sortOption && sortOption.value === "most_pesilat") {
      listToRender.sort((a, b) => (b.pesilat || 0) - (a.pesilat || 0));
    }

    listToRender.forEach((item) => {

      // Tangani format array (baru) atau string (legacy)
      let cats = Array.isArray(item.kategori) ? item.kategori : (item.kategori ? [item.kategori] : []);

      // Fungsi Tapisan (Filter) - Dropdown Kategori Khusus
      if (selectedCategoryFilter && !cats.includes(selectedCategoryFilter)) {
        return; // Langkau item jika tidak mengandungi kategori yang dipilih
      }

      // Fungsi Tapisan (Filter)
      if (searchQuery) {
        const matchPerguruan = item.perguruan && item.perguruan.toLowerCase().includes(searchQuery);
        const matchGuru = item.guru && item.guru.toLowerCase().includes(searchQuery);
        const matchKategori = cats.some(c => c.toLowerCase().includes(searchQuery));
        
        if (!matchPerguruan && !matchGuru && !matchKategori) {
          return; // Langkau item (jangan lukis) jika tidak padan dengan mana-mana carian
        }
      }

      // Lakukan pengiraan HANYA JIKA item melepasi tapisan carian di atas
      totalPesilat += (item.pesilat || 0); 
      if (item.perguruan) perguruanSet.add(item.perguruan);
      cats.forEach(c => kategoriSet.add(c));

      // Hanya masukkan item yang melepasi tapisan carian ke dalam senarai eksport
      currentExportList.push(item);
      renderedCount++;

      const borderStyle = cats.length > 0 ? getCategoryStyles(cats[0]).border : "border-l-4 border-gray-500";
      let pillsHtml = cats.map(c => {
         const styles = getCategoryStyles(c);
         return `<span class="${styles.pill} px-2.5 py-1 rounded-full text-xs md:text-sm text-white">${escapeHTML(c)}</span>`;
      }).join("");
      
      if (cats.length === 0) {
         pillsHtml = `<span class="bg-gray-600 px-2.5 py-1 rounded-full text-xs md:text-sm text-white">Tiada Kategori</span>`;
      }

      htmlContent += `
        <div class="glass rounded-xl md:rounded-2xl p-4 md:p-5 h-full ${borderStyle} hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 flex flex-col justify-between">

          <div>
            <h3 class="text-lg md:text-xl font-bold text-yellow-400 leading-tight mb-1">
              ${escapeHTML(item.perguruan)}
            </h3>

            <p class="text-gray-300 text-sm md:text-base flex items-center gap-1.5 mb-3 md:mb-4">
              <span class="text-gray-500">👤 Guru:</span> <span class="font-medium">${escapeHTML(item.guru)}</span>
            </p>

            <div class="flex gap-1.5 md:gap-2 flex-wrap items-center">
              ${pillsHtml}
              <span class="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold flex items-center gap-1.5">
                👥 ${item.pesilat || 0} Pesilat
              </span>
            </div>

            ${
              item.catatan
              ? `<div class="mt-3 md:mt-4 p-3 bg-black/20 rounded-lg border border-gray-700/50">
                   <p class="text-gray-400 text-xs md:text-sm italic">"${escapeHTML(item.catatan)}"</p>
                 </div>`
              : ""
            }
          </div>

          <div class="flex gap-2 mt-4 md:mt-5 pt-4 border-t border-gray-700/50">
            <button onclick="editPerformance('${item.id}')" class="flex-1 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent px-3 py-1.5 md:py-2 rounded-lg text-sm font-medium transition duration-300 flex items-center justify-center gap-1.5">
              ✏️ Edit
            </button>
            <button onclick="deletePerformance('${item.id}')" class="flex-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent px-3 py-1.5 md:py-2 rounded-lg text-sm font-medium transition duration-300 flex items-center justify-center gap-1.5">
              🗑️ Padam
            </button>
          </div>

        </div>
      `;

    });

    if (renderedCount === 0) {
      if (searchQuery || selectedCategoryFilter) {
        // Jika senarai kosong disebabkan oleh tapisan carian
        let message = searchQuery ? `Tiada hasil padanan untuk "${escapeHTML(searchQuery)}"` : `Tiada hasil padanan untuk kategori "${escapeHTML(selectedCategoryFilter)}"`;
        list.innerHTML = `
          <div class="flex flex-col items-center justify-center py-8 md:py-10 text-yellow-500 bg-yellow-500/10 rounded-xl md:rounded-2xl border border-yellow-500/20 xl:col-span-2 text-center px-4">
            <span class="text-3xl md:text-4xl mb-2 md:mb-3">🔍</span>
            <p class="font-bold text-base md:text-lg">${message}</p>
            <p class="text-xs md:text-sm text-yellow-500/70 mt-1">Sila cuba kata kunci, kategori, atau ejaan yang lain.</p>
          </div>`;
      } else {
        // Jika senarai kosong kerana memang tiada data dalam pangkalan data
        list.innerHTML = `<div class="text-center py-8 md:py-10 text-gray-400 font-medium xl:col-span-2 text-sm md:text-base">Tiada persembahan dijumpai.</div>`;
      }
    } else {
      list.innerHTML = htmlContent;
    }
    document.getElementById("totalPersembahan").innerText = renderedCount;
    document.getElementById("totalPesilat").innerText = totalPesilat;
    document.getElementById("totalPerguruan").innerText = perguruanSet.size;
    document.getElementById("totalKategori").innerText = kategoriSet.size;

    // Pastikan semua kategori sejarah dari database dimasukkan ke dalam senarai checkbox
    let addedNew = false;
    kategoriSet.forEach(kat => {
      if (!availableCategories.includes(kat) && kat.trim() !== "") {
        availableCategories.push(kat);
        addedNew = true;
      }
    });
    if (addedNew) renderCategoryCheckboxes();

}

// =========================
// EXPORT TO CSV
// =========================

function exportToCSV() {
  if (currentExportList.length === 0) {
    showToast("Tiada data untuk dieksport.", "error");
    return;
  }

  const headers = ["Perguruan", "Guru", "Kategori", "Pesilat", "Catatan"];
  const csvRows = [];
  
  // Masukkan baris tajuk (headers) pada permulaan fail
  csvRows.push(headers.join(","));

  // Masukkan data setiap persembahan berdasarkan senarai semasa yang dipaparkan
  currentExportList.forEach(item => {
    let cats = Array.isArray(item.kategori) ? item.kategori : (item.kategori ? [item.kategori] : []);
    let catString = cats.join(", ");

    const row = [
      `"${(item.perguruan || "").replace(/"/g, '""')}"`,
      `"${(item.guru || "").replace(/"/g, '""')}"`,
      `"${catString.replace(/"/g, '""')}"`,
      item.pesilat || 0,
      `"${(item.catatan || "").replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(","));
  });

  // Jana fail CSV dan mula proses muat turun
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Senarai_Persembahan_${new Date().toISOString().slice(0, 10)}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================
// EDIT FUNCTION
// =========================

function editPerformance(id) {
  const item = performancesData[id];
  if (!item) return;

  editId = id;

  guruInput.value = item.guru;
  perguruanInput.value = item.perguruan;
  pesilatInput.value = item.pesilat;
  catatanInput.value = item.catatan || "";

  let cats = Array.isArray(item.kategori) ? item.kategori : (item.kategori ? [item.kategori] : []);
  document.querySelectorAll('input[name="kategori"]').forEach(cb => {
    cb.checked = cats.includes(cb.value);
  });
  document.getElementById('kategoriError').classList.add('hidden');

  submitButton.innerText = "Update Persembahan";
  cancelBtn.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}

function cancelEdit() {
  editId = null;
  form.reset();
  document.querySelectorAll('input[name="kategori"]').forEach(cb => cb.checked = false);
  document.getElementById('kategoriError').classList.add('hidden');
  submitButton.innerText = "Simpan Persembahan";
  cancelBtn.classList.add("hidden");
}

// =========================
// STATUS RANGKAIAN (NETWORK)
// =========================

window.addEventListener('offline', () => {
  showToast("Sambungan internet terputus. Mod luar talian...", "error");
});

window.addEventListener('online', () => {
  showToast("Internet kembali! Menyegarkan halaman...", "success");
  // Muat semula halaman secara automatik selepas 2 saat untuk memastikan data terkini
  setTimeout(() => {
    window.location.reload();
  }, 2000);
});

// =========================
// DELETE FUNCTION
// =========================

function deletePerformance(id) {
  idToDelete = id;
  document.getElementById("deleteModal").classList.remove("hidden");
}

function closeDeleteModal() {
  idToDelete = null;
  document.getElementById("deleteModal").classList.add("hidden");
}

async function executeDelete() {
  if (!idToDelete) return;
  
  try {
    await db.collection("performances")
      .doc(idToDelete)
      .delete();

    showToast("Persembahan berjaya dipadam.", "success");

  } catch (error) {

    console.error(error);
    showToast("Ralat semasa memadam persembahan.", "error");

  }
  
  closeDeleteModal();
}

// =========================
// JAM REAL-TIME (WAKTU SEMASA)
// =========================

function updateClock() {
  const clockElement = document.getElementById("realtimeClock");
  if (!clockElement) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  
  const dayName = days[now.getDay()];
  const day = String(now.getDate()).padStart(2, '0');
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  
  const dateString = `${dayName}, ${day} ${monthName} ${year}`;

  clockElement.innerText = `${dateString} • ${timeString}`;
}

setInterval(updateClock, 1000);
updateClock(); // Init panggil terus supaya tidak melengahkan paparan
