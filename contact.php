<?php
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  echo "Méthode non autorisée";
  exit;
}

$name    = htmlspecialchars(trim($_POST["name"] ?? ""));
$email   = htmlspecialchars(trim($_POST["email"] ?? ""));
$service = htmlspecialchars(trim($_POST["service"] ?? ""));
$message = htmlspecialchars(trim($_POST["message"] ?? ""));

if (!$name || !$email || !$message) {
  echo "Champs manquants";
  exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  echo "Email invalide";
  exit;
}

$to      = "info@pxlstudio.be";
$subject = "Nouveau message – Pixel Studio";
$body    = "Nom : $name\nEmail : $email\nService : $service\n\nMessage :\n$message";
$headers = "From: no-reply@pxlstudio.be\r\nReply-To: $email";

if (mail($to, $subject, $body, $headers)) {
  echo "OK";
} else {
  echo "Erreur envoi mail";
}
