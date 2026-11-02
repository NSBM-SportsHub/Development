<?php
declare(strict_types=1);

use SportsHub\Database;
use SportsHub\UserRepository;
use SportsHub\Validation;

require dirname(__DIR__) . '/src/shared/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
$options = getopt('', ['name:', 'email:', 'help']);
if (isset($options['help'])) {
    fwrite(STDOUT, "Usage: php backend/bin/create-admin.php --name=\"Your Name\" --email=\"you@example.com\"\n");
    fwrite(STDOUT, "Password: hidden interactive prompt, a single line on piped stdin, or SPORTSHUB_ADMIN_PASSWORD. No default credentials.\n");
    fwrite(STDOUT, "Initial provisioning only: refuses if any administrator record already exists, including archived administrators.\n");
    exit(0);
}

function promptText(string $prompt): string
{
    fwrite(STDERR, $prompt);
    $value = fgets(STDIN);
    if ($value === false) {
        throw new RuntimeException('Input was closed.');
    }
    return rtrim($value, "\r\n");
}

function promptSecret(string $prompt): string
{
    if (!stream_isatty(STDIN)) {
        return promptText($prompt);
    }
    fwrite(STDERR, $prompt);
    if (PHP_OS_FAMILY === 'Windows') {
        // ReadKey(true) suppresses echo. The password travels only through a private
        // pipe, never through arguments, a temporary file, or the command string.
        $script = '$value = New-Object System.Text.StringBuilder; while ($true) { $key = [Console]::ReadKey($true); if ($key.Key -eq [ConsoleKey]::Enter) { break }; if ($key.Key -eq [ConsoleKey]::Backspace) { if ($value.Length -gt 0) { $null = $value.Remove($value.Length - 1, 1) }; continue }; if ([int]$key.KeyChar -eq 3) { exit 1 }; if ([int]$key.KeyChar -ne 0) { $null = $value.Append($key.KeyChar) } }; [Console]::Write($value.ToString())';
        $process = proc_open(['powershell.exe', '-NoProfile', '-Command', $script], [0 => STDIN, 1 => ['pipe', 'w'], 2 => STDERR], $pipes);
        if (!is_resource($process)) {
            throw new RuntimeException('A hidden password prompt is unavailable. Use piped stdin or SPORTSHUB_ADMIN_PASSWORD.');
        }
        $value = stream_get_contents($pipes[1], 1024);
        fclose($pipes[1]);
        $status = proc_close($process);
        fwrite(STDERR, PHP_EOL);
        if ($status !== 0 || $value === false) {
            throw new RuntimeException('The password prompt failed.');
        }
        return $value;
    }

    $process = proc_open(['stty', '-echo'], [0 => STDIN, 1 => STDOUT, 2 => STDERR], $pipes);
    if (!is_resource($process) || proc_close($process) !== 0) {
        throw new RuntimeException('A hidden password prompt is unavailable. Use piped stdin or SPORTSHUB_ADMIN_PASSWORD.');
    }
    try {
        $value = fgets(STDIN, 1025);
    } finally {
        $restore = proc_open(['stty', 'echo'], [0 => STDIN, 1 => STDOUT, 2 => STDERR], $pipes);
        if (is_resource($restore)) {
            proc_close($restore);
        }
        fwrite(STDERR, PHP_EOL);
    }
    if ($value === false) {
        throw new RuntimeException('Input was closed.');
    }
    return rtrim($value, "\r\n");
}

try {
    $name = $options['name'] ?? promptText('Administrator name: ');
    $email = $options['email'] ?? promptText('Administrator email: ');
    $profile = Validation::profile(['name' => $name, 'email' => $email, 'role' => 'admin', 'status' => 'active'], false, true);
    $password = getenv('SPORTSHUB_ADMIN_PASSWORD');
    $interactive = $password === false && stream_isatty(STDIN);
    if ($password === false) {
        $password = promptSecret('Administrator password (hidden, at least 12 characters, at most 72 UTF-8 bytes): ');
    }
    $password = Validation::password($password);
    if ($interactive && !hash_equals($password, promptSecret('Confirm password: '))) {
        throw new RuntimeException('The passwords did not match.');
    }
    $connection = Database::get();
    $user = UserRepository::transaction(function () use ($connection, $profile, $password): array {
        // The locking range also protects simultaneous attempts to provision the first admin.
        $statement = $connection->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE");
        if ($statement->fetchColumn() !== false) {
            throw new RuntimeException('An administrator already exists. Use the authorized administrator user-management screen.');
        }
        return UserRepository::create($profile, $password);
    });
    unset($password);
    fwrite(STDOUT, 'Initial administrator created (user ' . $user['id'] . "). No password was written to disk.\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Administrator creation failed: ' . $exception->getMessage() . PHP_EOL);
    if ($exception instanceof \SportsHub\ApiException && $exception->fields !== []) {
        foreach ($exception->fields as $field => $message) {
            fwrite(STDERR, $field . ': ' . $message . PHP_EOL);
        }
    }
    exit(1);
}
