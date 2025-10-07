        let db;
        const dbName = 'DataWarungDB';
        let keranjang = [];
        let riwayat = [];
        let barangList = [];
        let scanner;
        let charts = {}; // Store Chart.js instances
        let isScanning = false;
        let lastScannedBarcode = '';

        // Initialize IndexedDB
        function initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName, 1);
                request.onerror = () => reject('DB error');
                request.onsuccess = () => {
                    db = request.result;
                    resolve();
                };
                request.onupgradeneeded = (event) => {
                    db = event.target.result;
                    db.createObjectStore('barang', { keyPath: 'nama' });
                    db.createObjectStore('riwayat', { autoIncrement: true });
                };
            });
        }

        async function loadAll() {
            try {
                await initDB();
                await Promise.all([loadBarang(), loadRiwayat(), loadCatatan()]);
                switchSection(localStorage.getItem('activeSection') || 'penjualan');
                switchSubManajemen(localStorage.getItem('activeSubManajemen') || 'tambah-barang');
                updateStatistik();
                updateStokWarning();
                loadMetaList();
                updateStorageInfo();
                loadSavedTheme();
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Gagal memuat data. Silakan coba lagi.');
            }
        }

        async function loadBarang() {
            if (!db) throw new Error('Database not initialized');
            const tx = db.transaction('barang', 'readonly');
            const store = tx.objectStore('barang');
            const req = store.getAll();
            return new Promise((resolve) => {
                req.onsuccess = () => {
                    barangList = req.result;
                    updateDatalist();
                    updateStokWarning();
                    resolve();
                };
            });
        }

        async function loadRiwayat() {
            if (!db) throw new Error('Database not initialized');
            const tx = db.transaction('riwayat', 'readonly');
            const store = tx.objectStore('riwayat');
            const req = store.getAll();
            return new Promise((resolve) => {
                req.onsuccess = () => {
                    riwayat = req.result;
                    updateRiwayatList();
                    resolve();
                };
            });
        }

        function updateDatalist() {
            const datalist = document.getElementById('barang-list');
            datalist.innerHTML = '';
            barangList.forEach(b => {
                const option = document.createElement('option');
                option.value = b.nama;
                datalist.appendChild(option);
            });
        }

        function formatRupiah(input) {
            let value = input.value.replace(/\D/g, '');
            value = parseInt(value) || 0;
            input.value = value.toLocaleString('id-ID');
        }

        function unformatRupiah(str) {
            return parseInt(str.replace(/\./g, '')) || 0;
        }

        function toggleDropdown() {
            const dropdown = document.getElementById('dropdown-menu');
            const toggleBtn = document.querySelector('.dropdown-toggle');
            dropdown.classList.toggle('show');
            toggleBtn.classList.toggle('rotate');
        }

        // Tutup dropdown ketika klik di luar
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('dropdown-menu');
            const toggleBtn = document.querySelector('.dropdown-toggle');
            
            if (!toggleBtn.contains(event.target) && !dropdown.contains(event.target)) {
                dropdown.classList.remove('show');
                toggleBtn.classList.remove('rotate');
            }
        });

        function switchSection(id) {
            document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            localStorage.setItem('activeSection', id);
            
            // Update statistik dan storage info saat beralih ke section tersebut
            if (id === 'statistik') {
                updateStatistik();
            } else if (id === 'storage') {
                updateStorageInfo();
            }
            
            // Tutup dropdown setelah memilih section
            document.getElementById('dropdown-menu').classList.remove('show');
            document.querySelector('.dropdown-toggle').classList.remove('rotate');
        }

        function switchSubManajemen(id) {
            document.querySelectorAll('#manajemen > div').forEach(d => d.style.display = 'none');
            document.getElementById(id).style.display = 'block';
            localStorage.setItem('activeSubManajemen', id);
        }

        async function tambahBarangBaru() {
            if (!db) return alert('Database belum siap');
            const nama = document.getElementById('nama-baru').value;
            const harga = unformatRupiah(document.getElementById('harga-baru').value);
            const stok = parseInt(document.getElementById('stok-awal').value) || 0;
            const barcode = document.getElementById('barcode-baru').value;
            if (!nama || harga <= 0) return alert('Nama dan harga wajib');
            const tx = db.transaction('barang', 'readwrite');
            const store = tx.objectStore('barang');
            store.put({ nama, harga, stok, barcode });
            await new Promise(resolve => tx.oncomplete = resolve);
            await loadBarang();
            // Reset form
            document.getElementById('nama-baru').value = '';
            document.getElementById('harga-baru').value = '';
            document.getElementById('stok-awal').value = '';
            document.getElementById('barcode-baru').value = '';
            alert('Barang ditambahkan');
        }
        
        async function updateStok() {
            if (!db) return alert('Database belum siap');
            const nama = document.getElementById('nama-update-stok').value;
            const delta = parseInt(document.getElementById('update-stok-val').value) || 0;
            const barang = barangList.find(b => b.nama === nama);
            if (!barang) return alert('Barang tidak ditemukan');
            barang.stok += delta;
            const tx = db.transaction('barang', 'readwrite');
            const store = tx.objectStore('barang');
            store.put(barang);
            await new Promise(resolve => tx.oncomplete = resolve);
            await loadBarang();
            // Reset form
            document.getElementById('nama-update-stok').value = '';
            document.getElementById('update-stok-val').value = '';
            alert('Stok telah di Update');
        }
        
        async function updateHarga() {
            if (!db) return alert('Database belum siap');
            const nama = document.getElementById('nama-update-harga').value;
            const harga = unformatRupiah(document.getElementById('harga-baru-update').value);
            const barang = barangList.find(b => b.nama === nama);
            if (!barang || harga <= 0) return alert('Barang atau harga invalid');
            barang.harga = harga;
            const tx = db.transaction('barang', 'readwrite');
            const store = tx.objectStore('barang');
            store.put(barang);
            await new Promise(resolve => tx.oncomplete = resolve);
            await loadBarang();
            // Reset form
            document.getElementById('nama-update-harga').value = '';
            document.getElementById('harga-baru-update').value = '';
            alert('Harga telah di Update');
        }
        
        async function tambahBarcode() {
            if (!db) return alert('Database belum siap');
            const nama = document.getElementById('nama-tambah-barcode').value;
            const barcode = document.getElementById('barcode-tambah').value;
            const barang = barangList.find(b => b.nama === nama);
            if (!barang || !barcode) return alert('Barang atau barcode invalid');
            barang.barcode = barcode;
            const tx = db.transaction('barang', 'readwrite');
            const store = tx.objectStore('barang');
            store.put(barang);
            await new Promise(resolve => tx.oncomplete = resolve);
            await loadBarang();
            // Reset form
            document.getElementById('nama-tambah-barcode').value = '';
            document.getElementById('barcode-tambah').value = '';
            alert('Barcode ditambahkan');
        }

        function cariBarang() {
          const query = document.getElementById('search-nama').value.toLowerCase();
          const tbody = document.querySelector('#search-result tbody');
          tbody.innerHTML = '';
        
          barangList
            .filter(b => b.nama.toLowerCase().includes(query))
            .forEach(b => {
              const tr = document.createElement('tr');
        
              tr.innerHTML = `
                <td>${b.nama}</td>
                <td>${b.harga.toLocaleString('id-ID')}</td>
                <td>${b.stok}</td>
        
                <!-- Kolom Jumlah dengan tombol − / + -->
                <td>
                  <div class="qty-control">
                    <button class="btn-qty" onclick="ubahQty(this,-1)">−</button>
                    <span class="qty-val">1</span>
                    <button class="btn-qty" onclick="ubahQty(this,1)">+</button>
                  </div>
                </td>
        
                <!-- Tombol Tambah ke Keranjang -->
                <td>
                  <button onclick="tambahKeKeranjang('${b.nama}', getQty(this))">
                    <i class="fas fa-cart-plus"></i></button>
                </td>
              `;
        
              tbody.appendChild(tr);
            });
        }
        
        /* ---------- helper ---------- */
        function ubahQty(btn, delta) {
          const span = btn.parentElement.querySelector('.qty-val');
          let val = parseInt(span.textContent) || 1;
          val += delta;
          if (val < 1) val = 1;
          span.textContent = val;
        }
        
        function getQty(btn) {
          // btn = tombol Tambah; naik 2 level <tr>, lalu cari .qty-val
          return parseInt(btn.closest('tr').querySelector('.qty-val').textContent) || 1;
        }


        async function tambahKeKeranjang(nama, jumlah) {
            if (!db) return alert('Database belum siap');
            jumlah = parseInt(jumlah) || 1;
            const barang = barangList.find(b => b.nama === nama);
            if (!barang || barang.stok < jumlah) return alert('Stok tidak cukup');
            const existing = keranjang.find(k => k.nama === nama);
            if (existing) {
                existing.jumlah += jumlah;
                existing.total += barang.harga * jumlah;
            } else {
                keranjang.push({ nama, harga: barang.harga, jumlah, total: barang.harga * jumlah });
            }
            //barang.stok -= jumlah;
            updateKeranjangTable();
            //cariBarang();
            //await simpanRiwayat({ nama, jumlah, harga: barang.harga });
            //await updateStokDB(barang);
            alert(`${barang.nama} ditambahkan ke keranjang`);
        }

        async function updateStokDB(barang) {
            if (!db) return alert('Database belum siap');
            const tx = db.transaction('barang', 'readwrite');
            const store = tx.objectStore('barang');
            store.put(barang);
            await new Promise(resolve => tx.oncomplete = resolve);
            updateStokWarning();
        }

        function hapusDariKeranjang(index) {
            if (confirm('Hapus item dari keranjang?')) {
                const item = keranjang.splice(index, 1)[0];
                const barang = barangList.find(b => b.nama === item.nama);
                //barang.stok += item.jumlah;
                updateKeranjangTable();
                updateStokDB(barang);
            }
        }

        function updateKeranjangTable() {
            const tbody = document.querySelector('#keranjang tbody');
            tbody.innerHTML = '';
            let total = 0;
            keranjang.forEach((k, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${k.nama}</td>
                    <td>${k.harga.toLocaleString('id-ID')}</td>
                    <td>${k.jumlah}</td>
                    <td>${k.total.toLocaleString('id-ID')}</td>
                    <td><button onclick="hapusDariKeranjang(${i})"><i class="fas fa-trash"></i></button></td>
                `;
                tbody.appendChild(tr);
                total += k.total;
            });
            document.getElementById('total-harga').textContent = total.toLocaleString('id-ID');
            
              // aktifkan/nonaktifkan tombol
            const adaIsi = keranjang.length > 0;
            document.getElementById('btn-bayar').disabled = !adaIsi;
            document.getElementById('btn-batal').disabled  = !adaIsi;
            hitungKembalian();
        }

        async function simpanRiwayat(item) {
            if (!db) return alert('Database belum siap');
            const timestamp = new Date();
            const existing = riwayat.find(r => r.timestamp.toISOString().slice(0,10) === timestamp.toISOString().slice(0,10) && r.items.some(i => i.nama === item.nama));
            if (existing) {
                const exItem = existing.items.find(i => i.nama === item.nama);
                exItem.jumlah += item.jumlah;
                exItem.total += item.harga * item.jumlah;
                existing.total += item.harga * item.jumlah;
            } else {
                riwayat.push({ timestamp, items: [{...item, total: item.harga * item.jumlah}], total: item.harga * item.jumlah });
            }
            const tx = db.transaction('riwayat', 'readwrite');
            const store = tx.objectStore('riwayat');
            store.clear();
            riwayat.forEach(r => store.add(r));
            await new Promise(resolve => tx.oncomplete = resolve);
            updateRiwayatList();
        }

        function updateRiwayatList() {
            const ul = document.getElementById('riwayat-list');
            ul.innerHTML = '';
            riwayat.slice(-100).forEach(r => {
                r.items.forEach(i => {
                    const li = document.createElement('li');
                    li.textContent = `${i.nama} ${i.jumlah}x = ${i.total.toLocaleString('id-ID')}`;
                    ul.appendChild(li);
                });
            });
            updateStatistik();
        }

        function hitungKembalian() {
            const total = unformatRupiah(document.getElementById('total-harga').textContent);
            const bayar = unformatRupiah(document.getElementById('nominal-pembeli').value);
            const kembalian = bayar - total;
            const span = document.getElementById('kembalian');
            if (kembalian > 0) span.textContent = kembalian.toLocaleString('id-ID');
            else if (kembalian === 0) span.textContent = 'Uang pas';
            else span.textContent = `Uang kurang ${Math.abs(kembalian).toLocaleString('id-ID')}`;
        }

        async function bayarTransaksi() {
          if (keranjang.length === 0) return;

          const total = keranjang.reduce((sum, k) => sum + k.total, 0);
          const bayar = unformatRupiah(document.getElementById('nominal-pembeli').value) || 0;
          
          if (bayar <= 0) {
              alert('Masukkan nominal pembayaran');
              return;
          }
  
          if (!confirm('Yakin ingin menyelesaikan transaksi ini?')) return;
  
          // 1. Kurangi stok di DB & IndexedDB
          for (const item of keranjang) {
            const barang = barangList.find(b => b.nama === item.nama);
            if (!barang) continue;
            barang.stok -= item.jumlah;          // local var
            await updateStokDB(barang);          // IndexedDB
          }
        
          // 2. Catat riwayat (baru sekarang)
          const copyItems = keranjang.map(k => ({ nama: k.nama, jumlah: k.jumlah, harga: k.harga }));
          for (const it of copyItems) await simpanRiwayat(it);
        
          // 3. Cetak / export opsional
          const wantPrint = confirm('Cetak struk sekarang?');
          if (wantPrint) {
            // panggil fungsi cetak yang sudah ada
            await cetakStrukBluetoothLangsung();
          }
        
          // 4. Kosongkan keranjang
          keranjang = [];
          updateKeranjangTable();
          document.getElementById('nominal-pembeli').value = '';
          hitungKembalian();
        
          // 5. Refresh tabel pencarian (stok baru)
          //cariBarang();
          alert('Transaksi berhasil!');
        }

        function batalTransaksi() {
          if (keranjang.length === 0) return;
          if (!confirm('Batalkan transaksi ini?')) return;
        
          // cukup buang keranjang; stok & riwayat tidak tersentuh
          keranjang = [];
          updateKeranjangTable();
          document.getElementById('nominal-pembeli').value = '';
          hitungKembalian();
        }

        function startScanner() {
            const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0, facingMode: 'environment', disableFlip: false };
            scanner = new Html5Qrcode('scanner-container');
            scanner.start({ facingMode: 'environment' }, config, onScanSuccess)
                .then(() => {
                    // Tampilkan tombol tutup scanner
                    document.getElementById('tutup-scanner').style.display = 'block';
                    // Sembunyikan tombol start scanner
                    document.querySelector('button[onclick="startScanner()"]').style.display = 'none';
                })
                .catch(err => {
                    console.error('Gagal memulai scanner:', err);
                    alert('Gagal memulai scanner. Pastikan izin kamera diberikan.');
                });
        }
        
        function stopScanner() {
            if (scanner) {
                scanner.stop()
                    .then(() => {
                        scanner.clear();
                        // Sembunyikan tombol tutup scanner
                        document.getElementById('tutup-scanner').style.display = 'none';
                        // Tampilkan kembali tombol start scanner
                        document.querySelector('button[onclick="startScanner()"]').style.display = 'block';
                        isScanning = false; // Reset flag
                    })
                    .catch(err => {
                        console.error('Gagal menutup scanner:', err);
                        alert('Gagal menutup scanner.');
                    });
            }
        }
        
        async function onScanSuccess(decodedText) {
          if (isScanning) return;
          isScanning = true;
        
          const hits = barangList.filter(b => b.barcode === decodedText);
        
          if (hits.length === 0) {
            // Barcode belum terdaftar → modal tambah baru
            lastScannedBarcode = decodedText;
            document.getElementById('barcode-terdeteksi').textContent = decodedText;
            document.getElementById('modal-tambah-barang').style.display = 'flex';
          } else if (hits.length === 1) {
            // Cuma 1 varian → langsung masuk keranjang
            await tambahKeKeranjang(hits[0].nama, 1);
            //alert(`${hits[0].nama} ditambahkan`);
          } else {
            // >1 varian ←↑↓→ modal pilihan 
            bukaVarian(hits);
          }
        
          setTimeout(() => { isScanning = false; }, 2000);
        }

        function closeModal() {
            document.getElementById('modal-tambah-barang').style.display = 'none';
        }

        let varianHits = []; 
        
        /* buka modal + isi tombol */
        function bukaVarian(hits) {
          varianHits = hits;
          const listEl = document.getElementById('varian-list');
          listEl.innerHTML = ''; // kosongkan
        
          hits.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'btn-varian';
            btn.textContent = `${b.nama} - Rp ${b.harga.toLocaleString('id-ID')}`;
            btn.onclick = () => pilihVarian(b.nama);
            listEl.appendChild(btn);
          });
        
          document.getElementById('modal-varian').style.display = 'flex';
        }
        
        /* tutup modal */
        function tutupVarian() {
          document.getElementById('modal-varian').style.display = 'none';
          isScanning = false; // lepas flag
        }
        
        /* pilih varian → masuk keranjang */
        function pilihVarian(nama) {
          tutupVarian();
          tambahKeKeranjang(nama, 1);
        }

        async function tambahBarangDariBarcode() {
            const nama = document.getElementById('modal-nama').value;
            const harga = unformatRupiah(document.getElementById('modal-harga').value);
            const stok = parseInt(document.getElementById('modal-stok').value) || 0;
            
            if (!nama || harga <= 0) return alert('Nama dan harga wajib');
            
            if (!db) return alert('Database belum siap');
            const tx = db.transaction('barang', 'readwrite');
            const store = tx.objectStore('barang');
            store.put({ nama, harga, stok, barcode: lastScannedBarcode });
            await new Promise(resolve => tx.oncomplete = resolve);
            await loadBarang();
            
            // Reset form modal
            document.getElementById('modal-nama').value = '';
            document.getElementById('modal-harga').value = '';
            document.getElementById('modal-stok').value = '';
            closeModal();
            
            alert('Barang berhasil ditambahkan');
            // Hapus baris yang menambahkan ke keranjang
            // await tambahKeKeranjang(nama, 1);  // DIHAPUS
        }

        function destroyCharts() {
            Object.values(charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            charts = {};
        }

        function updateStatistik() {
            destroyCharts(); // Destroy existing charts
            const monthlyOmset = {};
            const monthlyLaba = {};
            const currentMonth = new Date().toISOString().slice(0,7);
            const topThisMonth = {};

            riwayat.forEach(r => {
                const month = r.timestamp.toISOString().slice(0,7);
                monthlyOmset[month] = (monthlyOmset[month] || 0) + r.total;
                monthlyLaba[month] = monthlyOmset[month] * 0.1;
                if (month === currentMonth) {
                    r.items.forEach(i => {
                        topThisMonth[i.nama] = (topThisMonth[i.nama] || 0) + i.jumlah;
                    });
                }
            });

            const omsetLabels = Object.keys(monthlyOmset);
            charts['omset'] = new Chart(document.getElementById('omset-chart'), {
                type: 'bar',
                data: { labels: omsetLabels, datasets: [{ label: 'Omset', data: Object.values(monthlyOmset), backgroundColor: '#4caf50' }] }
            });

            const topSorted = Object.entries(topThisMonth).sort((a,b) => b[1] - a[1]).slice(0,10);
            charts['top-barang'] = new Chart(document.getElementById('top-barang-chart'), {
                type: 'doughnut',
                data: { labels: topSorted.map(t => t[0]), datasets: [{ data: topSorted.map(t => t[1]), backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf', '#f7786b', '#6b7280'] }] }
            });

            charts['laba'] = new Chart(document.getElementById('laba-chart'), {
                type: 'bar',
                data: { labels: omsetLabels, datasets: [{ label: 'Laba', data: Object.values(monthlyLaba), backgroundColor: '#2196f3' }] }
            });
        }

        let bluetoothDevice = null;
        let bluetoothCharacteristic = null;
        
        async function connectBluetoothPrinter() {
            try {
                if (bluetoothDevice && bluetoothDevice.gatt.connected) {
                    alert('Printer sudah terhubung! ✅');
                    return true;
                }
        
                alert('Mencari printer Bluetooth...');
                
                const device = await navigator.bluetooth.requestDevice({
                    filters: [
                        { namePrefix: 'TP-' },
                        { namePrefix: 'BT-' },
                        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }
                    ]
                });
        
                alert(`Menghubungkan ke ${device.name}...`);
                
                const server = await device.gatt.connect();
                const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
                const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
                
                bluetoothDevice = device;
                bluetoothCharacteristic = characteristic;
                
                device.addEventListener('gattserverdisconnected', onDisconnected);
                
                alert(`✅ Berhasil terhubung ke ${device.name}!`);
                updatePrintButton();
                
                return true;
            } catch (error) {
                console.error('Connection error:', error);
                alert('❌ Gagal connect: ' + error.message);
                return false;
            }
        }
        
        function updateBluetoothStatus() {
            const statusElement = document.getElementById('bluetooth-status');
            const btnPrint = document.getElementById('btn-print-bluetooth');
            
            if (bluetoothDevice && bluetoothDevice.gatt.connected) {
                statusElement.className = 'bluetooth-status bluetooth-connected';
                statusElement.innerHTML = `<i class="fas fa-bluetooth"></i> Printer: Terhubung ke ${bluetoothDevice.name}`;
                btnPrint.disabled = false;
            } else {
                statusElement.className = 'bluetooth-status bluetooth-disconnected';
                statusElement.innerHTML = '<i class="fas fa-bluetooth"></i> Printer: Tidak Terhubung';
                btnPrint.disabled = true;
            }
        }
        
        // Panggil fungsi ini setelah connect/disconnect
        function onDisconnected() {
            bluetoothDevice = null;
            bluetoothCharacteristic = null;
            alert('Printer terputus!');
            updateBluetoothStatus();
        }

        async function sendToPrinter(data) {
            const MAX_CHUNK_SIZE = 512; // Batasan Bluetooth
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(data);
            
            for (let i = 0; i < encodedData.length; i += MAX_CHUNK_SIZE) {
                const chunk = encodedData.slice(i, i + MAX_CHUNK_SIZE);
                await bluetoothCharacteristic.writeValue(chunk);
                
                // Tunggu sebentar antara chunk
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        async function cetakStrukBluetoothLangsung() {
    // Validasi keranjang kosong
            if (keranjang.length === 0) {
                alert('❌ Keranjang belanja kosong! Tambah barang dulu.');
                return;
            }
        
            // Validasi nominal pembayaran
            const total = keranjang.reduce((sum, k) => sum + k.total, 0);
            const bayar = unformatRupiah(document.getElementById('nominal-pembeli').value) || 0;
            
            if (bayar < total) {
                alert('❌ Nominal pembayaran kurang!');
                return;
            }
        
            try {
                if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
                    const connected = await connectBluetoothPrinter();
                    if (!connected) return;
                }
        
                alert('🖨️ Mencetak struk...');
                const strukContent = formatStrukUntukPrinter();
                await sendToPrinter(strukContent);
                
                alert('✅ Struk berhasil dicetak!');
                
            } catch (error) {
                console.error('Print error:', error);
                alert('❌ Gagal cetak: ' + error.message);
            }
        }

        function updatePrintButton() {
            const btnPrint = document.getElementById('btn-print');
            btnPrint.disabled = !(bluetoothDevice && bluetoothDevice.gatt.connected);
        }

        function formatStrukUntukPrinter() {
            let struk = '';
            
            // ESC/POS commands
            struk += '\x1B\x40'; // Initialize printer
            struk += '\x1B\x61\x01'; // Center alignment
            
            // Header
            struk += '==============================\n';
            struk += '       WARUNG AL SAKHO       \n';
            struk += ' Bayalangu Kidul, Kab. Cirebon \n';
            struk += '==============================\n\n';
            
            struk += '\x1B\x61\x00'; // Left alignment
            struk += 'BARANG BELANJA:\n';
            struk += '------------------------------\n';
            
            // Items
            keranjang.forEach(k => {
                const nama = k.nama.length > 20 ? k.nama.substring(0, 17) + '...' : k.nama;
                struk += `${k.jumlah}x ${nama}\n`;
                struk += `  @${k.harga.toLocaleString('id-ID')} = ${k.total.toLocaleString('id-ID')}\n`;
            });
            
            // Total
            const total = keranjang.reduce((sum, k) => sum + k.total, 0);
            const bayar = unformatRupiah(document.getElementById('nominal-pembeli').value) || 0;
            const kembalian = bayar - total;
            
            struk += '------------------------------\n';
            struk += `TOTAL     : Rp ${total.toLocaleString('id-ID')}\n`;
            struk += `BAYAR     : Rp ${bayar.toLocaleString('id-ID')}\n`;
            struk += `KEMBALIAN : Rp ${kembalian.toLocaleString('id-ID')}\n`;
            struk += '==============================\n\n';
            
            struk += '\x1B\x61\x01'; // Center alignment
            struk += 'Terima kasih!\n';
            
            // TAMBAHAN: Enter 3 kali untuk jarak dengan kertas berikutnya
            struk += '\n\n\n\n\n';
            
            // Paper cut (jika supported)
            struk += '\x1B\x69';
            
            return struk;
        }

        function exportToWA() {
            let text = 'WARUNG AL SAKHO\nBayalangu Kidul, Kab. Cirebon\n\nBARANG BELANJA\n';
            keranjang.forEach(k => {
                text += `${k.nama} ${k.jumlah}x = ${k.total.toLocaleString('id-ID')}\n`;
            });
            const total = keranjang.reduce((sum, k) => sum + k.total, 0);
            text += `\nTOTAL: Rp${total.toLocaleString('id-ID')}\nLABA BERSIH (10%): Rp${(total * 0.1).toLocaleString('id-ID')}`;
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url);
        }

        async function backupJSON() {
            if (!db) return alert('Database belum siap');
            const data = { barang: barangList, riwayat: riwayat };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'backupToko.json';
            a.click();
        }

        async function backupTXT() {
            if (!db) return alert('Database belum siap');
            let text = 'BARANG:\n';
            barangList.forEach(b => {
                text += `${b.nama} - Harga: ${b.harga.toLocaleString('id-ID')} - Stok: ${b.stok} - Barcode: ${b.barcode || ''}\n`;
            });
            text += '\nRIWAYAT:\n';
            riwayat.forEach(r => {
                r.items.forEach(i => {
                    text += `${i.nama} ${i.jumlah}x = ${i.total.toLocaleString('id-ID')}\n`;
                });
            });
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'backupToko.txt';
            a.click();
        }

        async function backupCSV() {
            if (!db) return alert('Database belum siap');
            let csv = 'Type,Nama,Harga,Stok,Barcode,Jumlah,Total,Timestamp\n';
            barangList.forEach(b => {
                csv += `Barang,${b.nama},${b.harga},${b.stok},${b.barcode || ''},,,\n`;
            });
            riwayat.forEach(r => {
                r.items.forEach(i => {
                    csv += `Riwayat,${i.nama},${i.harga},,${i.jumlah},${i.total},${r.timestamp}\n`;
                });
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'backupToko.csv';
            a.click();
        }

        async function restoreJSON() {
            if (!db) return alert('Database belum siap');
            const file = document.getElementById('restore-file').files[0];
            if (!file) return alert('Pilih file JSON terlebih dahulu');
            
            if (!confirm('⚠️ PERINGATAN: Restore data akan MENGGANTI SEMUA DATA YANG ADA dengan data dari backup. Data lama akan hilang permanen. Lanjutkan?')) {
              return;
            }
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Validasi data
                    if (!data.barang || !Array.isArray(data.barang)) {
                        throw new Error('Data barang tidak valid atau tidak ditemukan');
                    }
                    // Proses riwayat, jika ada
                    const riwayatData = data.riwayat && Array.isArray(data.riwayat)
                        ? data.riwayat.map(r => ({
                            ...r,
                            timestamp: new Date(r.timestamp), // Konversi string ke Date
                            items: Array.isArray(r.items) ? r.items : []
                        }))
                        : [];
                    const tx = db.transaction(['barang', 'riwayat'], 'readwrite');
                    const barangStore = tx.objectStore('barang');
                    const riwayatStore = tx.objectStore('riwayat');
                    barangStore.clear();
                    riwayatStore.clear();
                    data.barang.forEach(b => barangStore.add(b));
                    riwayatData.forEach(r => riwayatStore.add(r));
                    await new Promise(resolve => tx.oncomplete = resolve);
                    await loadAll();
                    alert('Data berhasil direstore');
                } catch (error) {
                    console.error('Restore error:', error);
                    alert(`Gagal merestore data: ${error.message}`);
                }
            };
            reader.readAsText(file);
        }

        function simpanCatatan() {
            const text = document.getElementById('catatan-text').value;
            localStorage.setItem('catatan', text);
            alert('Catatan disimpan');
        }

        function loadCatatan() {
            document.getElementById('catatan-text').value = localStorage.getItem('catatan') || '';
        }

        async function updateStorageInfo() {
            // Hitung jumlah data
            const jumlahBarang = barangList.length;
            const jumlahRiwayat = riwayat.reduce((sum, r) => sum + r.items.length, 0);
            const totalData = jumlahBarang + jumlahRiwayat;
            
            // Update tampilan
            document.getElementById('jumlah-barang').textContent = jumlahBarang;
            document.getElementById('jumlah-riwayat').textContent = jumlahRiwayat;
            document.getElementById('total-data').textContent = totalData;
            
            // Hitung estimasi penggunaan storage (dalam KB)
            const barangSize = JSON.stringify(barangList).length / 1024;
            const riwayatSize = JSON.stringify(riwayat).length / 1024;
            const totalSize = barangSize + riwayatSize;
            
            // Tampilkan informasi
            document.getElementById('storage-info').textContent = 
                `Total penggunaan: ${totalSize.toFixed(2)} KB (Barang: ${barangSize.toFixed(2)} KB, Riwayat: ${riwayatSize.toFixed(2)} KB)`;
            
            // Update progress bar (asumsi batas 10MB)
            const maxSize = 10 * 1024; // 10MB dalam KB
            const progressPercent = Math.min((totalSize / maxSize) * 100, 100);
            document.getElementById('storage-progress').style.width = `${progressPercent}%`;
        }

        /* ---------- REKAM PENDAPATAN HARIAN ---------- */
        const LS_REKAM_KEY = 'rekam_harian_aktif';
        const LS_DATA_KEY  = 'rekam_harian_data';   // { tgl, items:{nama: {jumlah, total}} }
        
        // cek status awal (page reload)
        document.addEventListener('DOMContentLoaded', () => {
          const aktif = localStorage.getItem(LS_REKAM_KEY) === '1';
          document.getElementById('toggle-rekam').checked = aktif;
          updateUIRekam(aktif);
          // kalau ganti hari → reset otomatis
          const tglSekarang = new Date().toDateString();
          const data = JSON.parse(localStorage.getItem(LS_DATA_KEY) || '{}');
          if (data.tgl !== tglSekarang) resetRekamHarian();
        });
        
        // listener toggle ON/OFF
        document.getElementById('toggle-rekam').addEventListener('change', e => {
          const aktif = e.target.checked;
          localStorage.setItem(LS_REKAM_KEY, aktif ? '1' : '0');
  
          if (aktif) {
            if (!confirm('Aktifkan rekaman pendapatan harian? Data hari sebelumnya akan direset.')) {
              e.target.checked = false;
              return;
            }
            resetRekamHarian();
          }
          
          localStorage.setItem(LS_REKAM_KEY, aktif ? '1' : '0');
          updateUIRekam(aktif);
        });
        
        function updateUIRekam(aktif) {
          document.getElementById('rekam-status').textContent = aktif ? 'Aktif' : 'Non-aktif';
          document.getElementById('btn-lihat-laporan').style.display = aktif ? 'inline-block' : 'none';
        }
        
        function resetRekamHarian() {
          localStorage.setItem(LS_DATA_KEY, JSON.stringify({
            tgl: new Date().toDateString(),
            items: {}   // {nama: {jumlah, total}}
          }));
        }
        
        // ------- core: pencatatan setiap transaksi -------
        // kita hijack fungsi simpanRiwayat() yang sudah ada
        const _simpanRiwayatOriginal = simpanRiwayat;
        simpanRiwayat = async function(item) {
          // panggil fungsi lama dulu
          await _simpanRiwayatOriginal.call(this, item);
        
          // baru catat kalau mode rekam aktif
          if (localStorage.getItem(LS_REKAM_KEY) !== '1') return;
        
          const data = JSON.parse(localStorage.getItem(LS_DATA_KEY) || '{}');
          // skip kalau tgl beda (hari berganti)
          if (data.tgl !== new Date().toDateString()) return;
        
          if (!data.items) data.items = {};
          const rec = data.items[item.nama] || { jumlah: 0, total: 0 };
          rec.jumlah += item.jumlah;
          rec.total  += item.harga * item.jumlah;
          data.items[item.nama] = rec;
        
          localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
        };
        
        // ------- tampilkan laporan -------
        function tampilkanLaporanHarian() {
          const data = JSON.parse(localStorage.getItem(LS_DATA_KEY) || '{}');
          const items = data.items || {};
          let tot = 0;
          for (const nama in items) tot += items[nama].total;
        
          document.getElementById('laporan-tanggal').textContent = new Date().toLocaleDateString('id-ID');
          document.getElementById('total-pendapatan').textContent = tot.toLocaleString('id-ID');
          document.getElementById('laba-harian').textContent = (tot * 0.1).toLocaleString('id-ID');
        
          // list barang
          const ul = document.getElementById('daftar-barang-terjual');
          ul.innerHTML = '';
          for (const nama in items) {
            const li = document.createElement('li');
            li.textContent = `${nama}  →  ${items[nama].jumlah} pcs  (Rp ${items[nama].total.toLocaleString('id-ID')})`;
            ul.appendChild(li);
          }
        
          // tampilkan modal
          document.getElementById('popup-laporan').style.display = 'flex';
          console.log(data);
        }
        
        function tutupLaporan() {
          document.getElementById('popup-laporan').style.display = 'none';
        }

        let stokWarningItems = [];
        let restockItems = [];
        let selectedRestockItems = [];
        
        // Fungsi untuk update daftar restock
        function updateRestockList() {
            restockItems = barangList.filter(barang => barang.stok <= 2);
            
            const restockList = document.getElementById('restock-list');
            restockList.innerHTML = '';
            
            if (restockItems.length === 0) {
                restockList.innerHTML = '<div class="restock-item" style="justify-content: center; background: #e8f5e9;">🎉 Tidak ada barang yang perlu restock segera!</div>';
                updateRestockTotal();
                return;
            }
            
            restockItems.sort((a, b) => a.stok - b.stok).forEach((barang, index) => {
                const restockItem = document.createElement('div');
                restockItem.className = 'restock-item';
                restockItem.innerHTML = `
                    <input type="checkbox" class="restock-checkbox" id="restock-${index}" 
                           onchange="toggleRestockItem(${index}, this)">
                    
                    <div class="restock-details">
                        <div class="restock-info-left">
                            <span class="restock-nama">${barang.nama}</span>
                            <span class="restock-stok">Stok saat ini: ${barang.stok} pcs</span>
                        </div>
                        
                        <div class="restock-controls">
                            <div class="restock-qty">
                                <input type="number" id="qty-${index}" value="10" min="1" max="100" 
                                       onchange="updateRestockSubtotal(${index})" oninput="updateRestockSubtotal(${index})">
                            </div>
                            
                            <div class="restock-harga">
                                Rp ${barang.harga.toLocaleString('id-ID')}
                            </div>
                            
                            <div class="restock-subtotal" id="subtotal-${index}">
                                Rp ${(barang.harga * 10).toLocaleString('id-ID')}
                            </div>
                        </div>
                    </div>
                `;
                
                restockList.appendChild(restockItem);
            });
            
            updateRestockTotal();
        }
        
        // Fungsi toggle item restock
        function toggleRestockItem(index, checkbox) {
            const barang = restockItems[index];
            const qty = parseInt(document.getElementById(`qty-${index}`).value) || 1;
            const subtotal = barang.harga * qty;
            
            if (checkbox.checked) {
                selectedRestockItems.push({
                    ...barang,
                    restockQty: qty,
                    subtotal: subtotal
                });
                checkbox.parentElement.classList.add('selected');
            } else {
                selectedRestockItems = selectedRestockItems.filter(item => item.nama !== barang.nama);
                checkbox.parentElement.classList.remove('selected');
            }
            
            updateRestockTotal();
        }
        
        // Fungsi update subtotal per item
        function updateRestockSubtotal(index) {
            const barang = restockItems[index];
            const qty = parseInt(document.getElementById(`qty-${index}`).value) || 1;
            const subtotal = barang.harga * qty;
            
            document.getElementById(`subtotal-${index}`).textContent = 
                `Rp ${subtotal.toLocaleString('id-ID')}`;
            
            // Update jika item sudah dipilih
            const existingIndex = selectedRestockItems.findIndex(item => item.nama === barang.nama);
            if (existingIndex !== -1) {
                selectedRestockItems[existingIndex].restockQty = qty;
                selectedRestockItems[existingIndex].subtotal = subtotal;
                updateRestockTotal();
            }
        }
        
        // Fungsi update total restock
        function updateRestockTotal() {
            const total = selectedRestockItems.reduce((sum, item) => sum + item.subtotal, 0);
            document.getElementById('total-restock').textContent = 
                `Rp ${total.toLocaleString('id-ID')}`;
        }
        
        // Update fungsi updateStokWarning untuk panggil restock juga
        function updateStokWarning() {
            stokWarningItems = barangList.filter(barang => barang.stok < 5);
            
            const stokList = document.getElementById('stok-warning-list');
            const alertBadge = document.getElementById('stok-alert-badge');
            
            // Update badge di menu
            if (stokWarningItems.length > 0) {
                alertBadge.textContent = stokWarningItems.length;
                alertBadge.style.display = 'flex';
                
                if (stokWarningItems.length >= 10) {
                    alertBadge.style.animation = 'blinkScale 0.8s infinite';
                }
            } else {
                alertBadge.style.display = 'none';
            }
            
            // Update list stok warning
            stokList.innerHTML = '';
            
            if (stokWarningItems.length === 0) {
                stokList.innerHTML = '<div class="stok-item" style="border-left-color: #4CAF50; background: #e8f5e9;">🎉 Semua stok aman!</div>';
                updateRestockList(); // TAMBAH INI
                return;
            }
            
            stokWarningItems.sort((a, b) => a.stok - b.stok).forEach(barang => {
                const stokItem = document.createElement('div');
                const isDanger = barang.stok <= 2;
                
                stokItem.className = `stok-item ${isDanger ? 'danger' : 'warning'}`;
                stokItem.innerHTML = `
                    <span class="stok-nama">${barang.nama}</span> →
                    <span class="stok-sisa ${isDanger ? 'danger' : 'warning'}">${barang.stok} pcs</span>
                `;
                
                stokList.appendChild(stokItem);
            });
            
            updateRestockList(); // TAMBAH INI - Update restock list juga
        }

        // Fungsi cetak laporan stok + restock
        async function cetakLaporanStokDanRestockBluetooth() {
            if (stokWarningItems.length === 0 && selectedRestockItems.length === 0) {
                alert('Tidak ada data untuk dicetak!');
                return;
            }
            
            try {
                if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
                    const connected = await connectBluetoothPrinter();
                    if (!connected) return;
                }
                
                alert('🖨️ Mencetak laporan stok + daftar restock...');
                const laporanContent = formatLaporanStokDanRestockUntukPrinter();
                await sendToPrinter(laporanContent);
                
                alert('✅ Laporan berhasil dicetak!');
                
            } catch (error) {
                console.error('Print error:', error);
                alert('❌ Gagal cetak laporan: ' + error.message);
            }
        }
        
        // Format laporan stok + restock untuk printer
        function formatLaporanStokDanRestockUntukPrinter() {
            let laporan = '';
            
            // ESC/POS commands
            laporan += '\x1B\x40'; // Initialize printer
            laporan += '\x1B\x61\x01'; // Center alignment
            
            // Header
            laporan += '==============================\n';
            laporan += '   LAPORAN STOK & RESTOCK    \n';
            laporan += '      WARUNG AL SAKHO        \n';
            laporan += '==============================\n\n';
            
            laporan += '\x1B\x61\x00'; // Left alignment
            laporan += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n`;
            laporan += `Waktu: ${new Date().toLocaleTimeString('id-ID')}\n\n`;
            
            // === BAGIAN 1: STOK MAU HABIS ===
            laporan += 'STOK MAU HABIS (< 5):\n';
            laporan += '------------------------------\n';
            
            if (stokWarningItems.length === 0) {
                laporan += 'Tidak ada stok mau habis\n';
            } else {
                stokWarningItems.sort((a, b) => a.stok - b.stok).forEach((barang, index) => {
                    const nomor = (index + 1).toString().padStart(2, ' ');
                    const nama = barang.nama.length > 20 ? barang.nama.substring(0, 17) + '...' : barang.nama;
                    const stok = barang.stok.toString().padStart(2, ' ');
                    
                    laporan += `${nomor}. ${nama}\n`;
                    laporan += `    Sisa: ${stok} pcs\n`;
                    
                    if (barang.stok <= 2) {
                        laporan += ` RESTOCK SEGERA!\n`;
                    }
                    
                    laporan += '\n\n';
                });
            }
            
            laporan += '------------------------------\n\n';
            
            // === BAGIAN 2: DAFTAR RESTOCK ===
            laporan += 'DAFTAR BELANJA RESTOCK:\n';
            laporan += '------------------------------\n';
            
            if (selectedRestockItems.length === 0) {
                laporan += 'Tidak ada barang dipilih\n';
            } else {
                let totalRestock = 0;
                
                selectedRestockItems.forEach((item, index) => {
                    const nomor = (index + 1).toString().padStart(2, ' ');
                    const nama = item.nama.length > 18 ? item.nama.substring(0, 15) + '...' : item.nama;
                    const qty = item.restockQty.toString().padStart(3, ' ');
                    const harga = item.harga.toLocaleString('id-ID');
                    const subtotal = item.subtotal.toLocaleString('id-ID');
                    
                    laporan += `${nomor}. ${nama}\n`;
                    laporan += `    ${qty} x Rp ${harga} = Rp ${subtotal}\n\n`;
                    
                    totalRestock += item.subtotal;
                });
                
                laporan += '------------------------------\n';
                laporan += `TOTAL RESTOCK: Rp ${totalRestock.toLocaleString('id-ID')}\n`;
            }
            
            laporan += '\n==============================\n';
            laporan += 'Catatan:\n';
            laporan += '-Restock barang dengan stok < 2\n';
            laporan += '-Centang barang yang akan dibeli\n\n';
            laporan += '==============================\n\n';
            
            // TAMBAHAN: Enter untuk jarak dengan kertas berikutnya
            laporan += '\n\n\n\n\n';
            
            // Paper cut (jika supported)
            laporan += '\x1B\x69';
            
            return laporan;
        }

        /* ========== META BARANG MANAGEMENT - SIMPLE VERSION ========== */
        let metaList = [];
        
        // Load meta list dari localStorage
        function loadMetaList() {
            try {
                const raw = localStorage.getItem('metaList');
                metaList = raw ? JSON.parse(raw) : [];
                console.log('Meta list loaded:', metaList.length, 'items');
            } catch (error) {
                console.error('Error loading meta list:', error);
                metaList = [];
            }
        }
        
        // Simpan meta list ke localStorage
        function simpanMetaList() {
            try {
                localStorage.setItem('metaList', JSON.stringify(metaList));
            } catch (error) {
                console.error('Error saving meta list:', error);
                alert('Gagal menyimpan daftar favorit');
            }
        }
        
        // Buka modal meta
        function bukaModalMeta() {
            loadMetaList();
            isiDropdownBarang();
            renderDaftarBarangMeta();
            document.getElementById('modal-meta').style.display = 'flex';
        }
        
        // Tutup modal meta
        function tutupModalMeta() {
            document.getElementById('modal-meta').style.display = 'none';
        }
        
        // Isi dropdown dengan semua barang
        function isiDropdownBarang() {
            const dropdown = document.getElementById('meta-dropdown');
            
            // Simpan selected value
            const selectedValue = dropdown.value;
            
            // Clear existing options except the first one
            dropdown.innerHTML = '<option value="">-- Pilih barang yang sering laku --</option>';
            
            // Add all barang to dropdown
            barangList.forEach(barang => {
                // Skip barang yang sudah ada di meta list
                if (metaList.includes(barang.nama)) return;
                
                const option = document.createElement('option');
                option.value = barang.nama;
                option.textContent = `${barang.nama} - Rp ${barang.harga.toLocaleString('id-ID')}`;
                dropdown.appendChild(option);
            });
            
            // Restore selected value if still exists
            if (selectedValue && dropdown.querySelector(`option[value="${selectedValue}"]`)) {
                dropdown.value = selectedValue;
            }
        }
        
        // Render daftar barang meta
        function renderDaftarBarangMeta() {
            const container = document.getElementById('daftar-barang-meta');
            const jumlahElement = document.getElementById('jumlah-meta');
            
            // Update counter
            jumlahElement.textContent = metaList.length;
            
            if (metaList.length === 0) {
                container.innerHTML = '<div class="meta-empty">Belum ada barang favorit</div>';
                return;
            }
            
            container.innerHTML = '';
            
            metaList.forEach(namaBarang => {
                const barang = barangList.find(b => b.nama === namaBarang);
                if (!barang) return; // Skip jika barang tidak ditemukan
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'meta-item';
                
                itemDiv.innerHTML = `
                    <div class="meta-item-nama">${barang.nama}</div>
                    <div class="meta-item-actions">
                        <button class="meta-btn meta-btn-tambah" onclick="tambahKeKeranjang('${barang.nama}', 1)" title="Tambah ke Keranjang">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                        <button class="meta-btn meta-btn-hapus" onclick="hapusDariMeta('${barang.nama}')" title="Hapus dari Favorit">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                container.appendChild(itemDiv);
            });
        }
        
        // Tambah barang ke meta list dari dropdown
        function tambahKeMeta() {
            const dropdown = document.getElementById('meta-dropdown');
            const namaBarang = dropdown.value;
            
            if (!namaBarang) {
                alert('Pilih barang terlebih dahulu!');
                return;
            }
            
            if (metaList.includes(namaBarang)) {
                alert('Barang sudah ada di daftar favorit!');
                return;
            }
            
            // Tambah ke meta list
            metaList.push(namaBarang);
            simpanMetaList();
            
            // Refresh tampilan
            isiDropdownBarang();
            renderDaftarBarangMeta();
            
            // Reset dropdown
            dropdown.value = '';
            
            // Show success message
            alert(`✅ ${namaBarang} ditambahkan ke favorit!`);
        }
        
        // Hapus barang dari meta list
        function hapusDariMeta(namaBarang) {
            if (!confirm(`Hapus ${namaBarang} dari daftar favorit?`)) return;
            
            metaList = metaList.filter(nama => nama !== namaBarang);
            simpanMetaList();
            
            // Refresh tampilan
            isiDropdownBarang();
            renderDaftarBarangMeta();
            
            alert(`🗑️ ${namaBarang} dihapus dari favorit`);
        }
        
        // Tambah semua barang favorit ke keranjang
        function tambahSemuaKeKeranjang() {
            if (metaList.length === 0) {
                alert('Tidak ada barang favorit!');
                return;
            }
            
            let addedCount = 0;
            
            metaList.forEach(namaBarang => {
                const barang = barangList.find(b => b.nama === namaBarang);
                if (barang && barang.stok > 0) {
                    tambahKeKeranjang(barang.nama, 1);
                    addedCount++;
                }
            });
            
            if (addedCount > 0) {
                alert(`✅ ${addedCount} barang favorit ditambahkan ke keranjang!`);
                tutupModalMeta();
            } else {
                alert('Tidak ada barang favorit yang bisa ditambahkan (stok habis)');
            }
        }
        
        // Initialize saat aplikasi load
        document.addEventListener('DOMContentLoaded', function() {
            loadMetaList();
            console.log('Meta system initialized - Simple version');
        });

        /* ========== VOICE COMMANDS - SIMPLE VERSION ========== */
        let voiceRecognition = null;
        let isListening = false;
        
        // 🎯 VOICE SHORTCUTS
        const voiceShortcuts = {
            // 🖨️ PRINT COMMANDS
            'print': 'printStruk',
            'cetak': 'printStruk',  
            'struk': 'printStruk',
            'print laporan': 'printLaporan',
            'lapor': 'printLaporan',
            // ⚡ ACTION COMMANDS  
            'bayar': 'doBayar',
            'batal': 'doBatal',
            'scan': 'doScan',
            'scan barcode': 'doScan',
            'scanner': 'doScan',
            'meta': 'doFavorit',
            'connect': 'doConnect',
            'back up': 'doBackup',
            // 📱 NAVIGATION COMMANDS
            'barang': 'goManajemen',
            'jual': 'goPenjualan',
            'statistik': 'goStatistik',
            'catat': 'goCatatan',
            'data': 'goBackup',
            'rekam': 'goRekam',
            'simpan': 'goStorage',
            'harian':'goLaporan',
            // 💬 PERCAKAPAN BASIC
            'oke': 'ohThanks',
            'terima kasih': 'ohThanks',
            'terima kasih banyak': 'ohThanks',
            'makasih': 'ohThanks',
            'makasih ya': 'ohThanks',
            'makasih ya udah jadi assisten': 'ohThanks',
            'halo': 'yoHalo',
            'hai': 'yoHalo',
            'hi': 'yoHalo',
            'hello': 'yoHalo',
            'halo bang': 'yoHalo',
            'hi bang': 'yoHalo',
            'hai bang': 'yoHalo',
            'hey bang': 'yoHalo',
            'hello bang': 'yoHalo',
            'assalamualaikum': 'yoSalam',
            'apa kabar': 'yoKabar',
            'apa kabar nih': 'yoKabar',
            'apa kabarmu': 'yoKabar',
            'tampilkan': 'goVoice',
            'jarvis': 'yaSiap',
            // 🔢 MATEMATIKA & KALKULASI
            'hitung': 'doCalculate',
            'kalkulator': 'doCalculate',
            'berapa': 'doCalculate',
            'tambah': 'doCalculate',
            'kurang': 'doCalculate',
            'kali': 'doCalculate',
            'bagi': 'doCalculate',
            'kalkulator ilmiah': 'scientificCalc',
            'hitung kompleks': 'scientificCalc', 
            'hitung rumit': 'scientificCalc',
            'calculator': 'scientificCalc',
            // ℹ️ INFO & BANTUAN
            'siapa kamu': 'whoAreYou',
            'namamu siapa': 'whoAreYou', 
            'kamu siapa': 'whoAreYou',
            'kamu bisa apa': 'imReady',
            'kamu bisa apa aja': 'imReady',
            'warung': 'aboutWarung',
            'toko': 'aboutWarung',
            'bantuan': 'showHelp',
            'help': 'showHelp',
            'i need help': 'showHelp',
            'saya butuh bantuan': 'showHelp',
            'ini jam berapa': 'showTime',
            'ini jam berapa ya': 'showTime',
            'jam berapa sekarang': 'showTime',
            'sekarang jam berapa': 'showTime',
            // 😄 FUN RESPONSES
            'gila': 'funResponse',
            'keren': 'funResponse', 
            'mantap': 'funResponse',
            'wow': 'funResponse',
            'anjay': 'funResponse',
            'cakep': 'funResponse',
            'gila keren banget':'funResponse',
            'mantap banget nih': 'funResponse',
            'wow mantap': 'funResponse',
            'mantap jos': 'funResponse',
            // 🆕 INVENTORY QUERY
            'periksa stok': 'checkStock',
            'inventory': 'checkStock',
            'cek stok': 'checkStock',
            'stok barang': 'checkStock',
            
            // 🆕 FINANCE QUERY
            'omset': 'checkRevenue',
            'cek omset hari ini': 'checkRevenue', 
            'laba': 'checkProfit',
            'laba hari ini': 'checkProfit',
            'keuntungan hari ini': 'checkProfit',
            'finance': 'checkFinance',
            
            // 🆕 SMART SEARCH
            'barang murah': 'searchCheap',
            'barang diskon': 'searchDiscount',
            'barang baru': 'searchNew',
            'barang populer': 'searchPopular',
            
            // 🆕 VOICE REPORTS
            'laporan': 'generateReport',
            'report': 'generateReport',
            'export': 'generateReport',
            
            // 🆕 TUTORIAL MODE
            'tutorial': 'startTutorial',
            'bantu dong': 'startTutorial',
            'cara pakai': 'startTutorial',
            'help': 'startTutorial',
            'chat': 'startChat',
            //Ai Active 🤖
            'halo jarvis': 'startChat',
            'hai jarvis': 'startChat',
            'helo jarvis': 'startChat',
            'bisakah kita ngobrol': 'startChat',
            'hei jarvis': 'startChat',
            //Aturan TEMA
            'tema': 'showThemeSwitcher',
            'ganti tema': 'showThemeSwitcher',
            // 🆕 REKAM PENDAPATAN
            'aktifkan rekam': 'toggleRekam',
            'catat pendapatan': 'toggleRekam',
            'pencatatan': 'toggleRekam',
            // 💡 Tips & Ide bisnis
            'tips bisnis': 'businessTips',
            'cara jualan': 'businessTips',
            'strategi warung': 'businessStrategy',
            'naikkan omset': 'increaseRevenue',
            'profitabilitas': 'businessProfit',
            'restock strategi': 'restockStrategy',
            'analisis pasar': 'marketAnalysis'
        };
        
        // 🎤 START VOICE SEARCH
        function startVoiceSearch() {
          
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
            // Show help alert pertama kali
            if (!localStorage.getItem('voiceHelpShown')) {
                showVoiceHelp();
                localStorage.setItem('voiceHelpShown', 'true');
            }
            
            // Cek browser support
            if (!('webkitSpeechRecognition' in window)) {
                alert('❌ Browser tidak support voice search.\nGunakan Chrome atau Safari untuk fitur ini.');
                return;
            }
            
            initVoiceRecognition();
        }
        
        // 🎙️ INIT VOICE RECOGNITION
        function initVoiceRecognition() {
            voiceRecognition = new webkitSpeechRecognition();
            
            voiceRecognition.lang = 'id-ID';
            voiceRecognition.continuous = false;
            voiceRecognition.interimResults = false;
            
            voiceRecognition.onstart = function() {
                isListening = true;
                showVoiceStatus('listening', '🎤 Dengarkan... Bicaralah sekarang!');
                document.getElementById('voice-command-btn').classList.add('listening');
            };
            
            voiceRecognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript.toLowerCase().trim();
                console.log('🎙️ Dengar:', transcript);
                
                if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }

                showVoiceStatus('success', `🎤 "${transcript}"`);
                processVoiceCommand(transcript);
            };
            
            voiceRecognition.onerror = function(event) {
                console.error('Voice error:', event.error);
                showVoiceStatus('error', '❌ Gagal mendengar. Coba lagi.');
                resetVoiceUI();
            };
            
            voiceRecognition.onend = function() {
                resetVoiceUI();
            };
            
            voiceRecognition.start();
        }
        
        // 🎯 PROCESS VOICE COMMAND
        function processVoiceCommand(transcript) {
            const cleanText = transcript.toLowerCase().trim();
            
            // 🚨 PRIORITY 1: CEK STOK BARANG SPESIFIK
            if (isSpecificStockQuery(cleanText)) {
                processInventoryQuery(cleanText);
                return;
            }
            
            // 🚨 PRIORITY 2: CEK OMSET/LABA LANGSUNG
            if (isDirectFinanceQuery(cleanText)) {
                processFinanceQuery(cleanText);
                return;
            }
            
            // 🎯 PRIORITY 3: SMART PATTERN MATCHING (TAMBAHIN DI SINI)
            const patternCommand = findVoiceCommand(cleanText);
            if (patternCommand) {
                console.log('🎯 Pattern matched:', patternCommand);
                
                if (patternCommand === 'specificStockQuery') {
                    const itemMatch = cleanText.match(/stok\s+(.+)/i);
                    if (itemMatch) checkStockLevel(itemMatch[1].trim());
                } else {
                    executeVoiceCommand(patternCommand, transcript);
                }
                return;
            }
            
            // 🚨 PRIORITY 4: BUSINESS QUERIES (harus explicit)
            if (isExplicitBusinessQuery(cleanText)) {
                const advice = processBusinessQuery(cleanText);
                showVoiceStatus('success', '💡 Business advice ready!');
                setTimeout(() => {
                    showInfo(advice);
                }, 800);
                return;
            }
            
            // 🎯 PRIORITY 5: VOICE SHORTCUTS REGULAR
            if (voiceShortcuts[cleanText]) {
                const command = voiceShortcuts[cleanText];
                executeVoiceCommand(command, transcript);
                return;
            }
            
            // 🧠 CEK DULU APAKAH INI PERCAKAPAN DENGAN AI
            if (isConversation(cleanText)) {
                const aiResponse = generateAIResponse(cleanText);
                showVoiceStatus('success', `🤖 ${aiResponse}`);
                return;
            }
            
            // 🆕 CEK SMART SEARCH COMMANDS
            if (voiceShortcuts[cleanText] && 
                ['searchCheap', 'searchDiscount', 'searchNew', 'searchPopular'].includes(voiceShortcuts[cleanText])) {
                const command = voiceShortcuts[cleanText];
                executeVoiceCommand(command, transcript);
                return;
            }
            
            // 🧮 CEK APAKAH INI PERHITUNGAN KOMPLEKS
            if (isComplexCalculation(cleanText)) {
                processScientificCalculation(cleanText);
                return;
            }
            
            // 🧮 CEK APAKAH INI PERHITUNGAN SEDERHANA
            if (isMathCalculation(cleanText)) {
                processCalculation(cleanText);
                return;
            }
            
            // 🔍 DEFAULT: SEARCH BARANG
            showVoiceStatus('success', `🔍 Mencari: "${cleanText}"`);
            document.getElementById('search-nama').value = cleanText;
            setTimeout(() => {
                if (typeof cariBarang === 'function') {
                    cariBarang();
                }
            }, 500);
        }
        
        // 🧠 SMART VOICE PATTERNS
        const voicePatterns = [
            { pattern: /^(print|cetak|struk)(\s+sekarang)?$/i, command: 'printStruk' },
            { pattern: /^(cetak\s+)?laporan(\s+stok)?$/i, command: 'printLaporan' },
            { pattern: /^(buka|ke|menu)\s+(penjualan|jual|kasir)$/i, command: 'goPenjualan' },
            { pattern: /^(buka|ke|menu)\s+(barang|manajemen|stok)$/i, command: 'goManajemen' },
            { pattern: /^(buka|ke|menu)\s+(statistik|grafik|laporan)$/i, command: 'goStatistik' },
            { pattern: /^(buka|ke|menu)\s+(catatan|notes)$/i, command: 'goCatatan' },
            { pattern: /^(buka|ke|menu)\s+(backup|data|restore)$/i, command: 'goBackup' },
            { pattern: /^(buka|ke|menu)\s+(rekam|pendapatan)$/i, command: 'goRekam' },
            { pattern: /^(buka|ke|menu)\s+(storage|penyimpanan)$/i, command: 'goStorage' },
            { pattern: /^(lakukan bayar|bayar|selesai|transaksi)(\s+sekarang)?$/i, command: 'doBayar' },
            { pattern: /^(batal|batalkan)(\s+transaksi)?$/i, command: 'doBatal' },
            { pattern: /^(scanner|scan|barcode)(\s+sekarang)?$/i, command: 'doScan' },
            { pattern: /^(favorit|meta|cepat)(\s+barang)?$/i, command: 'doFavorit' },
            { pattern: /^(omset|pendapatan)(\s+hari ini)?$/i, command: 'checkTodayRevenue' },
            { pattern: /^(laba|keuntungan)(\s+hari ini)?$/i, command: 'checkTodayProfit' },
            { pattern: /^(finance|keuangan)(\s+report)?$/i, command: 'checkFinance' },
            { pattern: /^(stok|stock)(\s+apa)?$/i, command: 'checkStock' },
            { pattern: /^(stok|stock)\s+(.+)$/i, command: 'specificStockQuery' },
            { pattern: /^(hitung|kalkulator|berapa)/i, command: 'doCalculate' },
            { pattern: /^(bantuan|help|tutorial)(\s+voice)?$/i, command: 'showHelp' }
        ];
        
        function findVoiceCommand(text) {
    // 1. Cek exact match dulu (priority tertinggi)
            if (voiceShortcuts[text]) {
                return voiceShortcuts[text];
            }
            
            // 2. Cek pattern matching (ARRAY OF OBJECTS)
            for (const { pattern, command } of voicePatterns) {
                if (pattern.test(text)) {
                    console.log('🎯 Pattern matched:', pattern, '→', command);
                    return command;
                }
            }
            
            // 3. Default ke search
            return null;
        }
        // 🔧 FUNGSI DETEKSI PRIORITY
        function isSpecificStockQuery(text) {
            // "stok mie sedap", "berapa stok kopi", "cek stok gula"
            return (text.includes('stok') && !isSingleWord(text)) || 
                   text.includes('berapa stok');
        }
        
        function isDirectFinanceQuery(text) {
            // "omset", "laba", "pendapatan hari ini"
            return text === 'omset' || text === 'laba' || text === 'pendapatan' ||
                   text === 'keuntungan' || text === 'finance';
        }
        
        function isExplicitBusinessQuery(text) {
            // HARUS explicit: "tips bisnis", "strategi warung", dll
            const explicitKeywords = [
                'tips bisnis', 'strategi warung', 'naikkan omset', 
                'profitabilitas', 'restock strategy', 'analisis pasar',
                'cara jualan', 'business', 'strategi'
            ];
            return explicitKeywords.some(keyword => text.includes(keyword));
        }
        
        function isSingleWord(text) {
            return text.trim().split(' ').length === 1;
        }
        
        function processFinanceQuery(transcript) {
            const cleanText = transcript.toLowerCase();
            
            if (cleanText === 'omset' || cleanText === 'pendapatan') {
                checkTodayRevenue();
            } 
            else if (cleanText === 'laba' || cleanText === 'keuntungan') {
                checkTodayProfit();
            }
            else if (cleanText === 'finance') {
                showFinanceDashboard();
            }
        }
        
        // FUNCTION CEK BUSINESS QUERY
        function isBusinessQuery(text) {
            const businessKeywords = [
                'tips', 'strategi', 'bisnis', 'usaha', 'warung',
                'naikkan', 'tingkatkan', 'profit', 'untung', 'omset',
                'restock', 'stok', 'analisis', 'pasar', 'jualan',
                'pelanggan', 'promo', 'diskon', 'harga'
            ];
            
            return businessKeywords.some(keyword => text.includes(keyword));
        }
        
        // 🧮 FUNCTION BARU: CEK APAKAH INI PERHITUNGAN MATEMATIKA
        function isMathCalculation(text) {
    // Support angka ribuan (1.000, 2,500, dll)
            const hasNumbers = /(\d+[.,]?\d*)/.test(text);
            const hasMathOperator = /(tambah|kurang|kali|bagi|\+|-|x|\/|x|dikali|ditambah|dikurang|dibagi)/.test(text);
            const numbers = text.match(/(\d+[.,]?\d*)/g) || [];
            const hasTwoNumbers = numbers.length >= 2;
            
            return hasNumbers && hasMathOperator && hasTwoNumbers;
        }
        // ⚡ EXECUTE VOICE COMMAND
        function executeVoiceCommand(command, transcript = '') {
          console.log('Executing:', command)
            switch(command) {
                case 'printStruk':
                    showVoiceStatus('success', '🖨️ Mencetak struk...');
                    setTimeout(() => {
                        if (keranjang.length > 0) {
                            cetakStrukBluetoothLangsung();
                        } else {
                            showVoiceStatus('error', '❌ Keranjang kosong!');
                        }
                    }, 1000);
                    break;
                    
                case 'printLaporan':
                    showVoiceStatus('success', '📊 Mencetak laporan stok...');
                    setTimeout(() => cetakLaporanStokDanRestockBluetooth(), 1000);
                    break;
                    
                case 'doBayar':
                    showVoiceStatus('success', '💳 Memproses bayar...');
                    setTimeout(() => {
                        if (keranjang.length > 0) {
                            bayarTransaksi();
                        } else {
                            showVoiceStatus('error', '❌ Keranjang kosong!');
                        }
                    }, 1000);
                    break;
                    
                case 'doBatal':
                    showVoiceStatus('warning', '🗑️ Membatalkan transaksi...');
                    setTimeout(() => {
                        if (keranjang.length > 0) {
                            batalTransaksi();
                        } else {
                            showVoiceStatus('error', '❌ Tidak ada transaksi!');
                        }
                    }, 1000);
                    break;
                    
                case 'doScan':
                    showVoiceStatus('success', '📱 Buka scanner...');
                    setTimeout(() => focusBarcodeScanner(), 1000);
                    break;
                    
                case 'doFavorit':
                    showVoiceStatus('success', '⭐ Buka favorit...');
                    setTimeout(() => bukaModalMeta(), 500);
                    break;
                    
                case 'goLaporan':
                    showVoiceStatus('success', '📓 Buka laporan harian...');
                    setTimeout(() => tampilkanLaporanHarian(), 500);
                    break;
                    
                case 'doConnect':
                    showVoiceStatus('success', '📡 Menghubungkan printer...');
                    setTimeout(() => {
                        if (typeof connectBluetoothPrinter === 'function') {
                            connectBluetoothPrinter();
                        } else {
                            showVoiceStatus('error', '❌ Connect function tidak ada!');
                        }
                    }, 1000);
                    break;
                    
                case 'doBackup':
                    showVoiceStatus('success', '💾 Backup data JSON...');
                    setTimeout(() => {
                        if (typeof backupJSON === 'function') {
                            backupJSON();
                        } else {
                            showVoiceStatus('error', '❌ Backup function tidak ada!');
                        }
                    }, 1000);
                    break;
                    
                // 📱 NAVIGATION COMMANDS BARU
                case 'goManajemen':
                    showVoiceStatus('success', '📦 Buka manajemen barang...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('manajemen');
                        }
                    }, 500);
                    break;
                    
                case 'goPenjualan':
                    showVoiceStatus('success', '🛒 Buka penjualan...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('penjualan');
                        }
                    }, 500);
                    break;
                    
                case 'goStatistik':
                    showVoiceStatus('success', '📈 Buka statistik...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('statistik');
                        }
                    }, 500);
                    break;
                    
                case 'goCatatan':
                    showVoiceStatus('success', '📝 Buka catatan...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('catatan');
                        }
                    }, 500);
                    break;
                    
                case 'goBackup':
                    showVoiceStatus('success', '💾 Buka backup...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('backup');
                        }
                    }, 500);
                    break;
                    
                case 'goRekam':
                    showVoiceStatus('success', '💰 Buka rekam pendapatan...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('rekam-pendapatan');
                        }
                    }, 500);
                    break;
                    
                case 'goStorage':
                    showVoiceStatus('success', '💽 Buka storage...');
                    setTimeout(() => {
                        if (typeof switchSection === 'function') {
                            switchSection('storage');
                        }
                    }, 500);
                    break;
                    
              case 'ohThanks':
                  showVoiceStatus('success', getRandomResponse(warungAI.thanks));
                  break;
                  
              case 'yoHalo':
                  showVoiceStatus('success', 'Halo Juga... 👋 [Katakan "bantuan" untuk lihat semua command]');
                  break;
                  
              case 'yoKabar':
                  const timeResponse = getTimeBasedResponse();
                  const randomMood = getRandomMood();
                  showVoiceStatus('success', `${timeResponse} ${randomMood}`);
                  break;
                  
              case 'goVoice':
                  showVoiceStatus('success', '⭐ Menampilkan voice shortcuts...');
                  setTimeout(() => showVoiceHelp(), 500);
                  break;
                  
              // 🔢 MATEMATIKA & KALKULASI
              case 'doCalculate':
                  showVoiceStatus('success', '🧮 Mode kalkulator: Sebut angka & operasi!');
                  setTimeout(() => {
                      if (transcript) {
                          processCalculation(transcript);
                      } else {
                          showInfo('Contoh: "10 tambah 5" atau "20 kali 3" atau "100 bagi 4"');
                      }
                  }, 800);
                  break;
                  
              // ℹ️ INFO & BANTUAN  
              case 'whoAreYou':
                  showVoiceStatus('success', 'Saya [J.A.R.V.I.S] 🤖,Asisten Voice Warung Al Sakho! 🛒✨');
                  break;
                  
              case 'yaSiap':
                  showVoiceStatus('success', 'Ya..., Ada yang bisa saya bantu?? [katakan i need help/ bantuan]');
                  break;
                  
              case 'yoSalam':
                  showVoiceStatus('success', 'Wa alaikumsalam..., Ada yang bisa saya bantu?? [katakan i need help/ bantuan]');
                  break;
                
              case 'imReady':
                setTimeout(() => {
                      showInfo('Saya bisa bantu:\n• Cetak struk & laporan\n• Navigasi menu\n• Hitung matematika\n• Percakapan singkat\n•Dan banyak lagi!');
                  }, 1000);
                  break;
                  
              case 'aboutWarung':
                  showVoiceStatus('success', 'Warung Al Sakho - Bayalangu Kidul, Kab. Cirebon 🏪');
                  setTimeout(() => {
                      showInfo('Warung modern dengan teknologi voice assistant! 🎙️🤖\n"Jualan jadi lebih cepat dan keren!"');
                  }, 1000);
                  break;
                  
              case 'showHelp':
                  showVoiceStatus('success', '📚 Menampilkan bantuan...');
                  setTimeout(() => showVoiceHelp(), 500);
                  break;
                  
              // 😄 FUN RESPONSES
              case 'funResponse':
                  const funResponse = getRandomFunResponse();
                  showVoiceStatus('success', funResponse);
                  break;
                  
              case 'showTime':
                  showVoiceStatus('success',` Sekarang jam: ${jamSekarang()} ✅`);
                  break;
                  
              case 'scientificCalc':
                    showVoiceStatus('success', '🧮 Scientific Mode: Sebut operasi kompleks!');
                    setTimeout(() => {
                        showInfo('Contoh: "2 tambah 2 kali 5 bagi 2 kurang 1 kali 3 tambah 4"');
                    }, 800);
                  break;
                  
              // 🆕 INVENTORY QUERY
              case 'checkStock':
                  showVoiceStatus('success', '📦 Mode cek stok: Sebut nama barang!');
                  setTimeout(() => {
                      showInfo('Contoh: "stok mie sedap" atau "berapa stok kopi"');
                  }, 800);
                  break;
                  
              // 🆕 FINANCE QUERY  
              case 'checkRevenue':
                  showVoiceStatus('success', '💰 Mengecek omset...');
                  setTimeout(() => {
                      checkTodayRevenue();
                  }, 1000);
                  break;
                  
              case 'checkProfit':
                  showVoiceStatus('success', '💹 Mengecek laba...');
                  setTimeout(() => {
                      checkTodayProfit();
                  }, 1000);
                  break;
                  
              case 'checkFinance':
                  showVoiceStatus('success', '📊 Menampilkan statistik keuangan...');
                  setTimeout(() => {
                      showFinanceDashboard();
                  }, 1000);
                  break;
                  
              // 🆕 SMART SEARCH
              case 'searchCheap':
                  showVoiceStatus('success', '💰 Mencari barang termurah...');
                  setTimeout(() => {
                      searchByPrice('cheap');
                  }, 500);
                  break;
                  
              case 'searchDiscount':
                  showVoiceStatus('success', '🎯 Mencari barang diskon...');
                  setTimeout(() => {
                      searchByDiscount();
                  }, 500);
                  break;
                  
              case 'searchNew':
                  showVoiceStatus('success', '🆕 Mencari barang baru...');
                  setTimeout(() => {
                      searchNewItems();
                  }, 500);
                  break;
                  
              case 'searchPopular':
                  showVoiceStatus('success', '🏆 Mencari barang populer...');
                  setTimeout(() => {
                      searchPopularItems();
                  }, 500);
                  break;
                  
              // 🆕 VOICE REPORTS
              case 'generateReport':
                  showVoiceStatus('success', '📈 Generating report...');
                  setTimeout(() => {
                      generateVoiceReport();
                  }, 1000);
                  break;
                  
              // 🆕 TUTORIAL MODE
              case 'startTutorial':
                  showVoiceStatus('success', '🎓 Memulai tutorial...');
                  setTimeout(() => {
                      startVoiceTutorial();
                  }, 500);
                  break;
                  
              // 🆕 REKAM PENDAPATAN
              case 'toggleRekam':
                  showVoiceStatus('success', '📝 Mengelola rekam pendapatan...');
                  setTimeout(() => {
                      toggleRekamPendapatan();
                  }, 500);
                  break;
                  
              case 'startChat':
                  showVoiceStatus('success', '🤖 AI Mode: Silakan tanya apa saja seputar warung!');
                  setTimeout(() => {
                      const question = prompt("Apa yang ingin kamu tanya?");
                      if (question) {
                          const aiResponse = generateAIResponse(question);
                          showInfo(`🤖 WARUNG AI: ${aiResponse}`);
                      }
                  }, 1000);
                  break;
                  
              case 'businessTips':
              case 'businessStrategy':
              case 'increaseRevenue':
              case 'businessProfit':
              case 'restockStrategy':
              case 'marketAnalysis':
                  showVoiceStatus('success', '🧠 Menganalisis bisnis warung...');
                  setTimeout(() => {
                      const advice = generateBusinessAdvice(command, transcript);
                      showInfo(`🏪 BUSINESS ADVISOR:\n\n${advice}`);
                  }, 1000);
                 break;
                 
              case 'showThemeSwitcher':
                  showThemeSwitcher();
                  break;
            }
        }
        
        // 🎪 VOICE HELP ALERT
        function showVoiceHelp() {
            const commands = `
        🎙️ **VOICE COMMANDS:**
           **SESUAIKAN EJAANYA!**
        🖨️ **PRINT:**
        "print" / "cetak" / "struk" → Cetak struk
        "stok" / "lapor" → Cetak laporan stok
        ⚡ **ACTIONS:**
        "bayar" → Proses pembayaran
        "batal" → Batalkan transaksi  
        "scan" → Buka barcode scanner
        "meta" → Buka barang favorit
        "konek" → Connect printer Bluetooth
        "back up" → Backup data JSON
        📱 **NAVIGASI:**
        "barang" → Manajemen barang
        "jual" → Penjualan
        "statistik" → Statistik & laba
        "catat" → Catatan warung
        "data" → Backup & restore
        "rekam" → Rekam pendapatan
        "simpan" → Storage info
        "harian" → Laporan harian
        🧮 **KALKULATOR:**
        "hitung" / "kalkulator" → Mode kalkulator
        "berapa" → Hitung otomatis
        Contoh: "10 tambah 5", "20 kali 3", "100 bagi 4"
        🧮 **KALKULATOR SCIENTIFIC:**
        "kalkulator ilmiah" → Mode scientific
        "hitung kompleks" → Hitung operasi kompleks
        💰 **SUPPORT NILAI BESAR:**
        • "10 ribu" → 10.000
        • "2.5 juta" → 2.500.000  
        • "1.2 miliar" → 1.200.000.000
        • "3 triliun" → 3.000.000.000.000
        💡 **CONTOH OPERASI KOMPLEKS:**
        "1 juta kali 3 tambah 500 ribu"
        "2.5 miliar bagi 2 tambah 100 juta"
        "1 triliun kali 2 kurang 500 miliar"
        💬 **PERCAKAPAN:**
        "halo" / "hai" → Sapaan
        "apa kabar" → Tanya kabar
        "terima kasih" → Ucapan terima kasih
        "bantuan" → Tampilkan bantuan ini
        💰 **FINANCE & INVENTORY:**
        "omset" / "pendapatan" → Cek omset hari ini
        "laba" / "keuntungan" → Cek laba bersih
        "finance" → Dashboard keuangan lengkap
        "stok" → Cek stok barang
        "stok [nama barang]" → Cek stok spesifik
        🔍 **SMART SEARCH:**
        "murah" → Cari barang termurah
        "diskon" → Cari barang diskon
        "baru" → Cari barang baru
        "populer" → Cari barang terlaris
        📊 **REPORTS & ANALYTICS:**
        "laporan" / "report" → Generate laporan lengkap
        "export" → Export data penjualan
        🎓 **TUTORIAL & HELP:**
        "tutorial" / "bantuan" → Tutorial penggunaan
        "cara pakai" / "help" → Panduan lengkap
        🔢 **CONTOH CEK STOK:**
        "stok mie sedap"
        "berapa stok kopi"
        "stok" → Lihat semua stok mau habis
        📈 **CONTOH LAPORAN:**
        "omset" → Omset hari ini
        "laba" → Laba bersih
        "finance" → Dashboard lengkap
        "laporan" → Laporan bulanan
        🏪 **BUSINESS ADVISOR:**
        "tips bisnis" / "strategi warung" → Tips meningkatkan bisnis
        "naikkan omset" → Strategi meningkatkan pendapatan  
        "profitabilitas" → Tips meningkatkan keuntungan
        "restock strategy" → Strategi manajemen stok
        "analisis pasar" → Analisis pasar warung Anda
        💡 **CONTOH PERTANYAAN:**
        "bagaimana meningkatkan omset warung"
        "strategi restock yang efektif" 
        "tips menarik pelanggan baru"
        "cara analisis pasar warung"
        📞 **BUTUH BANTUAN?**
        Katakan "tutorial" untuk panduan lengkap!
        😄 **FUN RESPONSES:**
        "keren", "mantap", "gila", "wow" → Respon seru!
        💡 **ATAU** sebut nama barang untuk search otomatis!
        🎙️ VOICE COMMANDS LENGKAP WARUNG AL SAKHO
        Total : 85+ Voice commands yang bisa di coba
        🖨️ PRINT & LAPORAN
        print, cetak, struk, stok, lapor
        ⚡ ACTIONS
        bayar, batal, scan, scan barcode, scanner, meta, connect, back up
        📱 NAVIGASI
        barang, jual, statistik, catat, data, rekam, simpan, harian
        💬 PERCAKAPAN
        oke, terima kasih, terima kasih banyak, makasih, makasih ya, makasih ya udah jadi assisten, halo, hai, hi, halo bang, hi bang, hai bang, assalamualaikum, apa kabar, apa kabar nih, apa kabarmu, tampilkan, jarvis
        🧮 KALKULATOR & MATEMATIKA
        hitung, kalkulator, berapa, tambah, kurang, kali, bagi, kalkulator ilmiah, hitung kompleks, hitung rumit, calculator
        ℹ️ INFO & BANTUAN
        siapa kamu, namamu siapa, kamu siapa, kamu bisa apa, kamu bisa apa aja, warung, toko, bantuan, help, i need help, saya butuh bantuan, ini jam berapa, ini jam berapa ya, jam berapa sekarang, sekarang jam berapa
        😄 FUN RESPONSES
        gila, keren, mantap, wow, anjay, cakep, gila keren banget, mantap banget nih, wow mantap, mantap joss
        📦 INVENTORY & STOK
        periksa stok, inventory, cek stok, stok barang
        💰 FINANCE & KEUANGAN
        omzet, cek omzet hari ini, laba, keuntungan, finance
        🔍 SMART SEARCH
        barang murah, barang diskon, barang baru, barang populer
        📊 REPORTS & ANALYTICS
        laporan, report, export
        🎓 TUTORIAL & CHAT
        tutorial, bantu dong, cara pakai, help, chat, halo jarvis, hai jarvis, helo jarvis, bisakah kita ngobrol, hey jarvis
        📝 REKAM PENDAPATAN
        aktifkan rekam, catat pendapatan, pencatatan
        💼 BUSINESS ADVISOR
        tips bisnis, cara jualan, strategi warung, naikkan omset, profitabilitas, restock strategy, analisis pasar
            `;
            
            showInfo(commands);
        }
        
        // 📊 VOICE STATUS MANAGEMENT
        function showVoiceStatus(type, message) {
            const statusEl = document.getElementById('voice-status');
            statusEl.textContent = message;
            statusEl.className = 'voice-status ' + type;
            statusEl.style.display = 'block';
            
            // 🎙️ SMART VOICE TIMING
            if (isSpeechEnabled && type !== 'listening') {
                let speechMessage = '';
                
                switch(type) {
                    case 'success':
                        speechMessage = message.replace(/[🎤🖨️📊💳📱⭐💰💹📦🎯🆕🏆📈🎓📝🧠💡✅*]/g, '');
                        break;
                    case 'error':
                        speechMessage = 'Error. ' + message.replace(/[❌🚨⚠️🗑️]/g, '');
                        break;
                    case 'warning':
                        speechMessage = 'Peringatan. ' + message.replace(/[⚠️📝]/g, '');
                        break;
                }
                
                if (speechMessage) {
                    // 🕒 SMART TIMING: Sesuai panjang pesan
                    const speechDuration = calculateSpeechDuration(speechMessage);
                    speakText(speechMessage);
                    
                    // 🎯 UPDATE RESET TIMER SESUAI DURASI SUARA
                    smartResetVoiceUI(speechDuration);
                    return; // JANGAN resetVoiceUI() lagi!
                }
            }
            
            // Default reset untuk non-voice messages
            resetVoiceUI();
        }
        
        function resetVoiceUI() {
            isListening = false;
            document.getElementById('voice-command-btn').classList.remove('listening');
            
            // Sembunyikan status setelah 3 detik
            setTimeout(() => {
                const statusEl = document.getElementById('voice-status');
                if (statusEl.style.display !== 'none') {
                    statusEl.style.display = 'none';
                }
            }, 10000);
        }
        
        // 📱 FOCUS BARCODE SCANNER
        function focusBarcodeScanner() {
            startScanner();
            document.getElementById('search-nama').value = '';
        }
        
        // 🕒 CALCULATE SPEECH DURATION
        function calculateSpeechDuration(text) {
            const wordsPerMinute = 160; // Kecepatan bicara normal
            const wordCount = text.split(' ').length;
            const durationMs = (wordCount / wordsPerMinute) * 60 * 1000;
            return Math.max(durationMs, 3000); // Minimal 2 detik
        }
        
        // 🎯 SMART RESET VOICE UI
        function smartResetVoiceUI(speechDuration) {
            isListening = false;
            document.getElementById('voice-command-btn').classList.remove('listening');
            
            // Timer sesuai durasi suara + buffer
            const resetTime = speechDuration + 2000; // +1 detik buffer
            
            setTimeout(() => {
                const statusEl = document.getElementById('voice-status');
                if (statusEl.style.display !== 'none') {
                    statusEl.style.display = 'none';
                }
            }, resetTime);
        }
        
        // 🎮 TEST COMMAND (Untuk debug)
        function testVoice(cmd) {
            processVoiceCommand(cmd);
        }
        
        // 🔊 INIT
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🎙️ Voice Commands Ready!');
        });
        
        function jamSekarang(){
          const today = new Date();
          const jam = today.getHours();
          const menit = today.getMinutes();
          const detik = today.getSeconds();
          
          const waktuKustom = `${jam}:${menit}:${detik}`;
          return waktuKustom;
        }
        // 🌅 RESPON BERDASARKAN WAKTU
        function getTimeBasedResponse() {
            const hour = new Date().getHours();
            if (hour < 4) return 'Wah masih begadang nih! 🌙';
            if (hour < 11) return 'Selamat pagi! 🌅';
            if (hour < 15) return 'Selamat siang! ☀️';
            if (hour < 18) return 'Selamat sore! 🌇';
            if (hour < 22) return 'Selamat malam! 🌃';
            return 'Wah sudah larut! 🌜';
        }
        
        // 😊 RANDOM MOOD RESPONSE
        function getRandomMood() {
            const moods = [
                'Saya baik-baik saja, terima kasih! 😊',
                'Lagi semangat nih! 💪',
                'Siap membantu! 🦾', 
                'Excellent! 😎',
                'Never been better! ✨',
                'Siap melayani! 🛒',
                'Oke banget! 🔥',
                'Semangat Membantu 🤖'
            ];
            return moods[Math.floor(Math.random() * moods.length)];
        }
        
        // 😄 RANDOM FUN RESPONSES
        function getRandomFunResponse() {
            const responses = [
                'Wih, makasih bang! 😎',
                'Iya nih, emang keren kan? 😏',
                'Technology is magic! 🪄',
                'Tony Stark banget ya? 🤖',
                'J.A.R.V.I.S. mode activated! 🦾',
                'Warp speed! 🚀',
                'Like a boss! 💼',
                'Ini baru teknologi! 📱',
                'Luar biasa! 🌟',
                'Mantap jiwa! 💯',
                'Gila lu bang! 😂',
                'Asli, ini keren banget! 🎉',
                'Iya dong Haha...🤣',
                'Tentu Saja!'
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // 📦 INVENTORY QUERY FUNCTIONS
        function processInventoryQuery(transcript) {
            const cleanText = transcript.toLowerCase();
            
            // Extract nama barang dari transcript
            const barangMatch = cleanText.match(/stok\s+(.+)/) || cleanText.match(/berapa\s+stok\s+(.+)/);
            
            if (barangMatch && barangMatch[1]) {
                const namaBarang = barangMatch[1].trim();
                checkStockLevel(namaBarang);
            } else {
                showLowStockAlert();
            }
        }
        
        function checkStockLevel(namaBarang) {
            const barang = barangList.find(b => 
                b.nama.toLowerCase().includes(namaBarang.toLowerCase())
            );
            
            if (barang) {
                showVoiceStatus('success', `📦 ${barang.nama}: Stok ${barang.stok} pcs`);
            } else {
                showVoiceStatus('error', `❌ Barang "${namaBarang}" tidak ditemukan`);
            }
        }
        
        function showLowStockAlert() {
            const lowStockItems = barangList.filter(b => b.stok < 5);
            
            if (lowStockItems.length > 0) {
                let message = `⚠️ Stok mau habis:\n`;
                lowStockItems.forEach(item => {
                    message += `• ${item.nama}: ${item.stok} pcs\n`;
                });
                showInfo(message);
            } else {
                showVoiceStatus('success', '✅ Semua stok aman!');
            }
        }
        
        // 💰 FINANCE QUERY FUNCTIONS
        function checkTodayRevenue() {
            const today = new Date().toISOString().slice(0, 10);
            const todaySales = riwayat.filter(r => 
                r.timestamp.toISOString().slice(0, 10) === today
            );
            
            const totalRevenue = todaySales.reduce((sum, r) => sum + r.total, 0);
            showVoiceStatus('success', `💰 Omset hari ini: Rp ${totalRevenue.toLocaleString('id-ID')}`);
        }
        
        function checkTodayProfit() {
            const today = new Date().toISOString().slice(0, 10);
            const todaySales = riwayat.filter(r => 
                r.timestamp.toISOString().slice(0, 10) === today
            );
            
            const totalRevenue = todaySales.reduce((sum, r) => sum + r.total, 0);
            const profit = totalRevenue * 0.1; // Asumsi laba 10%
            
            showVoiceStatus('success', `💹 Laba bersih: Rp ${profit.toLocaleString('id-ID')} (10%)`);
        }
        
        function showFinanceDashboard() {
            const revenue = calculateMonthlyRevenue();
            const profit = revenue * 0.1;
            const topItems = getTopSellingItems();
            
            let message = `📊 DASHBOARD KEUANGAN:\n\n`;
            message += `💰 Omset Bulan Ini: Rp ${revenue.toLocaleString('id-ID')}\n`;
            message += `💹 Laba Bersih: Rp ${profit.toLocaleString('id-ID')}\n\n`;
            message += `🏆 TOP 3 BARANG:\n`;
            
            topItems.slice(0, 3).forEach((item, index) => {
                message += `${index + 1}. ${item.nama}: ${item.totalSold} pcs\n`;
            });
            
            showInfo(message);
        }
        
        // 🔍 SMART SEARCH FUNCTIONS LENGKAP

        function searchByPrice(type) {
            let filteredBarang = [];
            let searchTerm = '';
            
            if (type === 'cheap') {
                filteredBarang = barangList
                    .filter(b => b.harga <= 10000)  // Barang <= Rp 10.000
                    .sort((a, b) => a.harga - b.harga)  // Urut dari termurah
                    .slice(0, 8);  // Ambil 8 termurah
                
                searchTerm = 'barang termurah';
                showVoiceStatus('success', `💰 Menampilkan ${filteredBarang.length} barang termurah...`);
            }
            
            // Update UI dengan hasil search
            updateSearchResults(filteredBarang, searchTerm);
        }
        
        function searchByDiscount() {
            // Logic sederhana: anggap diskon = barang dengan harga < rata-rata
            const averagePrice = barangList.reduce((sum, b) => sum + b.harga, 0) / barangList.length;
            const discountThreshold = averagePrice * 0.7; // 30% dibawah rata-rata
            
            const discountedItems = barangList
                .filter(b => b.harga <= discountThreshold)
                .sort((a, b) => a.harga - b.harga)
                .slice(0, 8);
            
            const searchTerm = 'barang diskon';
            showVoiceStatus('success', `🎯 Menampilkan ${discountedItems.length} barang diskon...`);
            
            updateSearchResults(discountedItems, searchTerm);
        }
        
        function searchNewItems() {
            const newItems = barangList
                .filter(b => b.stok >= 20)  // Stok tinggi = barang fresh
                .sort((a, b) => b.stok - a.stok)  // Urut dari stok tertinggi
                .slice(0, 8);
            
            const searchTerm = 'barang baru';
            showVoiceStatus('success', `🆕 Menampilkan ${newItems.length} barang baru...`);
            
            updateSearchResults(newItems, searchTerm);
        }
        
        function searchPopularItems() {
            // Gunakan riwayat penjualan untuk cari barang populer
            const popularItems = getPopularItemsFromHistory()
                .slice(0, 8);  // Ambil 8 terpopuler
            
            const searchTerm = 'barang populer';
            showVoiceStatus('success', `🏆 Menampilkan ${popularItems.length} barang terlaris...`);
            
            updateSearchResults(popularItems, searchTerm);
        }
        
        // 🏆 FUNGSI GET POPULAR ITEMS DARI RIWAYAT
        function getPopularItemsFromHistory() {
            const itemCount = {};
            
            // Hitung total penjualan per barang dari riwayat
            riwayat.forEach(transaction => {
                transaction.items.forEach(item => {
                    if (!itemCount[item.nama]) {
                        itemCount[item.nama] = 0;
                    }
                    itemCount[item.nama] += item.jumlah;
                });
            });
            
            // Map ke barangList dan sort by popularity
            const popularItems = barangList
                .map(barang => ({
                    ...barang,
                    totalSold: itemCount[barang.nama] || 0
                }))
                .filter(barang => barang.totalSold > 0)  // Hanya yang pernah terjual
                .sort((a, b) => b.totalSold - a.totalSold);
            
            // Jika tidak ada riwayat, kembalikan barang dengan stok tertinggi
            if (popularItems.length === 0) {
                return barangList
                    .sort((a, b) => b.stok - a.stok)
                    .slice(0, 8);
            }
            
            return popularItems;
        }
        
        // 🔄 FUNGSI UPDATE SEARCH RESULTS
        function updateSearchResults(items, searchTerm) {
            // Update search input
            const searchInput = document.getElementById('search-nama');
            if (searchInput) {
                searchInput.value = searchTerm;
            }
            
            // Clear existing results
            const tbody = document.querySelector('#search-result tbody');
            if (tbody) {
                tbody.innerHTML = '';
            }
            
            // Display new results
            if (items.length === 0) {
                showVoiceStatus('warning', '❌ Tidak ada barang ditemukan');
                return;
            }
            
            items.forEach(barang => {
                const tr = document.createElement('tr');
                
                tr.innerHTML = `
                    <td>${barang.nama}</td>
                    <td>${barang.harga.toLocaleString('id-ID')}</td>
                    <td>${barang.stok}</td>
                    <td>
                        <div class="qty-control">
                            <button class="btn-qty" onclick="ubahQty(this,-1)">−</button>
                            <span class="qty-val">1</span>
                            <button class="btn-qty" onclick="ubahQty(this,1)">+</button>
                        </div>
                    </td>
                    <td>
                        <button onclick="tambahKeKeranjang('${barang.nama}', getQty(this))">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </td>
                `;
                
                if (tbody) {
                    tbody.appendChild(tr);
                }
            });
            
            // Scroll ke results
            setTimeout(() => {
                const results = document.querySelector('#search-result');
                if (results) {
                    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
        }
        
        // 🎯 FUNGSI TAMBAHAN UNTUK SEARCH ENHANCEMENT
        function enhanceSearchWithFilters() {
            // Bisa ditambah filter lainnya
            const searchFilters = {
                'dibawah 5rb': () => barangList.filter(b => b.harga <= 5000),
                'dibawah 10rb': () => barangList.filter(b => b.harga <= 10000),
                'diatas 50rb': () => barangList.filter(b => b.harga >= 50000),
                'stok banyak': () => barangList.filter(b => b.stok >= 10).sort((a, b) => b.stok - a.stok),
                'stok sedikit': () => barangList.filter(b => b.stok > 0 && b.stok <= 3)
            };
            
            return searchFilters;
        }
        
        // 📈 VOICE REPORT FUNCTION
        function generateVoiceReport() {
            showVoiceStatus('success', '📊 Generating comprehensive report...');
            
            setTimeout(() => {
                const reportData = generateSalesReport();
                showInfo(`📈 LAPORAN LENGKAP:\n\n${reportData}`);
            }, 1500);
        }
        
        // 🎓 TUTORIAL FUNCTION
        function startVoiceTutorial() {
            const tutorialSteps = [
                "🎙️ VOICE TUTORIAL WARUNG AL SAKHO",
                "1. CETAK STRUK: Katakan 'print' atau 'struk'",
                "2. CEK STOK: Katakan 'stok nama barang'", 
                "3. HITUNG: Katakan '2 tambah 3 kali 5'",
                "4. LAPORAN: Katakan 'laporan' atau 'omset'",
                "5. NAVIGASI: Katakan 'jual', 'barang', 'statistik'",
                "\n💡 Contoh: 'stok mie sedap', 'print', 'hitung 1000 kali 3'"
            ];
            
            showInfo(tutorialSteps.join('\n'));
        }
        
        // 📝 REKAM PENDAPATAN FUNCTION  
        function toggleRekamPendapatan() {
            // Trigger toggle rekam pendapatan
            const toggle = document.getElementById('toggle-rekam');
            toggle.checked = !toggle.checked;
            
            const status = toggle.checked ? 'diaktifkan' : 'dinonaktifkan';
            showVoiceStatus('success', `📝 Rekam pendapatan ${status}!`);
            
            // Trigger change event
            toggle.dispatchEvent(new Event('change'));
        }

        // 📊 FUNGSI GENERATE LAPORAN LENGKAP
        function generateSalesReport() {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            // 📅 FILTER DATA BULAN INI
            const monthlySales = riwayat.filter(r => {
                const saleDate = new Date(r.timestamp);
                return saleDate.getMonth() === currentMonth && 
                       saleDate.getFullYear() === currentYear;
            });
            
            // 📈 HITUNG SEMUA METRIK
            const totalRevenue = monthlySales.reduce((sum, r) => sum + r.total, 0);
            const totalProfit = totalRevenue * 0.1; // Asumsi laba 10%
            const totalTransactions = monthlySales.length;
            
            // 🏆 BARANG TERLARIS
            const topItems = getTopSellingItems();
            
            // 📦 STOK ANALISIS
            const lowStockItems = barangList.filter(b => b.stok < 5);
            const outOfStockItems = barangList.filter(b => b.stok === 0);
            
            // 💰 TREN HARIAN (7 HARI TERAKHIR)
            const dailyTrend = getLast7DaysTrend();
            
            // 🎯 BUILD REPORT STRING
            let report = `📈 LAPORAN PENJUALAN BULANAN\n`;
            report += `Periode: ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}\n`;
            report += `Generated: ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')}\n`;
            report += "=".repeat(40) + "\n\n";
            
            // 💵 SUMMARY KEUANGAN
            report += `💵 SUMMARY KEUANGAN:\n`;
            report += `• Total Omset: Rp ${totalRevenue.toLocaleString('id-ID')}\n`;
            report += `• Laba Bersih: Rp ${totalProfit.toLocaleString('id-ID')} (10%)\n`;
            report += `• Total Transaksi: ${totalTransactions}x\n`;
            report += `• Rata-rata/Transaksi: Rp ${(totalRevenue / (totalTransactions || 1)).toLocaleString('id-ID')}\n\n`;
            
            // 🏆 BARANG TERLARIS
            report += `🏆 TOP 5 BARANG TERLARIS:\n`;
            topItems.slice(0, 5).forEach((item, index) => {
                report += `${index + 1}. ${item.nama}: ${item.totalSold} pcs (Rp ${item.totalRevenue.toLocaleString('id-ID')})\n`;
            });
            report += `\n`;
            
            // ⚠️ STOK WARNING
            if (lowStockItems.length > 0) {
                report += `⚠️ STOK MAU HABIS:\n`;
                lowStockItems.forEach(item => {
                    report += `• ${item.nama}: ${item.stok} pcs\n`;
                });
                report += `\n`;
            }
            
            if (outOfStockItems.length > 0) {
                report += `❌ STOK HABIS:\n`;
                outOfStockItems.forEach(item => {
                    report += `• ${item.nama}: ${item.stok} pcs\n`;
                });
                report += `\n`;
            }
            
            // 📊 TREN HARIAN
            report += `📊 TREN 7 HARI TERAKHIR:\n`;
            dailyTrend.forEach(day => {
                report += `• ${day.date}: Rp ${day.revenue.toLocaleString('id-ID')}\n`;
            });
            report += `\n`;
            
            // 💡 REKOMENDASI
            report += `💡 REKOMENDASI:\n`;
            if (lowStockItems.length > 0) {
                report += `• Restock segera: ${lowStockItems.map(i => i.nama).join(', ')}\n`;
            }
            
            const bestSelling = topItems[0];
            if (bestSelling) {
                report += `• Fokus jual: ${bestSelling.nama} (terlaris)\n`;
            }
            
            const avgDaily = totalRevenue / 30; // Asumsi 30 hari
            report += `• Target harian: Rp ${Math.round(avgDaily).toLocaleString('id-ID')}\n`;
            
            return report;
        }
        
        // 🏆 FUNGSI GET TOP SELLING ITEMS
        function getTopSellingItems() {
            const itemSales = {};
            
            // Hitung total penjualan per barang
            riwayat.forEach(transaction => {
                transaction.items.forEach(item => {
                    if (!itemSales[item.nama]) {
                        itemSales[item.nama] = {
                            nama: item.nama,
                            totalSold: 0,
                            totalRevenue: 0
                        };
                    }
                    itemSales[item.nama].totalSold += item.jumlah;
                    itemSales[item.nama].totalRevenue += item.total;
                });
            });
            
            // Convert ke array & sort by total sold
            return Object.values(itemSales)
                .sort((a, b) => b.totalSold - a.totalSold);
        }
        
        // 📅 FUNGSI GET LAST 7 DAYS TREND
        function getLast7DaysTrend() {
            const trend = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(today.getDate() - i);
                const dateString = date.toISOString().slice(0, 10);
                
                const daySales = riwayat.filter(r => 
                    r.timestamp.toISOString().slice(0, 10) === dateString
                );
                
                const dayRevenue = daySales.reduce((sum, r) => sum + r.total, 0);
                
                trend.push({
                    date: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
                    revenue: dayRevenue
                });
            }
            
            return trend;
        }
        
        // 🧮 FUNGSI CALCULATE MONTHLY REVENUE
        function calculateMonthlyRevenue() {
            const now = new Date();
            const monthlySales = riwayat.filter(r => {
                const saleDate = new Date(r.timestamp);
                return saleDate.getMonth() === now.getMonth() && 
                       saleDate.getFullYear() === now.getFullYear();
            });
            
            return monthlySales.reduce((sum, r) => sum + r.total, 0);
        }

        // 🧠 SIMPLE AI RESPONSE GENERATOR
        const warungAI = {
            greetings: [
                "Halo! Ada yang bisa saya bantu? 😊",
                "Hai! Siap membantu warung Al Sakho! 🛒",
                "Halo! Voice assistant siap melayani! 🎙️",
                "Hai! Senang bisa membantu hari ini! ✨"
            ],
            
            thanks: [
                "Sama-sama! Senang bisa membantu! 😄",
                "Terima kasih kembali! 🥰",
                "Dengan senang hati! 👍",
                "Siap! Kapan-kapan butuh bantuan lagi ya! 👋",
                "Wokeee bangg!!",
                "Santai Bang😁",
                "Yoi Bang😎"
            ],
            
            compliments: [
                "Wih, makasih bang! Lu juga keren! 😎",
                "Wah, seneng denger itu! 🥳",
                "Technology is magic, right? 🪄",
                "Tony Stark banget ya? 🤖"
            ],
            
            questions: {
                "siapa kamu": "Saya asisten virtual Warung Al Sakho! 🛒",
                "buat siapa": "Dibuat khusus untuk Warung Al Sakho di Bayalangu Kidul! 🏪",
                "kamu bisa apa aja": "Saya bisa bantu jualan, hitung, cetak struk, dan banyak lagi! 🎯",
                "siapa pencipta kamu": "Saya Di ciptakan dengan ❤️ oleh owner yang kreatif! [FaizAzka] ✨"
,                 
                "tujuan kamu ada": "Tujuan saya adalah untuk membantu kinerja pelayanan warung 3x lebih cepat "
            },
            
            randomFacts: [
                "Tahukah kamu? Warung Al Sakho punya fitur voice termodern se-Kabupaten! 🎙️",
                "Favorit customer: Mie Sedap, Kopi Kapal Api, dan Gula Pasir! 🏆",
                "Omset terbaik biasanya hari Sabtu dan Minggu! 📈",
                "Teknologi voice command bisa percepat transaksi sampai 3x lebih cepat! ⚡"
            ]
        };
        
        // 🎯 AI RESPONSE GENERATOR
        function generateAIResponse(userMessage) {
            const message = userMessage.toLowerCase();
            
            // Cek pertanyaan spesifik
            for (const [question, answer] of Object.entries(warungAI.questions)) {
                if (message.includes(question)) {
                    return answer;
                }
            }
            
            // Cek kategori umum
            if (message.includes('halo') || message.includes('hai') || message.includes('hi') || message.includes('hello')) {
                return getRandomResponse(warungAI.greetings);
            }
            
            if (message.includes('makasih') || message.includes('terima kasih') || message.includes('thanks') || message.includes('thank you')) {
                return getRandomResponse(warungAI.thanks);
            }
            
            if (message.includes('keren') || message.includes('mantap') || message.includes('hebat')) {
                return getRandomResponse(warungAI.compliments);
            }
            
            if (message.includes('tahu') || message.includes('fakta') || message.includes('info')) {
                return getRandomResponse(warungAI.randomFacts);
            }
            
            // Default response
            return "Maaf, saya belum paham pertanyaannya. Coba tanya tentang warung atau fitur yang ada! 🤔";
        }
        
        // 🎪 RANDOM RESPONSE HELPER
        function getRandomResponse(responses) {
            return responses[Math.floor(Math.random() * responses.length)];
        }

        function isConversation(text) {
            const conversationPatterns = [
                /siapa\s+(kamu|lu|elo)/i,
                /apa\s+kabar/i, 
                /bagaimana\s+(kabar|keadaan)/i,
                /cerita\s+(tentang|dong)/i,
                /tahu\s+(tentang|gak)/i,
                /fakta\s+(menarik|tentang)/i,
                /bisa\s+(apa|ngapain)/i,
                /halo|hai|hi|hello|hey/i,
                /makasih|terima kasih|thanks|thank you/i,
                /(halo|hai|hi|hello|hey)\s+jarvis/i,
                /bisakah\s+kita\s+ngobrol/i,
                /like yu|mantap|keren|anjay/i
            ];
            
            return conversationPatterns.some(pattern => pattern.test(text));
        }

        // 🧠 BUSINESS ADVISOR KNOWLEDGE
        const businessAdvisor = {
            revenueTips: [
                "💡 **TIPS NAIKKAN OMSET:**\n• Bundling produk (contoh: kopi + gula)\n• Loyalty program untuk pelanggan tetap\n• Promo 'beli 2 gratis 1' untuk barang slow moving\n• Display produk paling laku di depan\n• Sediakan layanan delivery lokal",
                
                "🚀 **STRATEGI PENINGKATAN PENJUALAN:**\n• Catat jam sibuk, fokus promosi di jam tersebut\n• Buat paket 'menu harian' dengan harga spesial\n• Manfaatkan media sosial untuk promosi\n• Kerjasama dengan driver ojol untuk jangkauan lebih luas\n• Sediakan produk unik yang tidak ada di warung lain",
                
                "📈 **OPTIMASI OPERASIONAL:**\n• Gunakan aplikasi ini untuk track stok real-time\n• Analisis barang paling menguntungkan dengan fitur statistik\n• Atur layout warung agar produk impian mudah dilihat\n• Training kasir untuk service excellence\n• Implement sistem pre-order untuk barang langganan"
            ],
            
            customerTips: [
                "👥 **MANAJEMEN PELANGGAN:**\n• Ingat nama pelanggan tetap & preferensi mereka\n• Beri diskon kecil untuk pelanggan setia\n• Sediakan tempat duduk nyaman untuk ngobrol\n• Terima masukan & keluhan dengan senang hati\n• Buat program 'refer a friend' dapat bonus",
                
                "⭐ **CUSTOMER EXPERIENCE:**\n• Selalu sapa pelanggan dengan ramah\n• Pastikan area warung bersih & tertata rapi\n• Kasih sample gratis untuk produk baru\n• Sediakan layanan tambahan (isi pulsa, bayar tagihan)\n• Response cepat untuk pertanyaan & permintaan"
            ],
            
            inventoryTips: [
                "📦 **MANAJEMEN STOK CERDAS:**\n• Gunakan fitur 'stok' untuk monitor real-time\n• Restock sebelum stok < 5 (gunakan alert system)\n• Prioritaskan barang dengan turnover rate tinggi\n• Negotiate harga better dengan supplier untuk bulk order\n• Implement FIFO (First In First Out) system",
                
                "💰 **OPTIMASI PEMBELIAN:**\n• Analisis riwayat penjualan untuk forecast demand\n• Beli dalam quantity besar untuk barang pasti laku\n• Diversifikasi supplier untuk harga kompetitif\n• Manfaatkan promo dari distributor\n• Monitor expiry date untuk hindari kerugian"
            ],
            
            pricingStrategies: [
                "💲 **STRATEGI HARGA:**\n• Psychological pricing (Rp 9.900 bukan Rp 10.000)\n• Bundle pricing untuk produk complementary\n• Dynamic pricing berdasarkan waktu (harga berbeda weekend/weekday)\n• Competitor benchmarking\n• Value-based pricing untuk produk unik",
                
                "🎯 **PROMO & DISKON:**\n• 'Happy hour' discount di jam sepi\n• Flash sale untuk barang mau expired\n• Member discount untuk loyalitas\n• Seasonal promotion (lebaran, natal, tahun baru)\n• Cross-promotion dengan bisnis tetangga"
            ],
            
            marketAnalysis: function() {
                const topItems = getTopSellingItems().slice(0, 3);
                const lowStock = barangList.filter(b => b.stok < 5);
                const revenue = calculateMonthlyRevenue();
                
                return `📊 **ANALISIS PASAR WARUNG ANDA:**\n\n` +
                       `🏆 **TOP 3 PRODUCTS:**\n${topItems.map((item, i) => `${i+1}. ${item.nama} (${item.totalSold} pcs)`).join('\n')}\n\n` +
                       `⚠️ **PERHATIAN:** ${lowStock.length > 0 ? `Stok mau habis: ${lowStock.map(i => i.nama).join(', ')}` : 'Semua stok aman'}\n\n` +
                       `💡 **REKOMENDASI:** Fokus promosi pada ${topItems[0]?.nama || 'produk terlaris'} dan restock ${lowStock.map(i => i.nama).join(', ')}`;
            },
            
            restockStrategy: function() {
                const fastMoving = getTopSellingItems().slice(0, 5);
                const slowMoving = barangList
                    .filter(b => b.stok > 10) // Stok banyak tapi mungkin slow moving
                    .sort((a, b) => b.stok - a.stok)
                    .slice(0, 3);
                    
                return `🔄 **STRATEGI RESTOCK:**\n\n` +
                       `🚀 **FAST MOVING (Priority):**\n${fastMoving.map(item => `• ${item.nama} - restock rutin`).join('\n')}\n\n` +
                       `🐢 **SLOW MOVING (Evaluate):**\n${slowMoving.map(item => `• ${item.nama} - kurangi order, coba promo`).join('\n')}\n\n` +
                       `💡 **TIP:** Gunakan fitur 'stok' untuk auto-monitor & 'laporan' untuk analisis mendalam`;
            }
        };
        
        // 🧠 BUSINESS ADVISOR FUNCTIONS
        function generateBusinessAdvice(category, transcript = '') {
            try {
                let advice = '';
                
                switch(category) {
                    case 'businessTips':
                        advice = getRandomResponse(businessAdvisor.revenueTips);
                        break;
                        
                    case 'businessStrategy':
                        advice = getRandomResponse([...businessAdvisor.revenueTips, ...businessAdvisor.customerTips]);
                        break;
                        
                    case 'increaseRevenue':
                        advice = getRandomResponse(businessAdvisor.revenueTips);
                        break;
                        
                    case 'businessProfit':
                        advice = getRandomResponse([...businessAdvisor.revenueTips, ...businessAdvisor.pricingStrategies]);
                        break;
                        
                    case 'restockStrategy':
                        advice = businessAdvisor.restockStrategy();
                        break;
                        
                    case 'marketAnalysis':
                        advice = businessAdvisor.marketAnalysis();
                        break;
                        
                    default:
                        advice = "💡 **TIPS BISNIS WARUNG:**\n• Manfaatkan fitur voice commands untuk efisiensi\n• Analisis data penjualan secara rutin\n• Jaga hubungan baik dengan pelanggan\n• Terus berinovasi dengan produk & layanan";
                }
                
                return advice;
                
            } catch (error) {
                return "⚠️ Maaf, sistem advisor sedang sibuk. Coba lagi sebentar!";
            }
        }
        
        // 🎯 PROCESS BUSINESS QUERIES
        function processBusinessQuery(transcript) {
            const cleanText = transcript.toLowerCase();
            
            // Deteksi intent dari kata kunci
            if (cleanText.includes('naik') && cleanText.includes('omset')) {
                return generateBusinessAdvice('increaseRevenue');
            }
            
            if (cleanText.includes('restock') || cleanText.includes('stok')) {
                return generateBusinessAdvice('restockStrategy');
            }
            
            if (cleanText.includes('analisis') || cleanText.includes('pasar')) {
                return generateBusinessAdvice('marketAnalysis');
            }
            
            if (cleanText.includes('strategi') || cleanText.includes('tips')) {
                return generateBusinessAdvice('businessTips');
            }
            
            if (cleanText.includes('profit') || cleanText.includes('untung')) {
                return generateBusinessAdvice('businessProfit');
            }
            
            // Default business advice
            return generateBusinessAdvice('businessTips');
        }

        // 🧮 ADVANCED CALCULATOR - Understand natural language
        function processCalculation(transcript) {
            const cleanText = transcript.toLowerCase();
            
            console.log('🧮 Processing calculation:', cleanText);
            
            // 🎯 PATTERN MATCHING YANG LEBIH BANYAK
            const patterns = [
                // Pattern: "2 kali 3" atau "2 x 3" atau "2 dikali 3"
                { regex: /(\d+[.,]?\d*)\s*(kali|dikali|x|×)\s*(\d+[.,]?\d*)/, operation: '*' },
                
                // Pattern: "2 tambah 3" atau "2 + 3" atau "2 ditambah 3"  
                { regex: /(\d+[.,]?\d*)\s*(tambah|ditambah|\+)\s*(\d+[.,]?\d*)/, operation: '+' },
                
                // Pattern: "2 kurang 3" atau "2 - 3" atau "2 dikurang 3"
                { regex: /(\d+[.,]?\d*)\s*(kurang|dikurang|-)\s*(\d+[.,]?\d*)/, operation: '-' },
                
                // Pattern: "2 bagi 3" atau "2 / 3" atau "2 dibagi 3"
                { regex: /(\d+[.,]?\d*)\s*(bagi|dibagi|\/|÷)\s*(\d+[.,]?\d*)/, operation: '/' },
                
                // 🆕 PATTERN NATURAL: "dua ribu kali tiga ribu"
                { regex: /(\d+[.,]?\d*)\s+(kali|tambah|kurang|bagi)\s+(\d+[.,]?\d*)/, operation: 'auto' }
            ];
            
            for (let pattern of patterns) {
                const match = cleanText.match(pattern.regex);
                if (match) {
                    console.log('🎯 Pattern matched:', pattern.operation, match);
                    
                    // Parse angka (support koma dan titik)
                    let num1 = parseNumber(match[1]);
                    let num2 = parseNumber(match[3]);
                    let operation = pattern.operation;
                    
                    // Auto detect operation dari kata
                    if (operation === 'auto') {
                        if (match[2] === 'kali') operation = '*';
                        else if (match[2] === 'tambah') operation = '+';
                        else if (match[2] === 'kurang') operation = '-';
                        else if (match[2] === 'bagi') operation = '/';
                    }
                    
                    let result, symbol;
                    
                    switch(operation) {
                        case '+': 
                            result = num1 + num2; 
                            symbol = '+';
                            break;
                        case '-': 
                            result = num1 - num2; 
                            symbol = '-';
                            break;
                        case '*': 
                            result = num1 * num2; 
                            symbol = '×';
                            break;
                        case '/': 
                            if (num2 === 0) {
                                showVoiceStatus('error', '❌ Tidak bisa dibagi nol!');
                                return;
                            }
                            result = num1 / num2; 
                            symbol = '÷';
                            break;
                    }
                    
                    // Format result dengan separator ribuan
                    const formattedResult = formatNumber(result);
                    const formattedNum1 = formatNumber(num1);
                    const formattedNum2 = formatNumber(num2);
                    
                    showVoiceStatus('success', `🧮 ${formattedNum1} ${symbol} ${formattedNum2} = ${formattedResult} ✅`);
                    
                    // Auto copy ke nominal pembeli
                    setTimeout(() => {
                        const nominalInput = document.getElementById('nominal-pembeli');
                        if (nominalInput && document.getElementById('penjualan').classList.contains('active')) {
                            nominalInput.value = formattedResult;
                            hitungKembalian();
                        }
                    }, 500);
                    
                    return;
                }
            }
            
            // 🆕 JIKA GAK ADA YANG MATCH, COBA CARI ANGKA & OPERASI MANUAL
            tryManualCalculation(cleanText);
        }
        
        // 🆕 FUNGSI PARSE NUMBER UNTUK SUPPORT RIBUAN
        function parseNumber(numStr) {
            // Support: "1.000", "2,500", "1000000", "1 000"
            let cleanNum = numStr.toString()
                .replace(/\./g, '')  // Hapus titik (1.000 → 1000)
                .replace(/,/g, '.')  // Ganti koma dengan titik (2,5 → 2.5)
                .replace(/\s/g, ''); // Hapus spasi (1 000 → 1000)
            
            return parseFloat(cleanNum) || 0;
        }
        
        // 🆕 FUNGSI FORMAT NUMBER DENGAN SEPARATOR RIBUAN
        function formatNumber(num) {
            return num.toLocaleString('id-ID');
        }
        
        // 🆕 FUNGSI MANUAL CALCULATION FALLBACK
        function tryManualCalculation(text) {
            console.log('🔧 Trying manual calculation for:', text);
            
            // Extract semua angka
            const numbers = text.match(/(\d+[.,]?\d*)/g);
            if (!numbers || numbers.length < 2) {
                showVoiceStatus('error', '❌ Butuh 2 angka untuk dihitung!');
                return;
            }
            
            const num1 = parseNumber(numbers[0]);
            const num2 = parseNumber(numbers[1]);
            
            // Deteksi operasi dari kata kunci
            let operation, symbol;
            
            if (text.includes('kali') || text.includes('x') || text.includes('dikali')) {
                operation = '*'; symbol = '×';
            } 
            else if (text.includes('tambah') || text.includes('+') || text.includes('ditambah')) {
                operation = '+'; symbol = '+';
            }
            else if (text.includes('kurang') || text.includes('-') || text.includes('dikurang')) {
                operation = '-'; symbol = '-';
            }
            else if (text.includes('bagi') || text.includes('/') || text.includes('dibagi')) {
                operation = '/'; symbol = '÷';
            }
            else {
                showVoiceStatus('error', '❌ Sebut operasinya! (tambah/kurang/kali/bagi)');
                return;
            }
            
            // Calculate
            let result;
            switch(operation) {
                case '+': result = num1 + num2; break;
                case '-': result = num1 - num2; break;
                case '*': result = num1 * num2; break;
                case '/': 
                    if (num2 === 0) {
                        showVoiceStatus('error', '❌ Tidak bisa dibagi nol!');
                        return;
                    }
                    result = num1 / num2; 
                    break;
            }
            
            const formattedResult = formatNumber(result);
            const formattedNum1 = formatNumber(num1);
            const formattedNum2 = formatNumber(num2);
            
            showVoiceStatus('success', `🧮 ${formattedNum1} ${symbol} ${formattedNum2} = ${formattedResult} ✅`);
            
            // Auto copy ke nominal pembeli
            setTimeout(() => {
                const nominalInput = document.getElementById('nominal-pembeli');
                if (nominalInput && document.getElementById('penjualan').classList.contains('active')) {
                    nominalInput.value = formattedResult;
                    hitungKembalian();
                }
            }, 500);
        }
        
        // 🧮 SCIENTIFIC CALCULATOR FUNCTION
        function processScientificCalculation(transcript) {
            const cleanText = transcript.toLowerCase();
            
            try {
                console.log('🧮 Processing scientific calculation:', cleanText);
                
                // Convert voice command ke math expression
                let mathExpression = convertVoiceToMath(cleanText);
                console.log('🔢 Math Expression:', mathExpression);
                
                // Evaluate dengan safety check
                const result = safeScientificCalc(mathExpression);
                
                // Format dan tampilkan hasil
                const formattedResult = formatNumber(result);
                const displayExpression = mathExpression.replace(/\*/g, '×').replace(/\//g, '÷');
                
                showVoiceStatus('success', `🧮 ${displayExpression} = ${formattedResult} ✅`);
                
                // Auto copy ke nominal pembeli jika di section penjualan
                setTimeout(() => {
                    const nominalInput = document.getElementById('nominal-pembeli');
                    if (nominalInput && document.getElementById('penjualan').classList.contains('active')) {
                        nominalInput.value = formattedResult;
                        hitungKembalian();
                    }
                }, 500);
                
            } catch (error) {
                console.error('Scientific calculation error:', error);
                showVoiceStatus('error', '❌ ' + error.message);
            }
        }
        
        // 🔄 CONVERT VOICE TO MATH EXPRESSION
        function convertVoiceToMath(voiceText) {
            let expression = voiceText
                .replace(/tambah|ditambah/gi, '+')
                .replace(/kurang|dikurang/gi, '-')
                .replace(/kali|dikali|x/gi, '*')
                .replace(/bagi|dibagi/gi, '/')
                .replace(/koma/gi, '.')
                .replace(/\s+/g, '');
            
            // 🆕 SUPPORT "ribu", "juta", "miliar", "triliun"
            expression = expression
                .replace(/(\d+(?:\.\d+)?)\s*ribu/gi, '($1*1000)')
                .replace(/(\d+(?:\.\d+)?)\s*juta/gi, '($1*1000000)')
                .replace(/(\d+(?:\.\d+)?)\s*miliar/gi, '($1*1000000000)')
                .replace(/(\d+(?:\.\d+)?)\s*triliun/gi, '($1*1000000000000)');
            
            // Handle angka ribuan (1.000 → 1000)
            expression = expression.replace(/(\d+)\.(\d{3})/g, '$1$2');
            
            console.log('🔢 Converted expression:', expression);
            return expression;
        }
        
        // 🛡️ SAFE SCIENTIFIC CALCULATOR
        function safeScientificCalc(expression) {
            try {
                // 🛡️ SAFETY CHECK - Only allow math characters
                const safeExpression = expression.replace(/[^0-9+\-*/().]/g, '');
                
                if (safeExpression !== expression.replace(/\s/g, '')) {
                    throw new Error('Karakter tidak valid terdeteksi');
                }
                
                // 🧮 EVALUATE dengan Function constructor
                const result = Function(`"use strict"; return (${safeExpression})`)();
                
                // Validasi result
                if (isNaN(result)) {
                    throw new Error('Hasil perhitungan tidak valid (NaN)');
                }
                
                if (!isFinite(result)) {
                    throw new Error('Hasil perhitungan tak terhingga');
                }
                
                return result;
                
            } catch (error) {
                throw new Error('Error perhitungan: ' + error.message);
            }
        }
        
        // 🆕 FUNCTION CEK PERHITUNGAN KOMPLEKS
        function isComplexCalculation(text) {
            const operators = text.match(/(tambah|kurang|kali|bagi|\+|-|\*|\/)/g) || [];
            const numbers = text.match(/(\d+[.,]?\d*)/g) || [];
            
            return operators.length >= 2 && numbers.length >= 3;
        }
        // 🪟 MODAL VERSI SUPPORT ICON & HTML
        function showInfo(content) {
            const modal = document.getElementById('custom-modal');
            const modalBody = document.getElementById('modal-body');
            
            // 🎨 MODAL SETUP
            let titleHTML = `<i class="fas fa-info-circle"></i> Informasi`;
            
            if (content.includes('💰') || content.includes('omset') || content.includes('laba')) {
                titleHTML = `<i class="fas fa-chart-line"></i> Laporan Keuangan`;
            }
            if (content.includes('📊') || content.includes('laporan')) {
                titleHTML = `<i class="fas fa-chart-bar"></i> Laporan Lengkap`;
            }
            if (content.includes('🎙️') || content.includes('bantuan') || content.includes('tutorial')) {
                titleHTML = `<i class="fas fa-microphone"></i> Voice Commands`;
            }
            if (content.includes('🏪') || content.includes('bisnis') || content.includes('tips')) {
                titleHTML = `<i class="fas fa-store"></i> Business Advisor`;
            }
            if (content.includes('📦') || content.includes('stok') || content.includes('inventory')) {
                titleHTML = `<i class="fas fa-boxes"></i> Info Stok`;
            }
            if (content.includes('🧮') || content.includes('hitung') || content.includes('kalkulator')) {
                titleHTML = `<i class="fas fa-calculator"></i> Kalkulator`;
            }
            if (content) {
                titleHTML = `<i class="fas fa-robot"></i> J.A.R.V.I.S.`;
            }
            
            document.getElementById('modal-title').innerHTML = titleHTML;
            modalBody.innerHTML = content.replace(/\n/g, '<br>');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            
            // 🎙️ HYBRID SPEECH - HELP SUMMARY, LAINNYA FULL
            if (isSpeechEnabled) {
                setTimeout(() => {
                    // 🎙️ KHUSUS VOICE HELP - SUMMARY
                    if (content.includes('VOICE COMMANDS') || content.includes('🎙️ **VOICE COMMANDS:**')) {
                        const summary = `Voice commands tersedia untuk print, transaksi, navigasi, kalkulator, dan laporan. 
                     Katakan print untuk cetak struk, bayar untuk transaksi, hitung untuk kalkulator.
                     Untuk bantuan lengkap, lihat di layar.`;
                        speakText(summary);
                    } 
                    // 🎯 YANG LAIN - BACA NORMAL SEPENUHNYA
                    else {
                        let cleanContent = content
                            .replace(/[🎙️🖨️⚡📱🧮💬💰📦🔍📊🎓🏪💡🔊🎯🚀🎛️🎨📈🎪📅🏆📝🛒💳⭐📞😄💼🔧🎛️🆕ℹ️😊🎭📞🛍️💾📁🔍🎤🤖🧮📟💵💸🏪👥💲🎯📦🚀🧠💪✨🔧🎭🎊🎉✅❌⚠️🗑️📦🚨🎯🆕🏆📈🎓📝🧠💡📊💰💳📱⭐💹🔍🎯🆕🏆📈🎓📝🧠💡=*]/g, '')
                            .replace(/\*\*(.*?)\*\*/g, '$1')
                            .replace(/\n/g, '. ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        speakText(cleanContent);
                    }
                }, 2000);
            }
        }
        
        // 🎯 FUNGSI TUTUP TETAP SAMA
        function closeCustomModal() {
            document.getElementById('custom-modal').style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        // Close modal ketika klik di luar content
        document.getElementById('custom-modal').addEventListener('click', function(event) {
            if (event.target === this) {
                closeCustomModal();
            }
        });

        // 🎛️ TAMBAH TOMBOL TOGGLE SUARA DI UI
        function addVoiceToggleButton() {
            const voiceBtn = document.getElementById('voice-command-btn');
            const toggleBtn = document.createElement('button');
            
            toggleBtn.innerHTML = '🔊';
            toggleBtn.className = 'voice-command-fixed';
            toggleBtn.style.top = '130px'; // Posisi di bawah mic button
            toggleBtn.style.background = 'linear-gradient(135deg, #2196F3, #0D47A1)';
            toggleBtn.title = 'Toggle Suara';
            
            toggleBtn.onclick = function() {
                const isOn = toggleSpeech();
                toggleBtn.innerHTML = isOn ? '🔊' : '🔇';
                toggleBtn.style.background = isOn ? 
                    'linear-gradient(135deg, #2196F3, #0D47A1)' : 
                    'linear-gradient(135deg, #FF9800, #E65100)';
            };
            
            document.body.appendChild(toggleBtn);
        }
        
        // Panggil saat load
        document.addEventListener('DOMContentLoaded', function() {
            addVoiceToggleButton();
        });

        // 🎙️ TEXT-TO-SPEECH SYSTEM
        let speechSynthesis = window.speechSynthesis;
        let isSpeechEnabled = true;
        
        function speakText(text, rate = 1.0, pitch = 1.0) {
            if (!isSpeechEnabled || !speechSynthesis) return;
            
            // Stop speaking sebelumnya
            speechSynthesis.cancel();
            
            // Buat utterance baru
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID'; // Bahasa Indonesia
            utterance.rate = rate;    // Kecepatan (0.1 - 2.0)
            utterance.pitch = pitch;  // Nada (0 - 2)
            utterance.volume = 0.8;   // Volume (0.0 - 1.0)
            
            // Event handlers
            utterance.onstart = () => {
                console.log('🔊 Mulai berbicara:', text);
            };
            
            utterance.onend = () => {
                console.log('🔊 Selesai berbicara');
            };
            
            utterance.onerror = (event) => {
                console.error('🔊 Error speech:', event);
            };
            
            // Mulai bicara
            speechSynthesis.speak(utterance);
        }
        
        // 🎛️ TOGGLE SPEECH FUNCTION
        function toggleSpeech() {
            isSpeechEnabled = !isSpeechEnabled;
            if (!isSpeechEnabled) {
                speechSynthesis.cancel();
            }
            showVoiceStatus('success', isSpeechEnabled ? '🔊 Suara diaktifkan' : '🔇 Suara dimatikan');
            return isSpeechEnabled;
        }

        // 🎨 THEME MANAGER
        const themes = {
            'normal': 'style.css',
            'estetik': 'theme-estetik.css', 
            'elegan': 'theme-elegan.css'
        };
        
        let currentTheme = 'normal';
        
        // 🎨 THEME SWITCHER FUNCTIONS
        function showThemeSwitcher() {
            const modal = document.getElementById('theme-switcher-modal');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            updateThemeBadges();
        }
        
        function closeThemeSwitcher() {
            const modal = document.getElementById('theme-switcher-modal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        function updateThemeBadges() {
            const badges = {
                'normal': document.getElementById('badge-normal'),
                'estetik': document.getElementById('badge-estetik'),
                'elegan': document.getElementById('badge-elegan')
            };
            
            // Reset semua badge
            Object.values(badges).forEach(badge => {
                badge.textContent = 'Pilih';
                badge.style.background = 'var(--border-color)';
                badge.style.color = 'var(--text-muted)';
            });
            
            // Highlight tema aktif
            if (badges[currentTheme]) {
                badges[currentTheme].textContent = '✓ Aktif';
                badges[currentTheme].style.background = 'var(--success-color)';
                badges[currentTheme].style.color = 'white';
            }
        }
        
        function switchTheme(themeName) {
            if (!themes[themeName]) return;
            
            const themeLink = document.getElementById('main-theme');
            themeLink.href = themes[themeName];
            currentTheme = themeName;
            
            // Simpan preference
            localStorage.setItem('selectedTheme', themeName);
            
            // Update UI
            updateThemeBadges();
            
            // Voice feedback
            showVoiceStatus('success', `🎨 Tema diubah ke: ${themeName}`);
            speakText(`Tema diubah ke ${themeName}`);
        }
        
        function testCurrentTheme() {
            speakText(`Ini adalah suara test dengan tema ${currentTheme}. Suara tetap sama untuk semua tema.`);
        }
        
        // Close modal ketika klik di luar
        document.getElementById('theme-switcher-modal').addEventListener('click', function(event) {
            if (event.target === this) {
                closeThemeSwitcher();
            }
        });

        function loadSavedTheme() {
            const savedTheme = localStorage.getItem('selectedTheme');
            if (savedTheme && themes[savedTheme]) {
                console.log('🎨 Loading saved theme:', savedTheme);
                switchTheme(savedTheme);
            } else {
                console.log('🎨 Using default theme: normal');
                switchTheme('normal');
            }
        }

        window.addEventListener('load', loadAll);

        console.log('[Splash Template] Starting template initialization...');
        
        // ===== CONFIGURATION =====
        const CONFIG = {
            APP_NAME: 'Aplikasi Manajemen Warung',
            BRAND_NAME: 'Al Sakho ™',
            SPLASH_DURATION: 5000,
            ANIMATION_PATH: 'toko.json',
            TYPEWRITER_SPEEDS: {
                MAIN_TEXT: 80,  // Sedikit lebih lambat biar smooth
                SUB_TEXT: 90    // Sedikit lebih lambat
            },
            DELAYS: {
                SPLASH_START: 500,
                SUB_TEXT_START: 2000,  // Delay lebih panjang biar lebih dramatis
                CONTENT_FADE_IN: 6500
            }
        };
        
        console.log('[Config] Configuration loaded:', CONFIG);
        
        // ===== SMOOTH TYPEWRITER FUNCTION =====
        function runTypeWriter(el, text, speed = 80) {
            console.log(`[TypeWriter] Starting SMOOTH animation for: "${text}"`);
            
            let i = 0;
            el.innerHTML = '';
            el.style.width = 'auto';
            el.classList.add('typeWriter');
            el.classList.add('smooth-appear'); // Tambah efek smooth
            
            function typeCharacter() {
                if (i < text.length) {
                    // Efek sound mental (bisa ditambah audio kalo mau)
                     //playTypeSound(); // Uncomment kalo mau ada sound
                    
                    el.innerHTML += text.charAt(i);
                    i++;
                    
                    // Random slight delay untuk efek natural
                    const randomDelay = speed + (Math.random() * 20 - 10);
                    setTimeout(typeCharacter, randomDelay);
                } else {
                    console.log(`[TypeWriter] Smooth animation completed`);
                    // Biarkan cursor blink beberapa kali sebelum hilang
                    setTimeout(() => {
                        el.style.borderRight = 'none';
                        el.classList.remove('typeWriter');
                    }, 1000);
                }
            }
            
            typeCharacter();
        }
        
        // ===== SPLASH SCREEN HANDLER =====
        function showSplashScreen() {
            console.log('[Splash] Checking splash screen...');
            
            const splash = document.getElementById('splash-screen');
            const animContainer = document.getElementById('lottie-animation');
            const mainContent = document.getElementById('main-content');
            
            if (!splash || !animContainer) {
                console.error('[Splash] Splash elements not found!');
                return;
            }
            
            if (sessionStorage.getItem('splashShown')) {
                console.log('[Splash] Splash already shown in this session, skipping...');
                splash.style.display = 'none';
                if (mainContent) {
                    mainContent.style.display = 'block';
                }
                return;
            }
            
            console.log('[Splash] Showing splash screen with SMOOTH typing...');
            
            // Load Lottie animation
            let anim;
            try {
                anim = lottie.loadAnimation({
                    container: animContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: CONFIG.ANIMATION_PATH
                });
                console.log('[Splash] Lottie animation loaded successfully');
            } catch (error) {
                console.error('[Splash] Error loading Lottie animation:', error);
                animContainer.innerHTML = '<div style="color: white; font-size: 48px; font-weight: bold;">✨</div>';
            }
            
            // Show splash screen
            splash.style.display = 'flex';
            splash.classList.remove('splash-hidden');
            sessionStorage.setItem('splashShown', 'true');
            
            // Start SMOOTH typewriter animations
            requestAnimationFrame(() => {
                setTimeout(() => {
                    runTypeWriter(
                        document.getElementById('splash-text'),
                        CONFIG.APP_NAME,
                        CONFIG.TYPEWRITER_SPEEDS.MAIN_TEXT
                    );
                    
                    setTimeout(() => {
                        runTypeWriter(
                            document.getElementById('splash-subtext'),
                            CONFIG.BRAND_NAME,
                            CONFIG.TYPEWRITER_SPEEDS.SUB_TEXT
                        );
                    }, CONFIG.DELAYS.SUB_TEXT_START);
                }, 300); // Initial delay biar lebih dramatis
            });
            
            // Hide splash screen after configured duration
            setTimeout(() => {
                console.log('[Splash] Hiding splash screen');
                splash.classList.add('splash-hidden');
                
                if (anim) anim.stop();
                
                setTimeout(() => {
                    splash.style.display = 'none';
                    if (mainContent) {
                        mainContent.style.display = 'block';
                    }
                    console.log('[Splash] Main content displayed');
                }, 500);
            }, CONFIG.SPLASH_DURATION);
        }
        
        // ===== INITIALIZATION =====
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[Template] DOM ready, starting SMOOTH splash...');
            
            setTimeout(() => {
                showSplashScreen();
            }, CONFIG.DELAYS.SPLASH_START);
        });
        
        console.log('[Template] Smooth splash template loaded successfully');
