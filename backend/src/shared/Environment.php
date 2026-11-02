<?php
declare(strict_types=1);

namespace SportsHub;

/** Read local configuration as data without modifying the process environment. */
final class Environment
{
    public static function fromFile(string $path): array
    {
        if (!file_exists($path)) {
            return [];
        }
        if (!is_file($path) || !is_readable($path)) {
            throw new \RuntimeException('The backend .env file is not readable.');
        }
        $size = filesize($path);
        if ($size === false || $size > 65536) {
            throw new \RuntimeException('The backend .env file exceeds the 64 KiB limit.');
        }
        $contents = file_get_contents($path, false, null, 0, 65537);
        if ($contents === false) {
            throw new \RuntimeException('The backend .env file could not be read.');
        }
        if (strlen($contents) > 65536 || str_contains($contents, "\0")) {
            throw new \RuntimeException('The backend .env file is invalid or exceeds the 64 KiB limit.');
        }
        if (str_starts_with($contents, "\xEF\xBB\xBF")) {
            $contents = substr($contents, 3);
        }
        $variables = [];
        foreach (preg_split('/\r\n|\n|\r/', $contents) as $index => $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!preg_match('/\A(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)\z/', $line, $match)) {
                throw self::invalidLine($index + 1);
            }
            $variables[$match[1]] = self::value($match[2], $index + 1);
        }
        return $variables;
    }

    private static function value(string $raw, int $line): string
    {
        if ($raw === '' || str_starts_with($raw, '#')) {
            return '';
        }
        $quote = $raw[0];
        if ($quote !== "'" && $quote !== '"') {
            // A # attached to an unquoted value is literal; whitespace starts a comment.
            return rtrim(preg_split('/[ \t]+#/', $raw, 2)[0]);
        }
        $value = '';
        $length = strlen($raw);
        for ($index = 1; $index < $length; $index++) {
            $character = $raw[$index];
            if ($character === $quote) {
                $tail = substr($raw, $index + 1);
                if ($tail !== '' && !preg_match('/\A[ \t]+(?:#.*)?\z/', $tail)) {
                    throw self::invalidLine($line);
                }
                return $value;
            }
            if ($quote === '"' && $character === '\\' && $index + 1 < $length) {
                $next = $raw[++$index];
                $value .= match ($next) {
                    '"' => '"',
                    '\\' => '\\',
                    'n' => "\n",
                    'r' => "\r",
                    't' => "\t",
                    default => '\\' . $next,
                };
            } else {
                $value .= $character;
            }
        }
        throw self::invalidLine($line);
    }

    private static function invalidLine(int $line): \RuntimeException
    {
        // Never include a line's contents: it may contain a password or application key.
        return new \RuntimeException('Invalid backend .env syntax on line ' . $line . '.');
    }
}
