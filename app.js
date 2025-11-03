// State
let allData = []; // [{ name, data, columns }]
let selectedYColumns = [];
let chart = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const settingsCard = document.getElementById('settingsCard');
const chartCard = document.getElementById('chartCard');
const emptyState = document.getElementById('emptyState');
const xAxisSelect = document.getElementById('xAxisSelect');
const yAxisColumns = document.getElementById('yAxisColumns');
const chartTypeSelect = document.getElementById('chartTypeSelect');
const exportButton = document.getElementById('exportButton');
const resetButton = document.getElementById('resetButton');

// --- File Upload ---
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    allData = [];
    fileStatus.textContent = `Bezig met laden...`;

    for (const file of files) {
        try {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            let fileData = [];

            if (fileExtension === 'csv') {
                const text = await file.text();
                fileData = await new Promise((resolve, reject) => {
                    Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: results => resolve(results.data),
                        error: err => reject(err)
                    });
                });
            } else {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                fileData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
            }

            if (fileData.length > 0) {
                const rawColumns = Object.keys(fileData[0]);
                const columns = rawColumns.map(c => c.trim());

                fileData = fileData.map(row => {
                    const cleanRow = {};
                    Object.keys(row).forEach(k => cleanRow[k.trim()] = row[k]);
                    return cleanRow;
                });

                allData.push({ name: file.name, data: fileData, columns });
            }

        } catch (err) {
            console.error(`Fout bij lezen van ${file.name}`, err);
            alert(`Fout bij het lezen van ${file.name}`);
        }
    }

    if (allData.length === 0) {
        fileStatus.textContent = 'Geen data geladen';
        return;
    }

    fileStatus.textContent = `${allData.length} bestanden geladen`;
    emptyState.style.display = 'none';
    settingsCard.style.display = 'block';

    updateColumnSelectsMulti();
});

// --- Update Column Selects ---
function updateColumnSelectsMulti() {
    // Vind gemeenschappelijke kolommen
    let commonColumns = allData[0].columns;
    allData.slice(1).forEach(file => {
        commonColumns = commonColumns.filter(col => file.columns.includes(col));
    });

    xAxisSelect.innerHTML = '<option value="">Selecteer kolom...</option>' +
        commonColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    yAxisColumns.innerHTML = commonColumns.map(col => {
        const escapedCol = col.replace(/'/g, "\\'");
        return `
            <div class="column-checkbox">
                <input type="checkbox" id="y-${escapedCol}" value="${col}" onchange="toggleYColumn('${escapedCol}')">
                <label for="y-${escapedCol}">${col}</label>
            </div>
        `;
    }).join('');
}

// --- Toggle Y Column ---
function toggleYColumn(column) {
    const index = selectedYColumns.indexOf(column);
    if (index > -1) {
        selectedYColumns.splice(index, 1);
    } else {
        selectedYColumns.push(column);
    }
    updateChart();
}

// --- Event Listeners ---
xAxisSelect.addEventListener('change', updateChart);
chartTypeSelect.addEventListener('change', updateChart);

// --- Update Chart ---
function updateChart() {
    const xColumn = xAxisSelect.value;
    if (!xColumn || selectedYColumns.length === 0) {
        chartCard.style.display = 'none';
        return;
    }

    chartCard.style.display = 'block';
    const ctx = document.getElementById('myChart').getContext('2d');
    if (chart) chart.destroy();

    const colors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
    const datasets = [];

    allData.forEach((file, fileIndex) => {
        const xValues = [...new Set(file.data.map(row => row[xColumn]))].filter(v => v !== null && v !== undefined && v !== '');

        selectedYColumns.forEach((yCol, colIndex) => {
            const color = colors[(fileIndex*selectedYColumns.length + colIndex) % colors.length];
            const dataPoints = xValues.map(xVal => {
                const row = file.data.find(r => r[xColumn] === xVal);
                if (!row) return null;
                const yValue = row[yCol];
                const num = parseFloat(String(yValue).replace(',', '.'));
                return isNaN(num) ? null : num;
            });

            datasets.push({
                label: `${file.name} - ${yCol}`,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color,
                fill: false,
                tension: 0.1,
                spanGaps: true
            });
        });
    });

    chart = new Chart(ctx, {
        type: chartTypeSelect.value,
        data: { 
            labels: allData[0].data.map(r => r[xColumn]), 
            datasets 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
                x: { title: { display: true, text: xColumn } },
                y: { beginAtZero: true, title: { display: true, text: selectedYColumns.join(', ') } }
            }
        }
    });
}

// --- Export Button ---
exportButton.addEventListener('click', () => {
    const xColumn = xAxisSelect.value;
    if (!xColumn || selectedYColumns.length === 0) return;

    allData.forEach(file => {
        const exportData = file.data.map(row => {
            const newRow = { [xColumn]: row[xColumn] };
            selectedYColumns.forEach(col => newRow[col] = row[col]);
            return newRow;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `export_${file.name}`);
    });
});

// --- Reset Button ---
resetButton.addEventListener('click', () => {
    if (confirm('Weet je zeker dat je alle data wilt resetten?')) {
        allData = [];
        selectedYColumns = [];
        fileInput.value = '';
        fileStatus.textContent = 'Geen bestand gekozen';
        settingsCard.style.display = 'none';
        chartCard.style.display = 'none';
        emptyState.style.display = 'block';
        if (chart) {
            chart.destroy();
            chart = null;
        }
    }
});
