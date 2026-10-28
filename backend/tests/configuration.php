<?php
declare(strict_types=1);

/**
 * Dependency-free configuration regression suite.
 * Every .env read belongs to a generated temporary fixture. Never load the
 * application's bootstrap or its private backend/.env from this test.
 */

if (($argv[1] ?? '') === '--fixture') {
    $backend = $argv[2];
    $mode = $argv[3] ?? 'settings';
    // Windows process creation drops empty environment entries. Install those
    // known fixture values in the child before taking the preservation snapshot.
    foreach (json_decode($argv[4] ?? '[]', true, 512, JSON_THROW_ON_ERROR) as $emptyName) {
        putenv($emptyName . '=');
    }
    $environmentBefore = getenv();
    $superglobalBefore = $_ENV;
    try {
        require $backend . '/src/shared/Environment.php';
        require $backend . '/src/shared/Config.php';
        $settings = \SportsHub\Config::all();
        $result = [
            'ok' => true,
            'settings' => $settings,
            'environment_preserved' => getenv() === $environmentBefore,
            'superglobal_preserved' => $_ENV === $superglobalBefore,
        ];
        if ($mode === 'key') {
            $result['key'] = \SportsHub\Config::requireAppKey();
        }
        echo json_encode($result, JSON_THROW_ON_ERROR);
    } catch (\Throwable $error) {
        echo json_encode([
            'ok' => false,
            'error' => $error->getMessage(),
            'environment_preserved' => getenv() === $environmentBefore,
            'superglobal_preserved' => $_ENV === $superglobalBefore,
        ], JSON_THROW_ON_ERROR);
    }
    exit(0);
}

require dirname(__DIR__) . '/src/shared/Environment.php';

$passed = 0;
$failures = [];
$temporaryRoot = null;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function equal(mixed $expected, mixed $actual, string $message): void
{
    check($expected === $actual, $message);
}

function expectFailure(callable $operation, string $messagePart, array $forbidden = []): void
{
    try {
        $operation();
    } catch (RuntimeException $error) {
        check(str_contains($error->getMessage(), $messagePart), 'The error did not identify the expected problem.');
        foreach ($forbidden as $text) {
            check(!str_contains($error->getMessage(), $text), 'An error exposed fixture line contents.');
        }
        return;
    }
    throw new RuntimeException('Expected the invalid fixture to be rejected.');
}

function regression(string $name, callable $operation): void
{
    global $passed, $failures;
    try {
        $operation();
        $passed++;
        echo 'PASS ' . $name . PHP_EOL;
    } catch (Throwable $error) {
        // Assertion messages are fixed strings; never dump parsed values or environments.
        $failures[] = $name;
        echo 'FAIL ' . $name . ': ' . $error->getMessage() . PHP_EOL;
    }
}

function writeFixture(string $contents): string
{
    global $temporaryRoot;
    $path = $temporaryRoot . '/parser-' . bin2hex(random_bytes(6)) . '.env';
    check(file_put_contents($path, $contents) === strlen($contents), 'Could not write the parser fixture.');
    return $path;
}

function configurationFixture(?string $environment = null, ?array $local = null): string
{
    global $temporaryRoot;
    $backend = $temporaryRoot . '/case-' . bin2hex(random_bytes(6)) . '/backend';
    check(mkdir($backend . '/src/shared', 0700, true), 'Could not create a fixture source directory.');
    check(mkdir($backend . '/config', 0700, true), 'Could not create a fixture configuration directory.');
    $source = dirname(__DIR__);
    foreach (['src/shared/Environment.php', 'src/shared/Config.php', 'config/config.example.php'] as $file) {
        check(copy($source . '/' . $file, $backend . '/' . $file), 'Could not copy a public configuration source.');
    }
    if ($environment !== null) {
        check(file_put_contents($backend . '/.env', $environment) === strlen($environment), 'Could not write the isolated environment fixture.');
    }
    if ($local !== null) {
        $php = '<?php return ' . var_export($local, true) . ';' . PHP_EOL;
        check(file_put_contents($backend . '/config/local.php', $php) === strlen($php), 'Could not write a local configuration fixture.');
    }
    return $backend;
}

