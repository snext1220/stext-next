<?php
declare(strict_types=1);

function respond(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = array_filter(array_map(
    'trim',
    explode(',', getenv('STEXT_ALLOWED_ORIGINS') ?: '')
));

if ($origin === '' || !in_array($origin, $allowedOrigins, true)) {
    respond(403, ['accepted' => false, 'error' => '送信元のページを確認できませんでした。']);
}

header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond(405, ['accepted' => false, 'error' => 'POSTで送信してください。']);
}

if (preg_match(
    '/^application\/x-www-form-urlencoded(?:\s*;|$)/i',
    $_SERVER['CONTENT_TYPE'] ?? ''
) !== 1) {
    respond(415, ['accepted' => false, 'error' => 'フォームの形式が正しくありません。']);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) {
    respond(413, ['accepted' => false, 'error' => '送信内容が大きすぎます。']);
}

function field(string $name, bool $trim = true): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value) || preg_match('//u', $value) !== 1) {
        respond(400, ['accepted' => false, 'error' => '入力内容の文字形式が正しくありません。']);
    }

    return $trim ? trim($value) : $value;
}

function characterCount(string $value): int
{
    $count = preg_match_all('/./us', $value);
    if ($count === false) {
        respond(400, ['accepted' => false, 'error' => '入力内容の文字形式が正しくありません。']);
    }

    return $count;
}

function withinLength(string $value, int $maximum): bool
{
    return characterCount($value) <= $maximum;
}

function consumeRateLimit(): string
{
    $directory = getenv('STEXT_RATE_LIMIT_DIR') ?: sys_get_temp_dir();
    if (!is_dir($directory) || !is_writable($directory)) {
        error_log('Playground submission rate limiter directory is unavailable.');
        return 'unavailable';
    }

    $path = rtrim($directory, DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'stext-playground-submit-'
        . hash('sha256', __DIR__)
        . '.json';
    $file = @fopen($path, 'c+');
    if ($file === false || !flock($file, LOCK_EX)) {
        if (is_resource($file)) {
            fclose($file);
        }
        error_log('Playground submission rate limiter is unavailable.');
        return 'unavailable';
    }

    try {
        rewind($file);
        $raw = stream_get_contents($file);
        $limits = $raw === '' ? [] : json_decode($raw, true);
        if (!is_array($limits)) {
            error_log('Playground submission rate limiter state is invalid.');
            return 'unavailable';
        }

        $now = time();
        $limits = array_filter(
            $limits,
            static fn ($timestamps): bool => is_array($timestamps)
        );
        foreach ($limits as $key => $timestamps) {
            $limits[$key] = array_values(array_filter(
                $timestamps,
                static fn ($timestamp): bool => is_int($timestamp) && $timestamp > $now - 3600
            ));
            if ($limits[$key] === []) {
                unset($limits[$key]);
            }
        }

        $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $key = hash('sha256', $address . __DIR__);
        $recent = $limits[$key] ?? [];
        if (count($recent) >= 5) {
            return 'limited';
        }
        $limits[$key] = [...$recent, $now];

        $encoded = json_encode($limits);
        if ($encoded === false || !rewind($file) || !ftruncate($file, 0)
            || fwrite($file, $encoded) !== strlen($encoded)) {
            error_log('Playground submission rate limiter state could not be saved.');
            return 'unavailable';
        }

        return 'allowed';
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}

if (field('website') !== '') {
    respond(400, ['accepted' => false, 'error' => '送信内容を確認できませんでした。']);
}

$author = field('author');
$email = field('email');
$tag = field('tag');
$level = field('level');
$intro = field('intro');
$comment = field('comment');
$downloadUrl = field('downloadUrl');
$retention = field('retention');
$key = field('key', false);

$errors = [];
if ($author === '' || !withinLength($author, 100)) {
    $errors[] = '作者名を100文字以内で入力してください。';
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || !withinLength($email, 254)) {
    $errors[] = 'メールアドレスの形式が正しくありません。';
}
if (!withinLength($tag, 300)) {
    $errors[] = '分類は300文字以内で入力してください。';
}
if (!in_array($level, ['1（易）', '2（やや易）', '3（普通）', '4（やや難）', '5（難）'], true)) {
    $errors[] = '難易度を1〜5から選択してください。';
}
$introLength = characterCount($intro);
if ($introLength < 2 || $introLength > 300) {
    $errors[] = 'シナリオ紹介は2〜300文字で入力してください。';
}
if ($comment === '' || !withinLength($comment, 1000)) {
    $errors[] = '作者よりを1000文字以内で入力してください。';
}
$url = parse_url($downloadUrl);
if (filter_var($downloadUrl, FILTER_VALIDATE_URL) === false
    || !is_array($url)
    || strtolower($url['scheme'] ?? '') !== 'https'
    || empty($url['host'])
    || isset($url['user'])
    || isset($url['pass'])
    || !withinLength($downloadUrl, 2048)) {
    $errors[] = 'ダウンロードURLには有効なHTTPS URLを入力してください。';
}
if (!preg_match('/^([0-9]{1,4})\s*日(?:間)?$/u', $retention, $days)
    || (int) $days[1] < 7) {
    $errors[] = 'ZIPの保持期間は7日以上で入力してください。';
}
if (!withinLength($key, 128)) {
    $errors[] = 'ダウンロードキーは128文字以内で入力してください。';
}
if ($errors !== []) {
    respond(422, ['accepted' => false, 'error' => implode("\n", $errors)]);
}

$rateLimit = consumeRateLimit();
if ($rateLimit === 'limited') {
    respond(429, ['accepted' => false, 'error' => '送信回数が上限に達しました。時間をおいて再度お試しください。']);
}
if ($rateLimit !== 'allowed') {
    respond(503, ['accepted' => false, 'error' => '提出を一時的に受け付けられません。時間をおいて再度お試しください。']);
}

$recipient = getenv('STEXT_MAIL_TO') ?: '';
$sender = getenv('STEXT_MAIL_FROM') ?: '';
if (filter_var($recipient, FILTER_VALIDATE_EMAIL) === false
    || filter_var($sender, FILTER_VALIDATE_EMAIL) === false) {
    error_log('Playground submission mail configuration is invalid.');
    respond(503, ['accepted' => false, 'error' => '提出フォームは現在利用できません。']);
}

$message = implode("\n", [
    'SORCERIAN Text Playground からシナリオ提出がありました。',
    '',
    '作者名: ' . $author,
    '連絡先: ' . $email,
    '分類: ' . $tag,
    '難易度: ' . $level,
    '',
    'シナリオ紹介:',
    $intro,
    '',
    '作者より:',
    $comment,
    '',
    'ダウンロードURL: ' . $downloadUrl,
    '保持期間: ' . $retention,
    'ダウンロードキー: ' . ($key === '' ? '（設定なし）' : $key),
]);
$headers = implode("\r\n", [
    'From: ' . $sender,
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
]);

try {
    $subject = '=?UTF-8?B?' . base64_encode('SORCERIAN Text シナリオ提出') . '?=';
    $sent = mail($recipient, $subject, $message, $headers);
} catch (Throwable $error) {
    error_log('Playground submission mail failed: ' . $error->getMessage());
    $sent = false;
}

if (!$sent) {
    error_log('Playground submission mail was not accepted by the mail transport.');
    respond(502, ['accepted' => false, 'error' => 'メールを送信できませんでした。時間をおいて再度お試しください。']);
}

respond(202, ['accepted' => true]);
