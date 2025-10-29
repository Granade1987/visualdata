// State
let files = [];
let selectedWeeks = [];
let availableKeys = [];
let chart = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const filesListCard = document.getElementById('filesListCard');
const filesList = document.getElementById('filesList');
const weekSelectionCard = document.getElementById('weekSelectionCard');
const weekButtons = document.getElementById('weekButtons');
const chartSettingsCard = document.getElementById('chartSettingsCard');
const dataKeySelect = document.getElementById('dataKeySelect');
const chartTypeSelect = document.getElementById('chartTypeSelect');
const chartCard = document.getElementById('chartCard');
const emptyState = document.getElementById('emptyState');
const exportButton = document.getElementById('exportButton');

// Tab Navigation
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
    });
});

// File Upload
fileInput.addEventListener('change', async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    
    for (const file of uploadedFiles) {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            const weekMatch = file.name.match(/week[\s_-]?(\d+)/i);
            let weekNumber = weekMatch ? weekMatch[1] : prompt(`Voer weeknummer in voor ${file.name}:`);
            
            if (weekNumber) {
                weekNumber = parseInt(weekNumber);
                files.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    week: weekNumber,
                    data: jsonData
                });
                
                if (jsonData.length > 0) {
                    const keys = Object.keys(jsonData[0]);
                    keys.forEach(key => {
                        if (!availableKeys.includes(key)) {
                            availableKeys.push(key);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error reading file:', error);
            alert(`Fout bij het lezen van ${file.name}`);
        }
    }
    
    updateUI();
});

// Remove File
function removeFile(id) {
    const file = files.find(f => f.id === id);
    if (file) {
        selectedWeeks = selectedWeeks.filter(w => w !== file.week);
    }
    files = files.filter(f => f.id !== id);
    updateUI();
}

// Toggle Week Selection
function toggleWeek(week) {
    if (selectedWeeks.includes(week)) {
        selectedWeeks = selectedWeeks.filter(w => w !== week);
    } else {
        selectedWeeks.push(week);
        selectedWeeks.sort((a, b) => a - b);
    }
    updateWeekButtons();
    updateChart();
}

// Update UI
function updateUI() {
    if (files.length === 0) {
        fileStatus.textContent = 'Geen bestand gekozen';
        filesListCard.style.display = 'none';
        weekSelectionCard.style.display = 'none';
        chartSettingsCard.style.display = 'none';
        chartCard.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        fileStatus.textContent = `${files.length} bestand(en) geselecteerd`;
        emptyState.style.display = 'none';
        
        filesListCard.style.display = 'block';
        filesList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <span class="file-week">Week ${file.week}</span>
                    <span class="file-name">${file.name}</span>
                    <span class="file-rows">(${file.data.length} rijen)</span>
                </div>
                <button class="file-remove" onclick="removeFile(${file.id})">Verwijder</button>
            </div>
        `).join('');
        
        weekSelectionCard.style.display = 'block';
        updateWeekButtons();
        
        if (availableKeys.length > 0) {
            chartSettingsCard.style.display = 'block';
            dataKeySelect.innerHTML = availableKeys.map(key => 
                `<option value="${key}">${key}</option>`
            ).join('');
        }
    }
}

// Update Week Buttons
function updateWeekButtons() {
    const weeks = [...new Set(files.map(f => f.week))].sort((a, b) => a - b);
    weekButtons.innerHTML = weeks.map(week => `
        <button class="week-button ${selectedWeeks.includes(week) ? 'selected' : ''}" 
                onclick="toggleWeek(${week})">
            Week ${week}
        </button>
    `).join('');
    
    if (selectedWeeks.length > 0) {
        updateChart();
    }
}

// Get Chart Data
function getChartData() {
    const dataKey = dataKeySelect.value;
    if (!dataKey || selectedWeeks.length === 0) return [];
    
    const selectedFiles = files.filter(f => selectedWeeks.includes(f.week));
    
    return selectedFiles.map(file => {
        const values = file.data
            .map(row => parseFloat(row[dataKey]))
            .filter(v => !isNaN(v));
        
        const average = values.length > 0 
            ? values.reduce((a, b) => a + b, 0) / values.length 
            : 0;
        
        return {
            week: `Week ${file.week}`,
            value: average
        };
    }).sort((a, b) => {
        const weekA = parseInt(a.week.split(' ')[1]);
        const weekB = parseInt(b.week.split(' ')[1]);
        return weekA - weekB;
    });
}

// Update Chart
function updateChart() {
    const chartData = getChartData();
    const dataKey = dataKeySelect.value;
    const chartType = chartTypeSelect.value;
    
    if (chartData.length === 0) {
        chartCard.style.display = 'none';
        return;
    }
    
    chartCard.style.display = 'block';
    
    const ctx = document.getElementById('myChart').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: chartData.map(d => d.week),
            datasets: [{
                label: dataKey,
                data: chartData.map(d => d.value),
                backgroundColor: chartType === 'bar' ? '#3b82f6' : 'transparent',
                borderColor: '#3b82f6',
                borderWidth: chartType === 'line' ? 2 : 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Export Data
exportButton.addEventListener('click', () => {
    const chartData = getChartData();
    const dataKey = dataKeySelect.value;
    
    const exportData = chartData.map(d => ({
        Week: d.week,
        [dataKey]: d.value
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Week Analysis");
    XLSX.writeFile(wb, "week_analysis.xlsx");
});

// Chart settings change listeners
dataKeySelect.addEventListener('change', updateChart);
chartTypeSelect.addEventListener('change', updateChart);