function inspectConfiguration(string $backend, array $overrides = [], string $mode = 'settings', ?string $cwd = null): array
{
    // Pass an isolated environment to a fresh PHP process so Config's static
    // cache, production process variables, and the current directory cannot leak in.
    $environment = getenv();
    foreach (array_keys($environment) as $key) {
        if (stripos($key, 'SPORTSHUB_') === 0) {
            unset($environment[$key]);
        }
    }
    $environment['SPORTSHUB_DB_USER'] = 'fixture_process_user';
    $emptyNames = [];
    foreach ($overrides as $key => $value) {
        $environment[$key] = $value;
        if ($value === '') {
            $emptyNames[] = $key;
        }
    }
    $pipes = [];
    $process = proc_open(
        [PHP_BINARY, __FILE__, '--fixture', $backend, $mode, json_encode($emptyNames, JSON_THROW_ON_ERROR)],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $cwd ?? dirname($backend),
        $environment
    );
    check(is_resource($process), 'Could not start the isolated PHP check.');
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    check($exit === 0 && $errors === '', 'The isolated PHP check did not finish cleanly.');
    $result = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    check(is_array($result), 'The isolated PHP check returned an invalid result.');
    check($result['environment_preserved'] === true, 'Loading configuration changed the process environment.');
    check($result['superglobal_preserved'] === true, 'Loading configuration changed the environment superglobal.');
    return $result;
}

function settings(array $result): array
{
    check($result['ok'] === true, 'The valid fixture configuration was rejected.');
    return $result['settings'];
}

function configurationError(array $result, string $messagePart): void
{
    check($result['ok'] === false, 'The invalid fixture configuration was accepted.');
    check(str_contains($result['error'], $messagePart), 'The configuration error did not identify the expected problem.');
}

function cleanFixtureTree(string $directory, string $root): void
{
    $normalizedRoot = str_replace('\\', '/', $root);
    $normalizedDirectory = str_replace('\\', '/', $directory);
    check($normalizedDirectory === $normalizedRoot || str_starts_with($normalizedDirectory, $normalizedRoot . '/'), 'Cleanup target escaped its temporary fixture.');
    foreach (new DirectoryIterator($directory) as $entry) {
        if ($entry->isDot()) {
            continue;
        }
        $path = $entry->getPathname();
        if ($entry->isDir() && !$entry->isLink()) {
            cleanFixtureTree($path, $root);
        } else {
            check(unlink($path), 'Could not clean up a generated fixture file.');
        }
    }
    check(rmdir($directory), 'Could not clean up a generated fixture directory.');
}

