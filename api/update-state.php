<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '{}', true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$root = dirname(__DIR__);
$dataDir = $root . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0777, true) && !is_dir($dataDir)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mkdir_failed']);
    exit;
}

$stateFile = $dataDir . DIRECTORY_SEPARATOR . 'state.json';
$state = [
    'axis' => max(-1, min(1, (float)($payload['axis'] ?? 0))),
    'grabSeq' => max(0, (int)($payload['grabSeq'] ?? 0)),
    'controllerId' => (string)($payload['controllerId'] ?? ''),
    'updatedAt' => (int) round(microtime(true) * 1000),
];

$json = json_encode($state, JSON_UNESCAPED_UNICODE);
$fp = @fopen($stateFile, 'c+');
if ($fp === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'open_failed']);
    exit;
}

$ok = false;
if (flock($fp, LOCK_EX)) {
    ftruncate($fp, 0);
    rewind($fp);
    $written = fwrite($fp, $json);
    fflush($fp);
    flock($fp, LOCK_UN);
    $ok = ($written !== false);
}
fclose($fp);

if (!$ok) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed']);
    exit;
}

echo json_encode(['ok' => true]);
