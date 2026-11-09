document.addEventListener('DOMContentLoaded', async () => {
    /* eslint-disable */
    /* jshint ignore:start */
    
    // -------------------------------------------------------------
    // 1. БЛОК ЗАЩИТЫ: Блокировка контекстного меню и DevTools
    // -------------------------------------------------------------
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', event => {
        if (
            event.key === 'F12' || 
            (event.ctrlKey && event.shiftKey && ['I','J','C'].includes(event.key)) || 
            (event.ctrlKey && event.key.toLowerCase() === 'u')
        ) {
            event.preventDefault();
        }
    });

    // -------------------------------------------------------------
    // 2. КОНФИГУРАЦИЯ ПАРАМЕТРОВ
    // -------------------------------------------------------------
    const pollutants = [
        { 
            id: 'pm25', 
            name: 'Particule în suspensie (PM2,5)', 
            unit: 'µg/m³', 
            colName: 'PM2.5', 
            color: '#d62728', 
            levels: { bun: [0, 5], acc: [6, 15], mod: [16, 50], rau: [51, 90], frau: [91, 140], ext: [141, 1000] }, 
            rawLevels: { bun: '0-5', acc: '6-15', mod: '16-50', rau: '51-90', frau: '91-140', ext: '>140' } 
        },
        { 
            id: 'pm10', 
            name: 'Particule în suspensie (PM10)', 
            unit: 'µg/m³', 
            colName: 'PM10', 
            color: '#9467bd', 
            levels: { bun: [0, 15], acc: [16, 45], mod: [46, 120], rau: [121, 195], frau: [196, 270], ext: [271, 1200] }, 
            rawLevels: { bun: '0-15', acc: '16-45', mod: '46-120', rau: '121-195', frau: '196-270', ext: '>270' } 
        },
        { 
            id: 'no2', 
            name: 'Dioxid de azot (NO₂)', 
            unit: 'µg/m³', 
            colName: 'NO2', 
            color: '#1f77b4', 
            levels: { bun: [0, 10], acc: [11, 25], mod: [26, 60], rau: [61, 100], frau: [101, 150], ext: [151, 1000] }, 
            rawLevels: { bun: '0-10', acc: '11-25', mod: '26-60', rau: '61-100', frau: '101-150', ext: '>150' } 
        },
        { 
            id: 'o3', 
            name: 'Ozon (O₃)', 
            unit: 'µg/m³', 
            colName: 'O3', 
            color: '#2ca02c', 
            levels: { bun: [0, 60], acc: [61, 100], mod: [101, 120], rau: [121, 160], frau: [161, 180], ext: [181, 800] }, 
            rawLevels: { bun: '0-60', acc: '61-100', mod: '101-120', rau: '121-160', frau: '161-180', ext: '>180' } 
        },
        { 
            id: 'so2', 
            name: 'Dioxid de sulf (SO₂)', 
            unit: 'µg/m³', 
            colName: 'SO2', 
            color: '#8c564b', 
            levels: { bun: [0, 20], acc: [21, 40], mod: [41, 125], rau: [126, 190], frau: [191, 275], ext: [276, 1250] }, 
            rawLevels: { bun: '0-20', acc: '21-40', mod: '41-125', rau: '126-190', frau: '191-275', ext: '>275' } 
        },
        { 
            id: 'co', 
            name: 'Monoxid de carbon (CO)', 
            unit: 'µg/m³', 
            colName: 'CO', 
            color: '#ff7f0e', 
            levels: { bun: [0, 1], acc: [1, 4], mod: [4, 6], rau: [6, 8], frau: [8, 10], ext: [10, 100] }, 
            rawLevels: { bun: '0-1.000', acc: '<4.000', mod: '<6.000', rau: '<8.000', frau: '<10.000', ext: '>10.000' } 
        },
        { 
            id: 'temp', 
            name: 'Temperatura aerului', 
            unit: '°C', 
            colName: 'Temperature', 
            color: '#e377c2', 
            hideTable: true 
        }
    ];

    Highcharts.setOptions({ time: { useUTC: false } });

    const accordion = document.getElementById('accordion');
    let rawDataset = {};
    let windData = [];
    let maxTimeOverall = -Infinity;
    const TWO_WEEKS_MS = 14 * 24 * 3600 * 1000;

    try {
        const response = await fetch('get_data.php?_t=' + new Date().getTime(), { cache: 'no-store' });
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        parseAndFilterCSV(csvText);
    } catch (e) {
        console.error('Eroare la încărcarea datelor:', e);
        return;
    }

    function parseAndFilterCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.replace(/"/g, '').trim());
        const tempDataset = {};
        pollutants.forEach(p => tempDataset[p.colName] = []);
        const tempWind = [];

        const windAngleIdx = headers.indexOf('Wind Angle');
        const windSpeedIdx = headers.indexOf('Wind Speed');

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',').map(r => r.replace(/"/g, '').trim());
            const timeStr = row[0];
            if (!timeStr || !timeStr.includes('-') || !timeStr.includes(':')) continue;

            const parts = timeStr.trim().split(' ');
            if (parts.length < 2) continue;

            const dateParts = parts[0].split('-');
            const timeParts = parts[1].split(':');

            const ts = new Date(
                parseInt(dateParts[0], 10),
                parseInt(dateParts[1], 10) - 1,
                parseInt(dateParts[2], 10),
                parseInt(timeParts[0], 10),
                parseInt(timeParts[1], 10),
                parseInt(timeParts[2] || 0, 10)
            ).getTime();

            if (isNaN(ts)) continue;
            if (ts > maxTimeOverall) maxTimeOverall = ts;

            pollutants.forEach(p => {
                const colIdx = headers.indexOf(p.colName);
                if (colIdx !== -1) {
                    const val = (row[colIdx] !== '' && !isNaN(row[colIdx])) ? parseFloat(row[colIdx]) : null;
                    tempDataset[p.colName].push([ts, val]);
                }
            });

            if (windAngleIdx !== -1 && windSpeedIdx !== -1) {
                const angle = parseFloat(row[windAngleIdx]);
                const speed = parseFloat(row[windSpeedIdx]);
                if (!isNaN(angle) && !isNaN(speed)) tempWind.push({ ts, angle, speed });
            }
        }

        const cutoffTime = maxTimeOverall - TWO_WEEKS_MS;
        pollutants.forEach(p => {
            rawDataset[p.colName] = tempDataset[p.colName].filter(([ts]) => ts >= cutoffTime);
        });
        windData = tempWind.filter(w => w.ts >= cutoffTime);
    }

    // Определяем ключ уровня качества воздуха по значению
    function getActiveLevelKey(val, levels) {
        if (val === null || !levels) return null;
        if (val <= levels.bun[1]) return 'bun';
        if (val <= levels.acc[1]) return 'acc';
        if (val <= levels.mod[1]) return 'mod';
        if (val <= levels.rau[1]) return 'rau';
        if (val <= levels.frau[1]) return 'frau';
        return 'ext';
    }

    // -------------------------------------------------------------
    // 3. ОТРИСОВКА КАРТОЧЕК И ГРАФИКОВ
    // -------------------------------------------------------------
    pollutants.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'accordion__item';

        const dataset = rawDataset[item.colName] || [];
        const lastPoint = dataset.length > 0 ? dataset[dataset.length - 1][1] : null;
        const lastValText = lastPoint !== null ? `${lastPoint.toFixed(1)} ${item.unit}` : 'N/A';
        
        const activeKey = getActiveLevelKey(lastPoint, item.levels);
        const kpiColorClass = activeKey ? `kpi-${activeKey}` : '';

        let tableHTML = '';
        if (!item.hideTable && item.rawLevels) {
            tableHTML = `
            <div class="table-responsive">
                <table class="quality-table">
                    <thead><tr><th colspan="7">Starea de calitate a aerului atmosferic</th></tr></thead>
                    <tbody>
                        <tr>
                            <td>Concentrația poluantului monitorizat</td>
                            <td class="bun-cell ${activeKey === 'bun' ? 'active-level' : ''}">BUN</td>
                            <td class="acceptable-cell ${activeKey === 'acc' ? 'active-level' : ''}">ACCEPTABIL</td>
                            <td class="moderat-cell ${activeKey === 'mod' ? 'active-level' : ''}">MODERAT</td>
                            <td class="rau-cell ${activeKey === 'rau' ? 'active-level' : ''}">RĂU</td>
                            <td class="foarte-rau-cell ${activeKey === 'frau' ? 'active-level' : ''}">FOARTE RĂU</td>
                            <td class="extrem-de-rau-cell ${activeKey === 'ext' ? 'active-level' : ''}">EXTREM DE RĂU</td>
                        </tr>
                        <tr>
                            <td>${item.name} (${item.unit})</td>
                            <td class="bun-lvl ${activeKey === 'bun' ? 'active-level' : ''}">${item.rawLevels.bun}</td>
                            <td class="acceptable-lvl ${activeKey === 'acc' ? 'active-level' : ''}">${item.rawLevels.acc}</td>
                            <td class="moderat-lvl ${activeKey === 'mod' ? 'active-level' : ''}">${item.rawLevels.mod}</td>
                            <td class="rau-lvl ${activeKey === 'rau' ? 'active-level' : ''}">${item.rawLevels.rau}</td>
                            <td class="foarte-rau-lvl ${activeKey === 'frau' ? 'active-level' : ''}">${item.rawLevels.frau}</td>
                            <td class="extrem-de-rau-lvl ${activeKey === 'ext' ? 'active-level' : ''}">${item.rawLevels.ext}</td>
                        </tr>
                    </tbody>
                </table>
            </div>`;
        }

        itemEl.innerHTML = `
            <div class="accordion__header-wrapper">
                <h3 class="accordion__title">${item.name}</h3>
                <div class="kpi-badge ${kpiColorClass}"><span class="status-dot"></span>${lastValText}</div>
            </div>
            <div class="accordion__content">
                <div id="chart-${item.id}" class="chart-container"></div>
                ${tableHTML}
            </div>
        `;
        accordion.appendChild(itemEl);

        Highcharts.chart(`chart-${item.id}`, {
            chart: { type: 'spline', zoomType: 'x',backgroundColor: '#ffffff',
                    plotBackgroundColor: '#ffffff' },
            title: { text: null },
            legend: { enabled: false },
            plotOptions: {
                spline: {
                    connectNulls: true,
                    marker: { enabled: false, states: { hover: { enabled: true, radius: 5 } } }
                }
            },
            xAxis: {
                type: 'datetime',
                title: { text: 'Data / Ora' },
                labels: { useHTML: true },
                dateTimeLabelFormats: { hour: '%H:%M<br/>%d.%m.%Y', day: '%d.%m.%Y' },
                gridLineWidth: 1,
                gridLineColor: '#f1f5f9'
            },
            yAxis: { 
                title: { text: `${item.name} (${item.unit})` },
                gridLineColor: '#f1f5f9'
            },
            tooltip: { xDateFormat: '%H:%M<br/>%d.%m.%Y', valueDecimals: 1, valueSuffix: ` ${item.unit}` },
            series: [{ name: item.name, data: dataset, color: item.color }],
            credits: { enabled: false }
        });
    });

    // -------------------------------------------------------------
    // 4. ОТРИСОВКА РОЗЫ ВЕТРОВ (WIND ROSE)
    // -------------------------------------------------------------
    if (windData.length > 0) {
        createWindRoseChart();
    }

    function createWindRoseChart() {
        const categories = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const speedRanges = [
            { min: 0, max: 2, name: '< 2 m/s', color: '#86efac' },
            { min: 2, max: 5, name: '2-5 m/s', color: '#22c55e' },
            { min: 5, max: 8, name: '5-8 m/s', color: '#3b82f6' },
            { min: 8, max: 11, name: '8-11 m/s', color: '#f97316' },
            { min: 11, max: 100, name: '> 11 m/s', color: '#ef4444' }
        ];

        const counts = speedRanges.map(() => [0, 0, 0, 0, 0, 0, 0, 0]);
        const totalPoints = windData.length;

        windData.forEach(w => {
            const sector = Math.floor((w.angle + 22.5) / 45) % 8;
            for (let r = 0; r < speedRanges.length; r++) {
                if (w.speed >= speedRanges[r].min && w.speed < speedRanges[r].max) {
                    counts[r][sector]++;
                    break;
                }
            }
        });

        const seriesData = speedRanges.map((range, rIdx) => ({
            name: range.name,
            color: range.color,
            data: counts[rIdx].map(c => parseFloat(((c / totalPoints) * 100).toFixed(1)))
        }));

        const itemEl = document.createElement('div');
        itemEl.className = 'accordion__item';
        itemEl.innerHTML = `
            <div class="accordion__header-wrapper">
                <h3 class="accordion__title">Roza vânturilor (Wind Rose)</h3>
            </div>
            <div class="accordion__content">
                <div id="chart-wind-rose" class="chart-container" style="height: 440px;"></div>
            </div>
        `;
        accordion.appendChild(itemEl);

        Highcharts.chart('chart-wind-rose', {
            chart: { polar: true, type: 'column' ,
                    backgroundColor: '#ffffff',
                    plotBackgroundColor: '#ffffff',},
            title: { text: null },
            pane: { size: '85%' },
            legend: { layout: 'horizontal', align: 'center', verticalAlign: 'bottom' },
            xAxis: { categories: categories, tickmarkPlacement: 'on', lineWidth: 0 },
            yAxis: {
                min: 0,
                endOnTick: false,
                showLastLabel: true,
                title: { text: 'Frecvența (%)' },
                labels: { formatter: function () { return this.value + '%'; } },
                reversedStacks: false
            },
            tooltip: { valueSuffix: '%', shared: true },
            plotOptions: {
                series: { stacking: 'normal', shadow: false, groupPadding: 0, pointPlacement: 'on' }
            },
            series: seriesData,
            credits: { enabled: false }
        });
    }
});