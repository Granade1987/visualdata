// State
let data = [];
let columns = [];
let selectedYColumns = [];
let chart = null;
let fileName = '';

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

// File Upload
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileName = file.name;
    fileStatus.textContent = `Bezig met laden: ${fileName}`;

    try {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === 'csv') {
            const text = await file.text();
            Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    data = results.data;
                    processData();
                },
                error: (error) => {
                    console.error('CSV parse error:', error);
                    alert(`Fout bij het lezen van ${file.name}`);
                }
            });
        } else {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(worksheet);
            processData();
        }
    } catch (error) {
        console.error('Error reading file:', error);
        alert(`Fout bij het lezen van ${file.name}`);
        fileStatus.textContent = 'Fout bij het laden';
    }
});

// Process Data
function processData() {
    if (data.length === 0) {
        alert('Het bestand bevat geen data');
        return;
    }

    columns = Object.keys(data[0]).map(key => key.trim());
    selectedYColumns = [];

    fileStatus.textContent = `${fileName} - ${data.length} rijen geladen`;
    emptyState.style.display = 'none';
    settingsCard.style.display = 'block';

    updateColumnSelects();
}

// Update Column Selects
function updateColumnSelects() {
    xAxisSelect.innerHTML = '<option value="">Selecteer kolom...</option>' +
        columns.map(col => `<option value="${col}">${col}</option>`).join('');

    yAxisColumns.innerHTML = columns.map(col => `
        <div class="column-checkbox">
            <input type="checkbox" id="y-${col}" value="${col}" onchange="toggleYColumn('${col}')">
            <label for="y-${col}">${col}</label>
        </div>
    `).join('');
}

// Toggle Y Column
function toggleYColumn(column) {
    const index = selectedYColumns.indexOf(column);
    if (index > -1) {
        selectedYColumns.splice(index, 1);
    } else {
        selectedYColumns.push(column);
    }
    updateChart();
}

// Event Listeners
xAxisSelect.addEventListener('change', updateChart);
chartTypeSelect.addEventListener('change', updateChart);

// Update Chart
function updateChart() {
    const xColumn = xAxisSelect.value;
    
    if (!xColumn || selectedYColumns.length === 0) {
        chartCard.style.display = 'none';
        return;
    }

    chartCard.style.display = 'block';

    const ctx = document.getElementById('myChart').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }

    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];

    const datasets = selectedYColumns.map((yCol, index) => {
        const color = colors[index % colors.length];
        return {
            label: yCol,
            data: data.map(row => ({
                x: row[xColumn],
                y: parseFloat(row[yCol])
            })).filter(point => !isNaN(point.y)),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 2,
            fill: false,
            tension: 0.1
        };
    });

    const chartType = chartTypeSelect.value;

    chart = new Chart(ctx, {
        type: chartType,
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: xColumn
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: selectedYColumns.join(', ')
                    }
                }
            }
        }
    });
}

// Export Button
exportButton.addEventListener('click', () => {
    const xColumn = xAxisSelect.value;
    if (!xColumn || selectedYColumns.length === 0) return;

    const exportData = data.map(row => {
        const newRow = { [xColumn]: row[xColumn] };
        selectedYColumns.forEach(col => {
            newRow[col] = row[col];
        });
        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "export_data.xlsx");
});

// Reset Button
resetButton.addEventListener('click', () => {
    if (confirm('Weet je zeker dat je alle data wilt resetten?')) {
        data = [];
        columns = [];
        selectedYColumns = [];
        fileName = '';
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