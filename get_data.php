<?php
// Отключаем кэширование, чтобы браузер всегда запрашивал свежие данные
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

date_default_timezone_set('UTC');

$dataDir = __DIR__ . '/data/';
$archiveDir = __DIR__ . '/archive/';

// Режим отдачи списка имеющихся файлов для Google Apps Script
if (isset($_GET['mode']) && $_GET['mode'] === 'list') {
    header('Content-Type: application/json; charset=utf-8');
    
    $existingFiles = [];
    if (file_exists($dataDir)) {
        foreach (glob($dataDir . '*.csv') as $f) {
            $existingFiles[] = basename($f);
        }
    }
    if (file_exists($archiveDir)) {
        foreach (glob($archiveDir . '*.csv') as $f) {
            $existingFiles[] = basename($f);
        }
    }
    echo json_encode(array_values(array_unique($existingFiles)));
    exit;
}

// ОСНОВНАЯ ЛОГИКА ДЛЯ ГРАФИКОВ
header('Content-Type: text/csv; charset=utf-8');

if (!file_exists($archiveDir)) {
    mkdir($archiveDir, 0755, true);
}

// 1. Перемещаем новые файлы из data/ в archive/
$newFiles = glob($dataDir . '*.csv');
if ($newFiles) {
    foreach ($newFiles as $filePath) {
        $fileName = basename($filePath);
        rename($filePath, $archiveDir . $fileName);
    }
}

// 2. Собираем ВСЕ файлы из archive/
$archivedFiles = glob($archiveDir . '*.csv');

if (empty($archivedFiles)) {
    http_response_code(404);
    echo "No CSV files found.";
    exit;
}

$allRows = [];
$masterHeader = ['Timestamp', 'PM2.5', 'PM10', 'NO2', 'O3', 'SO2', 'CO', 'Temperature', 'Wind Speed', 'Wind Angle'];

foreach ($archivedFiles as $filePath) {
    $handle = fopen($filePath, 'r');
    if ($handle === false) continue;

    $fileHeader = fgetcsv($handle, 0, ',');
    if (!$fileHeader) {
        fclose($handle);
        continue;
    }

    // Нормализуем заголовки текущего файла (убираем BOM, кавычки и пробелы)
    $cleanHeader = array_map(function($h) {
        $h = preg_replace('/\x{FEFF}/u', '', $h);
        return trim($h, "\" '");
    }, $fileHeader);

    while (($row = fgetcsv($handle, 0, ',')) !== false) {
        if (empty($row) || empty($row[0])) continue;
        
        $rowMap = [];
        foreach ($row as $idx => $val) {
            $colName = isset($cleanHeader[$idx]) ? $cleanHeader[$idx] : $idx;
            $rowMap[$colName] = trim($val, "\" '");
        }

        // Проверяем наличие Timestamp
        if (!empty($rowMap['Timestamp'])) {
            // Нормализуем формат даты для корректного strtotime
            $tsStr = str_replace('.', '-', $rowMap['Timestamp']);
            $parsedTs = strtotime($tsStr);
            
            if ($parsedTs !== false) {
                $rowMap['_unix_ts'] = $parsedTs;
                $allRows[] = $rowMap;
            }
        }
    }
    fclose($handle);
}

if (empty($allRows)) {
    http_response_code(404);
    echo "No valid data found.";
    exit;
}

// 3. Сортировка всех строк по честному Unix Timestamp
usort($allRows, function($a, $b) {
    return $a['_unix_ts'] - $b['_unix_ts'];
});

// 4. Удаление дубликатов по времени
$uniqueRows = [];
$seenTimestamps = [];

foreach ($allRows as $row) {
    $ts = $row['_unix_ts'];
    if (!isset($seenTimestamps[$ts])) {
        $seenTimestamps[$ts] = true;
        unset($row['_unix_ts']);
        $uniqueRows[] = $row;
    }
}

// 5. Вывод итогового CSV
$output = fopen('php://output', 'w');
fputcsv($output, $masterHeader);

foreach ($uniqueRows as $row) {
    $line = [];
    foreach ($masterHeader as $col) {
        $line[] = isset($row[$col]) ? $row[$col] : '';
    }
    fputcsv($output, $line);
}
fclose($output);
?>