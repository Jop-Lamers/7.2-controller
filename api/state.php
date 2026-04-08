<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$default = [
    'axis' => 0,
    'grabSeq' => 0,
    'controllerId' => '',
    'updatedAt' => 0,
];

$root = dirname(__DIR__);
$dataDir = $root . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0777, true) && !is_dir($dataDir)) {
    echo json_encode($default, JSON_UNESCAPED_UNICODE);
    exit;
}

$stateFile = $dataDir . DIRECTORY_SEPARATOR . 'state.json';
if (!file_exists($stateFile)) {
    echo json_encode($default, JSON_UNESCAPED_UNICODE);
    exit;
}

$fp = @fopen($stateFile, 'rb');
if ($fp === false) {
    echo json_encode($default, JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = '';
if (flock($fp, LOCK_SH)) {
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
}
fclose($fp);

if ($raw === false || $raw === '') {
    echo json_encode($default, JSON_UNESCAPED_UNICODE);
    exit;
}

$state = json_decode($raw, true);
if (!is_array($state)) {
    echo json_encode($default, JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode($state, JSON_UNESCAPED_UNICODE);