try {
    $tempBase = realpath(sys_get_temp_dir());
    check($tempBase !== false, 'The temporary directory is unavailable.');
    $candidateRoot = $tempBase . DIRECTORY_SEPARATOR . 'sportshub-config-tests-' . bin2hex(random_bytes(8));
    check(mkdir($candidateRoot, 0700), 'Could not create the temporary test root.');
    $temporaryRoot = $candidateRoot;

    regression('parser handles BOM, CRLF, export, whitespace, blanks, and equals signs', function (): void {
        $contents = "\xEF\xBB\xBF# fixture only\r\n export HOST = 127.0.0.1\r\nEMPTY=\r\nEQUALS=a=b=c\r\n  \r\n";
        equal(['HOST' => '127.0.0.1', 'EMPTY' => '', 'EQUALS' => 'a=b=c'], \SportsHub\Environment::fromFile(writeFixture($contents)), 'Basic environment syntax was not parsed correctly.');
    });

    regression('parser distinguishes literal hashes from unquoted comments', function (): void {
        $values = \SportsHub\Environment::fromFile(writeFixture("ATTACHED=abc#suffix\nCOMMENT=value \t# ignored\nLEADING=# comment\nQUOTED=\"#literal = value\" # ignored\n"));
        equal(['ATTACHED' => 'abc#suffix', 'COMMENT' => 'value', 'LEADING' => '', 'QUOTED' => '#literal = value'], $values, 'Hash and comment handling changed.');
    });

    regression('single quotes preserve Windows paths, hashes, equals signs, and backslashes', function (): void {
        $contents = <<<'ENV'
WINDOWS='C:\Users\Student\NSBM #sports=hub\new'
LITERAL='line\nnext\t'
ENV;
        $values = \SportsHub\Environment::fromFile(writeFixture($contents));
        equal('C:\Users\Student\NSBM #sports=hub\new', $values['WINDOWS'], 'The single-quoted Windows path changed.');
        equal('line\nnext\t', $values['LITERAL'], 'Single-quoted escapes must remain literal.');
    });

    regression('double quotes decode supported escapes and preserve unknown escapes', function (): void {
        $contents = <<<'ENV'
VALUE="line\nnext\t\"quote\"\\done\rend\q"
ENV;
        $values = \SportsHub\Environment::fromFile(writeFixture($contents));
        equal("line\nnext\t\"quote\"\\done\rend\\q", $values['VALUE'], 'Double-quoted escape handling changed.');
    });

    regression('dollar expressions, command substitutions, and backticks remain literal', function (): void {
        $contents = <<<'ENV'
LITERAL="${SPORTSHUB_NEVER_EXPAND} $(echo fixture-only) `echo fixture-only`"
ENV;
        $values = \SportsHub\Environment::fromFile(writeFixture($contents));
        equal('${SPORTSHUB_NEVER_EXPAND} $(echo fixture-only) `echo fixture-only`', $values['LITERAL'], 'Environment values were expanded instead of treated as data.');
    });

    regression('later duplicate keys replace earlier values', function (): void {
        equal(['DUPLICATE' => 'second'], \SportsHub\Environment::fromFile(writeFixture("DUPLICATE=first\nDUPLICATE=second\n")), 'Duplicate key precedence changed.');
    });

    regression('parser does not modify the process environment or environment superglobal', function (): void {
        $before = getenv();
        $superglobal = $_ENV;
        \SportsHub\Environment::fromFile(writeFixture("SPORTSHUB_CONFIG_TEST_UNKNOWN=fixture-only\nSPORTSHUB_DB_PASSWORD=fixture-only\n"));
        equal($before, getenv(), 'The parser changed process variables.');
        equal($superglobal, $_ENV, 'The parser changed the environment superglobal.');
    });

    regression('missing environment files are optional', function () use ($temporaryRoot): void {
        equal([], \SportsHub\Environment::fromFile($temporaryRoot . '/missing.env'), 'Missing optional environment files must yield no variables.');
    });

    regression('syntax errors report a line number without exposing line contents', function (): void {
        expectFailure(fn () => \SportsHub\Environment::fromFile(writeFixture("GOOD=fixture\n\nFIXTURE_PRIVATE_NEVER_ECHO\n")), 'line 3', ['FIXTURE_PRIVATE_NEVER_ECHO']);
    });

    foreach ([
        'invalid key' => "1INVALID=FIXTURE_PRIVATE_NEVER_ECHO\n",
        'unclosed double quote' => "KEY=\"FIXTURE_PRIVATE_NEVER_ECHO\n",
        'unclosed single quote' => "KEY='FIXTURE_PRIVATE_NEVER_ECHO\n",
        'text after quoted value' => "KEY=\"fixture\"FIXTURE_PRIVATE_NEVER_ECHO\n",
        'attached comment after quoted value' => "KEY=\"fixture\"#FIXTURE_PRIVATE_NEVER_ECHO\n",
    ] as $case => $contents) {
        regression('parser rejects ' . $case . ' without echoing contents', function () use ($contents): void {
            expectFailure(fn () => \SportsHub\Environment::fromFile(writeFixture($contents)), 'line 1', ['FIXTURE_PRIVATE_NEVER_ECHO']);
        });
    }

    regression('parser rejects null bytes', function (): void {
        expectFailure(fn () => \SportsHub\Environment::fromFile(writeFixture("KEY=fixture\0only\n")), 'invalid', ['fixture']);
    });

    regression('parser accepts the 64 KiB boundary and rejects larger files', function (): void {
        equal([], \SportsHub\Environment::fromFile(writeFixture('#' . str_repeat('x', 65535))), 'The exact size limit should be accepted.');
        expectFailure(fn () => \SportsHub\Environment::fromFile(writeFixture('#' . str_repeat('x', 65536))), '64 KiB');
    });

    regression('parser rejects a non-file input as unreadable', function () use ($temporaryRoot): void {
        expectFailure(fn () => \SportsHub\Environment::fromFile($temporaryRoot), 'not readable');
    });

    regression('defaults remain when no local or file override is present', function (): void {
        $value = settings(inspectConfiguration(configurationFixture()));
        equal('development', $value['environment'], 'The default environment changed.');
        equal('127.0.0.1', $value['database']['host'], 'The default host changed.');
        equal(3306, $value['database']['port'], 'The default port changed.');
        equal(false, $value['session']['secure'], 'The default secure flag changed.');
    });

    regression('local PHP configuration overrides defaults', function (): void {
        $backend = configurationFixture(null, ['database' => ['host' => 'localhost', 'port' => 3310, 'password' => 'fixture_local_password']]);
        $value = settings(inspectConfiguration($backend));
        equal('localhost', $value['database']['host'], 'Local configuration did not override the default host.');
        equal(3310, $value['database']['port'], 'Local configuration did not override the default port.');
        equal('fixture_local_password', $value['database']['password'], 'Local configuration did not override the default password.');
        equal('nsbm_sportshub', $value['database']['name'], 'An unrelated default was lost.');
    });

    regression('backend environment file overrides local PHP configuration', function (): void {
        $backend = configurationFixture("SPORTSHUB_DB_HOST=192.0.2.21\nSPORTSHUB_DB_PORT=3311\nSPORTSHUB_DB_PASSWORD=fixture_file_password\n", ['database' => ['host' => 'localhost', 'port' => 3310, 'password' => 'fixture_local_password']]);
        $value = settings(inspectConfiguration($backend));
        equal('192.0.2.21', $value['database']['host'], 'The environment file did not override local host settings.');
        equal(3311, $value['database']['port'], 'The environment file did not override the local port.');
        equal('fixture_file_password', $value['database']['password'], 'The environment file did not override the local password.');
    });

    regression('real process variables override environment-file and local settings', function (): void {
        $backend = configurationFixture("SPORTSHUB_DB_HOST=192.0.2.21\nSPORTSHUB_DB_PORT=3311\n", ['database' => ['host' => 'localhost', 'port' => 3310]]);
        $value = settings(inspectConfiguration($backend, ['SPORTSHUB_DB_HOST' => '192.0.2.22', 'SPORTSHUB_DB_PORT' => '3312']));
        equal('192.0.2.22', $value['database']['host'], 'The process host did not have highest priority.');
        equal(3312, $value['database']['port'], 'The process port did not have highest priority.');
    });

    regression('an empty process password deliberately overrides a nonempty file password', function (): void {
        $backend = configurationFixture("SPORTSHUB_DB_PASSWORD=fixture_file_password\n");
        $value = settings(inspectConfiguration($backend, ['SPORTSHUB_DB_PASSWORD' => '']));
        equal('', $value['database']['password'], 'An explicitly empty process password was ignored.');
    });

    regression('an empty file password deliberately overrides a nonempty local password', function (): void {
        $backend = configurationFixture("SPORTSHUB_DB_PASSWORD=\n", ['database' => ['password' => 'fixture_local_password']]);
        equal('', settings(inspectConfiguration($backend))['database']['password'], 'An explicitly empty file password was ignored.');
    });

    regression('configuration resolves backend .env independently of the working directory', function () use ($temporaryRoot): void {
        $backend = configurationFixture("SPORTSHUB_DB_HOST=192.0.2.31\n");
        $cwd = $temporaryRoot . '/unrelated-cwd';
        check(mkdir($cwd, 0700), 'Could not create the unrelated working directory.');
        file_put_contents($cwd . '/.env', "SPORTSHUB_DB_HOST=192.0.2.99\n");
        equal('192.0.2.31', settings(inspectConfiguration($backend, [], 'settings', $cwd))['database']['host'], 'Configuration used the working directory instead of the backend directory.');
    });

    regression('unknown file keys stay out of settings and the process environment', function (): void {
        $backend = configurationFixture("SPORTSHUB_UNKNOWN_SETTING=fixture-only\nUNRELATED_SETTING=fixture-only\n");
        $value = settings(inspectConfiguration($backend));
        check(!array_key_exists('SPORTSHUB_UNKNOWN_SETTING', $value), 'An unknown file key appeared in application settings.');
        check(!array_key_exists('UNRELATED_SETTING', $value), 'An unrelated file key appeared in application settings.');
    });

    regression('secure flag 0 and 1 become strict booleans', function (): void {
        equal(false, settings(inspectConfiguration(configurationFixture("SPORTSHUB_SESSION_SECURE=0\n")))['session']['secure'], 'Secure flag zero must become false.');
        equal(true, settings(inspectConfiguration(configurationFixture("SPORTSHUB_SESSION_SECURE=1\n")))['session']['secure'], 'Secure flag one must become true.');
    });

    regression('process secure flag overrides the file in both directions', function (): void {
        equal(false, settings(inspectConfiguration(configurationFixture("SPORTSHUB_SESSION_SECURE=1\n"), ['SPORTSHUB_SESSION_SECURE' => '0']))['session']['secure'], 'Process secure flag zero was ignored.');
        equal(true, settings(inspectConfiguration(configurationFixture("SPORTSHUB_SESSION_SECURE=0\n"), ['SPORTSHUB_SESSION_SECURE' => '1']))['session']['secure'], 'Process secure flag one was ignored.');
    });

    regression('invalid and explicitly empty secure flags are rejected', function (): void {
        configurationError(inspectConfiguration(configurationFixture("SPORTSHUB_SESSION_SECURE=true\n")), '0 or 1');
        configurationError(inspectConfiguration(configurationFixture("SPORTSHUB_SESSION_SECURE=1\n"), ['SPORTSHUB_SESSION_SECURE' => '']), '0 or 1');
    });

    regression('production rejects insecure cookies and accepts secure cookies', function (): void {
        configurationError(inspectConfiguration(configurationFixture("SPORTSHUB_ENV=production\nSPORTSHUB_SESSION_SECURE=0\n")), 'Production requires secure');
        equal('production', settings(inspectConfiguration(configurationFixture("SPORTSHUB_ENV=production\nSPORTSHUB_SESSION_SECURE=1\n")))['environment'], 'Secure production configuration was rejected.');
        configurationError(inspectConfiguration(configurationFixture("SPORTSHUB_ENV=production\nSPORTSHUB_SESSION_SECURE=1\n"), ['SPORTSHUB_SESSION_SECURE' => '0']), 'Production requires secure');
    });

    regression('requireAppKey rejects missing and explicitly empty overriding keys', function (): void {
        configurationError(inspectConfiguration(configurationFixture(), [], 'key'), 'at least 32');
        $backend = configurationFixture("SPORTSHUB_APP_KEY=fixture-only-key-never-use-in-production-123456789\n");
        configurationError(inspectConfiguration($backend, ['SPORTSHUB_APP_KEY' => ''], 'key'), 'at least 32');
    });

    regression('requireAppKey returns a valid known fixture key', function (): void {
        $key = 'fixture-only-key-never-use-in-production-123456789';
        $result = inspectConfiguration(configurationFixture('SPORTSHUB_APP_KEY=' . $key . "\n"), [], 'key');
        check($result['ok'] === true, 'The valid fixture application key was rejected.');
        equal($key, $result['key'], 'The fixture application key changed.');
    });
} catch (Throwable $error) {
    $failures[] = 'suite setup';
    echo 'FAIL suite setup: ' . $error->getMessage() . PHP_EOL;
} finally {
    if ($temporaryRoot !== null && is_dir($temporaryRoot)) {
        try {
            // Verify the absolute root is exactly the directory this invocation made.
            $resolved = realpath($temporaryRoot);
            check($resolved !== false && dirname($resolved) === realpath(sys_get_temp_dir()) && str_starts_with(basename($resolved), 'sportshub-config-tests-'), 'Cleanup root failed its temporary-directory check.');
            cleanFixtureTree($resolved, $resolved);
        } catch (Throwable $error) {
            $failures[] = 'fixture cleanup';
            echo 'FAIL fixture cleanup: ' . $error->getMessage() . PHP_EOL;
        }
    }
}

echo PHP_EOL . ($failures === [] ? 'PASS' : 'FAIL') . ': ' . $passed . ' configuration checks passed, ' . count($failures) . ' failed.' . PHP_EOL;
exit($failures === [] ? 0 : 1);
