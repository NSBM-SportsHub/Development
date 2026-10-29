<?php
declare(strict_types=1);

date_default_timezone_set('UTC');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/Environment.php';
require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Http.php';
require_once __DIR__ . '/Validation.php';
require_once dirname(__DIR__) . '/modules/authentication-users/UserRepository.php';
require_once __DIR__ . '/Session.php';
require_once __DIR__ . '/LoginRateLimiter.php';
require_once dirname(__DIR__) . '/modules/authentication-users/AuthController.php';
require_once dirname(__DIR__) . '/modules/authentication-users/UserController.php';
require_once __DIR__ . '/ResourceBookingHttp.php';
require_once dirname(__DIR__) . '/modules/resources/ResourceController.php';
require_once dirname(__DIR__) . '/modules/bookings/BookingController.php';
require_once dirname(__DIR__) . '/modules/memberships/MembershipService.php';
require_once dirname(__DIR__) . '/modules/memberships/MembershipController.php';
require_once dirname(__DIR__) . '/modules/tournaments/TournamentService.php';
require_once dirname(__DIR__) . '/modules/tournaments/TournamentController.php';
