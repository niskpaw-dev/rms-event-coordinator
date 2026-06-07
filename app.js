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

// =========================
// SUBMIT / UPDATE
// =========================

form.addEventListener("submit", async (e) => {
  e.preventDefault();

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
        <div class="glass rounded-xl md:rounded-2xl p-4 md:p-5 h-full ${borderStyle} hover:scale-[1.02] hover:shadow-2xl transition-all duration-300">

          <div class="flex flex-col sm:flex-row justify-between items-start gap-3 md:gap-4">

            <div class="w-full">

              <h3 class="text-lg md:text-xl font-bold text-yellow-400 leading-tight">
                ${escapeHTML(item.perguruan)}
              </h3>

              <p class="text-gray-300 mt-1 text-sm md:text-base">
                Guru: ${escapeHTML(item.guru)}
              </p>

              <div class="flex gap-1.5 md:gap-2 mt-2 md:mt-3 flex-wrap">

                ${pillsHtml}

                <span class="bg-yellow-500 text-black px-2.5 py-1 rounded-full text-xs md:text-sm font-bold">
                  ${item.pesilat || 0} Pesilat
                </span>

              </div>

              ${
                item.catatan
                ? `<p class="text-gray-400 mt-2.5 md:mt-3 text-sm">${escapeHTML(item.catatan)}</p>`
                : ""
              }

            </div>

            <div class="flex flex-row sm:flex-col gap-2 w-full sm:w-auto mt-3 sm:mt-0">

              <button
                onclick="editPerformance('${item.id}')"
                class="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 px-3 py-1.5 md:py-2 rounded-lg text-sm font-medium transition"
              >
                Edit
              </button>

              <button
                onclick="deletePerformance('${item.id}')"
                class="flex-1 sm:flex-none bg-red-700 hover:bg-red-600 px-3 py-1.5 md:py-2 rounded-lg text-sm font-medium transition"
              >
                Delete
              </button>

            </div>

          </div>

        </div>
      `;

    });

    if (renderedCount === 0) {
      if (searchQuery) {
        // Jika senarai kosong disebabkan oleh tapisan carian
        list.innerHTML = `
          <div class="flex flex-col items-center justify-center py-8 md:py-10 text-yellow-500 bg-yellow-500/10 rounded-xl md:rounded-2xl border border-yellow-500/20 xl:col-span-2 text-center px-4">
            <span class="text-3xl md:text-4xl mb-2 md:mb-3">🔍</span>
            <p class="font-bold text-base md:text-lg">Tiada hasil padanan untuk "${escapeHTML(searchQuery)}"</p>
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
