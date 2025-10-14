 document.addEventListener('DOMContentLoaded', () => {
            // === KHAI BÁO BIẾN VÀ DOM ELEMENTS ===
            const calendarGrid = document.getElementById('calendarGrid');
            const currentMonthYear = document.getElementById('currentMonthYear');
            const prevMonthBtn = document.getElementById('prevMonth');
            const nextMonthBtn = document.getElementById('nextMonth');

            const modal = document.getElementById('entryModal');
            const closeModalBtn = document.getElementById('closeModal');
            const modalDate = document.getElementById('modalDate');
            const entryForm = document.getElementById('entryForm');
            const recordsList = document.getElementById('recordsList');

            const totalTradeEl = document.getElementById('totalTrade');
            const totalClaimEl = document.getElementById('totalClaim');
            const totalProfitEl = document.getElementById('totalProfit');
            const usdToVndRateInput = document.getElementById('usdToVndRate');

            const rateLabel = document.getElementById('rateLabel');

            const currentBalanceUSD_El = document.getElementById('currentBalanceUSD');
            const currentBalanceVND_El = document.getElementById('currentBalanceVND');

            const startBalanceInput = document.getElementById('startBalance');
            const endBalanceInput = document.getElementById('endBalance');
            const isClaimCheckbox = document.getElementById('isClaimCheckbox');
            const tradeAmountInput = document.getElementById('tradeAmount');
            const claimAmountInput = document.getElementById('claimAmount');
            const notesInput = document.getElementById('notes');
            const recordIdInput = document.getElementById('recordId');
            const volumeSelect = document.getElementById('volumeSelect');
            const saveRecordBtn = document.getElementById('saveRecordBtn');
            const chartPeriodContainer = document.getElementById('chartPeriodContainer');

            // THÊM MỚI: Elements cho Dark Mode Toggle
            const themeToggle = document.getElementById('themeToggle');
            const themeIconWrapper = document.getElementById('themeIconWrapper');


            let currentDate = new Date();
            let selectedDate = null;
            let records = JSON.parse(localStorage.getItem('alphaRecords')) || {};
            let balanceChart = null;
            let currentChartPeriod = 'day';

            // === CÁC HÀM XỬ LÝ DARK MODE ===

            function applyTheme(isDark) {
                if (isDark) {
                    document.documentElement.classList.add('dark');
                    themeToggle.checked = true;
                    themeIconWrapper.innerHTML = '<i data-lucide="moon" class="w-4 h-4 text-white"></i>';
                } else {
                    document.documentElement.classList.remove('dark');
                    themeToggle.checked = false;
                    themeIconWrapper.innerHTML = '<i data-lucide="sun" class="w-4 h-4 text-yellow-500"></i>';
                }
                lucide.createIcons();
                updateStatsAndChart(); // Vẽ lại biểu đồ với màu sắc đúng
            }

            function setupTheme() {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
                applyTheme(isDark);
            }

            // === CÁC HÀM XỬ LÝ DỮ LIỆU ===

            function saveRecords() {
                localStorage.setItem('alphaRecords', JSON.stringify(records));
            }

            function formatDateKey(date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            async function fetchExchangeRate() {
                usdToVndRateInput.classList.add('opacity-50');
                rateLabel.textContent = 'Tỷ giá P2P (Binance):';
                try {
                    const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fiat: "VND", page: 1, rows: 1, tradeType: "SELL", asset: "USDT", transAmount: "5000000", publisherType: null }),
                    });
                    if (!response.ok) throw new Error('Binance P2P API response was not ok');
                    const data = await response.json();
                    if (data?.data?.length > 0) {
                        usdToVndRateInput.value = Math.round(parseFloat(data.data[0].adv.price));
                    } else { throw new Error('Không tìm thấy dữ liệu giá P2P.'); }
                } catch (p2pError) {
                    console.warn('Lỗi khi lấy tỷ giá P2P Binance, thử lấy tỷ giá hiện hành...', p2pError);
                    rateLabel.textContent = 'Tỷ giá hiện hành (fallback):';
                    try {
                        const fallbackResponse = await fetch('https://open.er-api.com/v6/latest/USD');
                        if (!fallbackResponse.ok) throw new Error('API tỷ giá hiện hành không hoạt động.');
                        const fallbackData = await fallbackResponse.json();
                        if (fallbackData.rates.VND) {
                            usdToVndRateInput.value = Math.round(fallbackData.rates.VND);
                        } else { throw new Error('Không tìm thấy tỷ giá VND trong API fallback.'); }
                    } catch (fallbackError) {
                        console.error('Lỗi khi lấy tỷ giá hiện hành. Sử dụng giá trị mặc định.', fallbackError);
                        rateLabel.textContent = 'Tỷ giá (mặc định):';
                        usdToVndRateInput.value = 25300;
                    }
                } finally {
                    usdToVndRateInput.classList.remove('opacity-50');
                    updateStatsAndChart();
                }
            }

            function calculateAmounts() {
                const startBalance = parseFloat(startBalanceInput.value);
                const endBalance = parseFloat(endBalanceInput.value);

                if (isNaN(startBalance) || isNaN(endBalance)) {
                    tradeAmountInput.value = '';
                    claimAmountInput.value = '';
                    return;
                }

                const difference = endBalance - startBalance;

                if (isClaimCheckbox.checked) {
                    claimAmountInput.value = difference.toFixed(2);
                    tradeAmountInput.value = '';
                } else {
                    tradeAmountInput.value = difference.toFixed(2);
                    claimAmountInput.value = '';
                }
            }

            function aggregateChartData(dailyData, period) {
                if (period === 'day') return dailyData;
                const aggregated = dailyData.reduce((acc, entry) => {
                    const date = new Date(entry.x + 'T00:00:00');
                    let key = (period === 'month')
                        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                        : `${date.getFullYear()}`;
                    acc[key] = entry;
                    return acc;
                }, {});
                return Object.values(aggregated);
            }


            // === CÁC HÀM RENDER GIAO DIỆN ===

            function renderCalendar() {
                calendarGrid.innerHTML = '';
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                currentMonthYear.textContent = new Date(year, month).toLocaleString('vi-VN', { month: 'long', year: 'numeric' });
                const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                weekDays.forEach(day => {
                    const dayEl = document.createElement('div');
                    dayEl.className = 'text-center font-semibold text-gray-500 dark:text-gray-400 text-sm';
                    dayEl.textContent = day;
                    calendarGrid.appendChild(dayEl);
                });
                const firstDayOfMonth = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let i = 0; i < firstDayOfMonth; i++) calendarGrid.appendChild(document.createElement('div'));
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayEl = document.createElement('div');
                    const date = new Date(year, month, day);
                    const dateKey = formatDateKey(date);

                    const dayClasses = ['calendar-day', 'relative', 'p-2', 'border', 'rounded-lg', 'flex', 'flex-col', 'justify-between', 'h-12', 'md:h-28', 'cursor-pointer', 'hover:bg-indigo-50', 'dark:hover:bg-indigo-900/50'];

                    if (formatDateKey(new Date()) === dateKey) {
                        dayClasses.push('bg-purple-100', 'dark:bg-purple-900/50', 'border-purple-500');
                    } else {
                        dayClasses.push('bg-white', 'dark:bg-gray-800', 'border-gray-200', 'dark:border-gray-700');
                    }
                    dayEl.className = dayClasses.join(' ');
                    dayEl.dataset.date = dateKey;

                    const dayRecords = records[dateKey] || [];
                    let summaryHtml = '';
                    if (dayRecords.length > 0) {
                        const start = dayRecords[0].startBalance;
                        const end = dayRecords[dayRecords.length - 1].endBalance;
                        const profit = end - start;

                        summaryHtml = `
                            <div class="absolute top-1.5 right-1.5 block md:hidden w-2 h-2 bg-red-500 rounded-full"></div>
                            <div class="hidden md:block text-xs mt-auto text-right">
                                <p class="font-mono ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">${profit >= 0 ? '+' : ''}${profit.toFixed(2)}$</p>
                                <p class="text-gray-400 dark:text-gray-500">${end.toFixed(2)}$</p>
                            </div>
                        `;
                    }
                    dayEl.innerHTML = `<span class="font-bold text-gray-900 dark:text-white">${day}</span> ${summaryHtml}`;

                    calendarGrid.appendChild(dayEl);
                }
            }

            function updateStatsAndChart() {
                let totalTrade = 0, totalClaim = 0;
                let currentBalance = 0;
                const dailyChartData = [];
                const sortedDates = Object.keys(records).sort();

                sortedDates.forEach(dateKey => {
                    const dayRecords = records[dateKey];
                    if (dayRecords?.length > 0) {
                        dayRecords.forEach(rec => {
                            totalTrade += rec.tradeAmount || 0;
                            totalClaim += rec.claimAmount || 0;
                        });
                        const lastBalanceOfDay = dayRecords[dayRecords.length - 1].endBalance;
                        dailyChartData.push({ x: dateKey, y: lastBalanceOfDay });
                    }
                });

                totalTradeEl.textContent = `${totalTrade.toFixed(2)} USD`;
                totalClaimEl.textContent = `${totalClaim.toFixed(2)} USD`;

                const totalProfit = totalTrade + totalClaim;
                totalProfitEl.textContent = `${totalProfit.toFixed(2)} USD`;
                if (totalProfit >= 0) {
                    totalProfitEl.className = 'font-mono font-semibold text-green-600 dark:text-green-400';
                } else {
                    totalProfitEl.className = 'font-mono font-semibold text-red-600 dark:text-red-400';
                }

                if (dailyChartData.length > 0) {
                    currentBalance = dailyChartData[dailyChartData.length - 1].y;
                }
                const rate = parseFloat(usdToVndRateInput.value) || 25300;
                const currentBalanceVND = currentBalance * rate;

                currentBalanceUSD_El.textContent = `${currentBalance.toFixed(2)} $`;
                currentBalanceVND_El.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentBalanceVND);

                const aggregatedData = aggregateChartData(dailyChartData, currentChartPeriod);
                renderChart(aggregatedData, currentChartPeriod);
            }

            function renderChart(data, period) {
                const ctx = document.getElementById('balanceChart').getContext('2d');
                const rate = parseFloat(usdToVndRateInput.value) || 25300;
                if (balanceChart) balanceChart.destroy();

                const timeUnit = period || 'day';
                const isDark = document.documentElement.classList.contains('dark');
                const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                const tickColor = isDark ? '#9ca3af' : '#4b5567';
                const legendColor = isDark ? '#d1d5db' : '#374151';

                balanceChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: 'Số dư (USDT)', data: data, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.2)', yAxisID: 'y', tension: 0.1
                        }, {
                            label: 'Số dư (VND)', data: data.map(d => ({ x: d.x, y: d.y * rate })), borderColor: 'rgb(167, 139, 250)', backgroundColor: 'rgba(167, 139, 250, 0.2)', fill: true, yAxisID: 'y1', tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: true, interaction: { mode: 'index', intersect: false, },
                        scales: {
                            x: { type: 'time', time: { unit: timeUnit, tooltipFormat: 'dd/MM/yyyy' }, ticks: { color: tickColor }, grid: { color: gridColor } },
                            y: { type: 'linear', position: 'left', ticks: { color: 'rgb(54, 162, 235)', callback: (value) => value + ' $' }, grid: { drawOnChartArea: false } },
                            y1: { type: 'linear', position: 'right', ticks: { color: 'rgb(167, 139, 250)', callback: (value) => new Intl.NumberFormat('vi-VN').format(value / 1000000) + ' Tr' }, grid: { color: gridColor } }
                        },
                        plugins: {
                            legend: { labels: { color: legendColor } },
                            tooltip: { callbacks: { label: (c) => { let l = c.dataset.label || ''; if (l) l += ': '; if (c.parsed.y !== null) l += c.dataset.yAxisID === 'y1' ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(c.parsed.y) : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c.parsed.y); return l; } } }
                        }
                    }
                });
            }

            // === CÁC HÀM XỬ LÝ SỰ KIỆN ===

            function prepareNewRecordForm(dateKey) {
                entryForm.reset();
                recordIdInput.value = '';
                saveRecordBtn.textContent = 'Lưu bản ghi';
                isClaimCheckbox.checked = false;

                const dayRecords = records[dateKey] || [];
                if (dayRecords.length > 0) {
                    const lastRecord = dayRecords[dayRecords.length - 1];
                    startBalanceInput.value = lastRecord.endBalance.toFixed(2);
                } else {
                    const sortedDates = Object.keys(records).sort();
                    const previousDateKey = sortedDates.reverse().find(d => d < dateKey);
                    if (previousDateKey) {
                        const previousDayRecords = records[previousDateKey];
                        if (previousDayRecords?.length > 0) {
                            const previousEndBalance = previousDayRecords[previousDayRecords.length - 1].endBalance;
                            startBalanceInput.value = previousEndBalance.toFixed(2);
                        }
                    }
                }

                calculateAmounts();
                endBalanceInput.focus();
            }

            function openModal(dateKey) {
                selectedDate = dateKey;
                modalDate.textContent = new Date(dateKey + 'T00:00:00').toLocaleDateString('vi-VN');

                renderRecordsForDay(dateKey);
                prepareNewRecordForm(dateKey);

                modal.classList.remove('hidden');
                setTimeout(() => { modal.style.opacity = '1'; modal.querySelector('.modal-content').style.transform = 'scale(1)'; }, 10);
            }

            function closeModal() {
                modal.style.opacity = '0';
                modal.querySelector('.modal-content').style.transform = 'scale(0.95)';
                setTimeout(() => { modal.classList.add('hidden'); }, 300);
            }

            function renderRecordsForDay(dateKey) {
                recordsList.innerHTML = '';
                const dayRecords = records[dateKey] || [];
                if (dayRecords.length === 0) {
                    recordsList.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-500">Chưa có bản ghi nào cho ngày này.</p>';
                    return;
                }
                dayRecords.forEach(rec => {
                    const profit = rec.endBalance - rec.startBalance;
                    const recordEl = document.createElement('div');
                    recordEl.className = 'bg-slate-100 dark:bg-gray-700 p-4 rounded-lg';
                    recordEl.innerHTML = `<div class="flex justify-between items-start"><div><p class="font-bold text-lg ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">Lợi nhuận: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USD</p><p class="text-sm text-gray-500 dark:text-gray-400"><span class="font-mono">${rec.startBalance.toFixed(2)}$</span> → <span class="font-mono">${rec.endBalance.toFixed(2)}$</span></p><p class="text-sm text-gray-500 dark:text-gray-400">Trade: <span class="font-mono">${rec.tradeAmount.toFixed(2)}$</span> | Claim: <span class="font-mono">${rec.claimAmount.toFixed(2)}$</span> ${rec.volume > 0 ? `| Volume: <span class="font-mono">${rec.volume / 1000}k</span>` : ''}</p>${rec.notes ? `<p class="mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-wrap text-sm border-l-2 border-gray-400 dark:border-gray-600 pl-2"><em>${rec.notes}</em></p>` : ''}</div><div class="flex gap-2"><button class="edit-btn p-2 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-full" data-id="${rec.id}"><i data-lucide="file-pen-line" class="w-4 h-4 text-blue-500"></i></button><button class="delete-btn p-2 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-full" data-id="${rec.id}"><i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i></button></div></div>`;
                    recordsList.appendChild(recordEl);
                });
                lucide.createIcons();
            }

            function handleFormSubmit(e) {
                e.preventDefault();
                const recordId = recordIdInput.value;
                const newRecord = {
                    id: recordId ? parseInt(recordId) : Date.now(),
                    startBalance: parseFloat(startBalanceInput.value) || 0,
                    endBalance: parseFloat(endBalanceInput.value) || 0,
                    tradeAmount: parseFloat(tradeAmountInput.value) || 0,
                    claimAmount: parseFloat(claimAmountInput.value) || 0,
                    volume: parseInt(volumeSelect.value) || 0,
                    notes: notesInput.value.trim()
                };

                if (!records[selectedDate]) records[selectedDate] = [];
                if (recordId) {
                    const index = records[selectedDate].findIndex(rec => rec.id === newRecord.id);
                    if (index !== -1) records[selectedDate][index] = newRecord;
                } else {
                    records[selectedDate].push(newRecord);
                }

                records[selectedDate].sort((a, b) => a.id - b.id);
                saveRecords();
                renderCalendar();
                updateStatsAndChart();
                renderRecordsForDay(selectedDate);

                prepareNewRecordForm(selectedDate);
            }

            // === GẮN KẾT CÁC SỰ KIỆN VÀO DOM ELEMENTS ===
            prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
            nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
            calendarGrid.addEventListener('click', (e) => { const dayEl = e.target.closest('.calendar-day'); if (dayEl) openModal(dayEl.dataset.date); });
            closeModalBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
            entryForm.addEventListener('submit', handleFormSubmit);

            startBalanceInput.addEventListener('input', calculateAmounts);
            endBalanceInput.addEventListener('input', calculateAmounts);
            isClaimCheckbox.addEventListener('change', calculateAmounts);

            chartPeriodContainer.addEventListener('click', (e) => {
                const target = e.target.closest('.chart-period-btn');
                if (!target) return;

                chartPeriodContainer.querySelectorAll('.chart-period-btn').forEach(btn => btn.classList.remove('active-chart-btn'));
                target.classList.add('active-chart-btn');

                currentChartPeriod = target.dataset.period;
                updateStatsAndChart();
            });

            recordsList.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-btn');
                const deleteBtn = e.target.closest('.delete-btn');

                if (editBtn) {
                    const recordId = parseInt(editBtn.dataset.id);
                    const record = records[selectedDate].find(rec => rec.id === recordId);
                    if (record) {
                        recordIdInput.value = record.id;
                        startBalanceInput.value = record.startBalance;
                        endBalanceInput.value = record.endBalance;
                        notesInput.value = record.notes;
                        volumeSelect.value = record.volume || 0;
                        isClaimCheckbox.checked = record.claimAmount !== 0;
                        saveRecordBtn.textContent = 'Lưu chỉnh sửa';
                        calculateAmounts();
                        startBalanceInput.focus();
                    }
                }

                if (deleteBtn) {
                    const recordId = parseInt(deleteBtn.dataset.id);
                    records[selectedDate] = records[selectedDate].filter(rec => rec.id !== recordId);
                    if (records[selectedDate].length === 0) delete records[selectedDate];
                    saveRecords();
                    renderRecordsForDay(selectedDate);
                    renderCalendar();
                    updateStatsAndChart();
                }
            });

            themeToggle.addEventListener('change', (e) => {
                const isDark = e.target.checked;
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                applyTheme(isDark);
            });

            async function initializeApp() {
                setupTheme();
                chartPeriodContainer.querySelector('[data-period="day"]').classList.add('active-chart-btn');
                lucide.createIcons();
                renderCalendar();
                await fetchExchangeRate();
            }

            initializeApp();
        });