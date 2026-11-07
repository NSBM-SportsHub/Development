<?php
declare(strict_types=1);

// The combined deployment exposes only public/, keeping PHP source/config private.
require dirname(__DIR__, 2) . '/backend/public/index.php';
