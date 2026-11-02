export function validateNewPassword(password) {
  if (password.includes("\0")) return "Your password contains an unsupported character.";
  if ([...password].length < 12) return "Use at least 12 characters for your password.";
  if (new TextEncoder().encode(password).length > 72) return "This password is too long. Use a shorter password (up to 72 bytes).";
  return "";
}
