const form = document.getElementById("performanceForm");
const list = document.getElementById("performanceList");

const guruInput = document.getElementById("guru");
const perguruanInput = document.getElementById("perguruan");
const kategoriInput = document.getElementById("kategori");
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
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderList(); // Kemaskini paparan setiap kali pengguna menaip
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

kategoriInput.addEventListener("change", (e) => {
  if (e.target.value === "ADD_NEW") {
    const newCategory = prompt("Sila masukkan nama kategori baru:");
    
    if (newCategory && newCategory.trim() !== "") {
      const newOption = document.createElement("option");
      newOption.value = newCategory.trim();
      newOption.textContent = newCategory.trim();
      kategoriInput.insertBefore(newOption, kategoriInput.lastElementChild);
      kategoriInput.value = newOption.value; // Terus pilih kategori baru ini
    } else {
      kategoriInput.value = ""; // Reset jika pengguna batal
    }
  }
});

// =========================
// UTILITIES
// =========================

function escapeHTML(str) {
  if (!str) return "";
  return str.toString().replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
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

  const data = {
    guru: guruInput.value,
    perguruan: perguruanInput.value,
    kategori: kategoriInput.value,
    pesilat: parseInt(pesilatInput.value),
    catatan: catatanInput.value,
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

    document.getElementById("totalPersembahan").innerText = allPerformances.length;

    // Salin array asal supaya kita tidak mengganggu susunan asal dari Firebase
    let listToRender = [...allPerformances];

    // Semak fungsi isihan (sort) mana yang dipilih
    if (sortOption && sortOption.value === "most_pesilat") {
      listToRender.sort((a, b) => (b.pesilat || 0) - (a.pesilat || 0));
    }

    listToRender.forEach((item) => {

      totalPesilat += (item.pesilat || 0); 
      if (item.perguruan) perguruanSet.add(item.perguruan);
      if (item.kategori) kategoriSet.add(item.kategori);

      // Fungsi Tapisan (Filter)
      if (searchQuery) {
        const matchPerguruan = item.perguruan && item.perguruan.toLowerCase().includes(searchQuery);
        const matchGuru = item.guru && item.guru.toLowerCase().includes(searchQuery);
        const matchKategori = item.kategori && item.kategori.toLowerCase().includes(searchQuery);
        
        if (!matchPerguruan && !matchGuru && !matchKategori) {
          return; // Langkau item (jangan lukis) jika tidak padan dengan mana-mana carian
        }
      }

      // Hanya masukkan item yang melepasi tapisan carian ke dalam senarai eksport
      currentExportList.push(item);
      renderedCount++;

      const styles = getCategoryStyles(item.kategori);

      htmlContent += `
        <div class="glass rounded-2xl p-5 h-full ${styles.border}">

          <div class="flex justify-between items-start gap-4">

            <div>

              <h3 class="text-xl font-bold text-yellow-400">
                ${escapeHTML(item.perguruan)}
              </h3>

              <p class="text-gray-300 mt-1">
                Guru: ${escapeHTML(item.guru)}
              </p>

              <div class="flex gap-2 mt-3 flex-wrap">

                <span class="${styles.pill} px-3 py-1 rounded-full text-sm text-white">
                  ${escapeHTML(item.kategori)}
                </span>

                <span class="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  ${item.pesilat || 0} Pesilat
                </span>

              </div>

              ${
                item.catatan
                ? `<p class="text-gray-400 mt-3">${escapeHTML(item.catatan)}</p>`
                : ""
              }

            </div>

            <div class="flex flex-col gap-2">

              <button
                onclick="editPerformance('${item.id}')"
                class="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg"
              >
                Edit
              </button>

              <button
                onclick="deletePerformance('${item.id}')"
                class="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-lg"
              >
                Delete
              </button>

            </div>

          </div>

        </div>
      `;

    });

    if (renderedCount === 0) {
      list.innerHTML = `<div class="text-center py-10 text-gray-400 font-medium xl:col-span-2">Tiada persembahan dijumpai.</div>`;
    } else {
      list.innerHTML = htmlContent;
    }
    document.getElementById("totalPesilat").innerText = totalPesilat;
    document.getElementById("totalPerguruan").innerText = perguruanSet.size;
    document.getElementById("totalKategori").innerText = kategoriSet.size;

    // Pastikan semua kategori sejarah dari database dimasukkan ke dalam dropdown
    kategoriSet.forEach(kat => {
      const exists = Array.from(kategoriInput.options).some(opt => opt.value === kat);
      if (!exists && kat.trim() !== "") {
        const newOption = document.createElement("option");
        newOption.value = kat;
        newOption.textContent = kat;
        kategoriInput.insertBefore(newOption, kategoriInput.lastElementChild); // Letak atas butang tambah
      }
    });

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
    const row = [
      `"${(item.perguruan || "").replace(/"/g, '""')}"`,
      `"${(item.guru || "").replace(/"/g, '""')}"`,
      `"${(item.kategori || "").replace(/"/g, '""')}"`,
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
  kategoriInput.value = item.kategori;
  pesilatInput.value = item.pesilat;
  catatanInput.value = item.catatan || "";

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
