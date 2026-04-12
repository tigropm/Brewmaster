<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DATA_FILE = __DIR__ . '/data/recipes.json';

// ── helpers ────────────────────────────────────────────────

function readRecipes(string $file): array {
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    return json_decode($raw, true) ?? [];
}

function writeRecipes(string $file, array $recipes): void {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    file_put_contents(
        $file,
        json_encode($recipes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
}

function makeId(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function sanitize(array $d): array {
    $num = fn($v) => ($v !== null && $v !== '') ? (float)$v : null;
    $int = fn($v) => ($v !== null && $v !== '') ? (int)$v   : null;
    return [
        'marke'       => trim((string)($d['marke']       ?? '')),
        'name'        => trim((string)($d['name']        ?? '')),
        'mahlgrad'    => $num($d['mahlgrad']    ?? null),
        'mahlzeit'    => $int($d['mahlzeit']    ?? null),
        'kaffeemenge' => $num($d['kaffeemenge'] ?? null),
        'sieb'        => trim((string)($d['sieb']        ?? '')),
        'bruehzeit'   => $int($d['bruehzeit']   ?? null),
        'bruehmenge'  => $num($d['bruehmenge']  ?? null),
        'anwendung'   => isset($d['anwendung']) && is_array($d['anwendung'])
                            ? array_values(array_map('strval', $d['anwendung']))
                            : [],
    ];
}

function jsonError(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── routing ────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? trim($_GET['id']) : null;

switch ($method) {

    case 'GET':
        echo json_encode(readRecipes($DATA_FILE), JSON_UNESCAPED_UNICODE);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) jsonError(400, 'Ungültige Anfrage');

        $recipes = readRecipes($DATA_FILE);
        $recipe  = array_merge(
            ['id' => makeId(), 'createdAt' => date('c'), 'updatedAt' => date('c')],
            sanitize($body)
        );
        array_unshift($recipes, $recipe);
        writeRecipes($DATA_FILE, $recipes);

        http_response_code(201);
        echo json_encode($recipe, JSON_UNESCAPED_UNICODE);
        break;

    case 'PUT':
        if (!$id) jsonError(400, 'ID fehlt');

        $body    = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) jsonError(400, 'Ungültige Anfrage');

        $recipes = readRecipes($DATA_FILE);
        $idx     = null;
        foreach ($recipes as $i => $r) {
            if ($r['id'] === $id) { $idx = $i; break; }
        }
        if ($idx === null) jsonError(404, 'Rezept nicht gefunden');

        $recipes[$idx] = array_merge(
            $recipes[$idx],
            sanitize($body),
            ['id' => $id, 'updatedAt' => date('c')]
        );
        writeRecipes($DATA_FILE, $recipes);

        echo json_encode($recipes[$idx], JSON_UNESCAPED_UNICODE);
        break;

    case 'DELETE':
        if (!$id) jsonError(400, 'ID fehlt');

        $recipes  = readRecipes($DATA_FILE);
        $filtered = array_values(array_filter($recipes, fn($r) => $r['id'] !== $id));
        writeRecipes($DATA_FILE, $filtered);

        http_response_code(204);
        break;

    default:
        jsonError(405, 'Methode nicht erlaubt');
}
