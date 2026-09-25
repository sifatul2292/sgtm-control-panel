const DENIED = new Set([
  "password",
  "password123",
  "changeme",
  "change-this-password",
  "admin123456789"
]);

export function staffPasswordPolicyErrors(password, username = "") {
  const value = String(password || "");
  const normalized = value.toLowerCase();
  const errors = [];
  if (value.length < 12) errors.push("Staff passwords must contain at least 12 characters.");
  if (DENIED.has(normalized)) errors.push("The configured staff password is not allowed.");
  const user = String(username || "").trim().toLowerCase();
  if (user.length >= 4 && normalized.includes(user)) errors.push("Staff passwords must not contain the staff username.");
  return errors;
}
