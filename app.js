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
                dynamicTyping: false, // Keep as strings initially
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
            data = XLSX.utils.sheet_to_json(worksheet, { raw: false }); // Keep values as strings
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

    // Clean column names (trim whitespace)
    const rawColumns = Object.keys(data[0]);
    columns = rawColumns.map(key => key.trim());
    
    // Create a mapping of cleaned names to original names
    const columnMapping = {};
    rawColumns.forEach((col, i) => {
        columnMapping[columns[i]] = col;
    });
    
    // Clean data keys
    data = data.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
            const cleanKey = key.trim();
            cleanRow[cleanKey] = row[key];
        });
        return cleanRow;
    });

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

    yAxisColumns.innerHTML = columns.map(col => {
        const escapedCol = col.replace(/'/g, "\\'");
        return `
        <div class="column-checkbox">
            <input type="checkbox" id="y-${escapedCol}" value="${col}" onchange="toggleYColumn('${escapedCol}')">
            <label for="y-${escapedCol}">${col}</label>
        </div>
    `}).join('');
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

// Check if column contains numeric data
function isNumericColumn(columnName) {
    const values = data.map(row => row[columnName]);
    const numericValues = values.filter(v => {
        if (v === null || v === undefined || v === '') return false;
        const num = parseFloat(String(v).replace(',', '.'));
        return !isNaN(num);
    });
    return numericValues.length > values.length * 0.5; // At least 50% numeric
}

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

    // Get all unique x-axis values in order
    const xValues = [...new Set(data.map(row => row[xColumn]))].filter(v => v !== null && v !== undefined && v !== '');

    const datasets = selectedYColumns.map((yCol, index) => {
        const color = colors[index % colors.length];
        
        // Create data points for each x value
        const dataPoints = xValues.map(xVal => {
            const row = data.find(r => r[xColumn] === xVal);
            if (!row) return null;
            
            const yValue = row[yCol];
            if (yValue === null || yValue === undefined || yValue === '') return null;
            
            // Try to parse as number (handle both . and , as decimal separator)
            const numValue = parseFloat(String(yValue).replace(',', '.'));
            return isNaN(numValue) ? null : numValue;
        });

        return {
            label: yCol,
            data: dataPoints,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            spanGaps: true // Connect line even if there are null values
        };
    });

    const chartType = chartTypeSelect.value;

    chart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: xValues,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xColumn
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
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