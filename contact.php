<?php
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  echo "Méthode non autorisée";
  exit;
}

/* Piège à robots : ce champ est invisible pour un humain.
   Un script qui remplit tous les champs du formulaire s'y fera prendre. */
if (!empty($_POST["site_web"] ?? "")) {
  echo "OK";
  exit;
}

/* Limite grossière : un même client ne peut pas déclencher deux envois
   en moins de 30 secondes (ralentit les scripts de spam basiques). */
session_start();
$now = time();
if (isset($_SESSION["last_contact"]) && ($now - $_SESSION["last_contact"]) < 30) {
  echo "Merci de patienter avant un nouvel envoi.";
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

if (strlen($name) > 100 || strlen($message) > 5000 || strlen($service) > 100) {
  echo "Message trop long";
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
  $_SESSION["last_contact"] = $now;
  echo "OK";
} else {
  echo "Erreur envoi mail";
}
