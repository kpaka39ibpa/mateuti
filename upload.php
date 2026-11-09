<?php
// Пароль для защиты от посторонних вызовов (должен совпадать с ключом в Google Apps Script)
$secretKey = "MATEUTI_SECRET_KEY_2026"; 

$targetDir = __DIR__ . '/data/';

if (!file_exists($targetDir)) {
    mkdir($targetDir, 0755, true);
}

// Проверка ключа безопасности
if (!isset($_POST['key']) || $_POST['key'] !== $secretKey) {
    http_response_code(403);
    echo "Access denied";
    exit;
}

if (isset($_FILES['file'])) {
    $fileName = basename($_FILES['file']['name']);
    $targetFile = $targetDir . $fileName;

    if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
        http_response_code(200);
        echo "File uploaded successfully: " . $fileName;
    } else {
        http_response_code(500);
        echo "Error moving uploaded file";
    }
} else {
    http_response_code(400);
    echo "No file uploaded";
}
?>