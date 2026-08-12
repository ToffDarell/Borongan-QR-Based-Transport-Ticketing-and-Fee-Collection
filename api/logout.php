<?php
// api/logout.php
require 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'error' => 'Method not allowed'], 405);
}

endAuthenticatedSession();
respond(['success' => true]);
?>
