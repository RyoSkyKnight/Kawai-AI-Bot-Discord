const unitMultipliers = {
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  detik: 1000,
  dtk: 1000,
  det: 1000,
  m: 60000,
  min: 60000,
  mins: 60000,
  minute: 60000,
  minutes: 60000,
  menit: 60000,
  mnt: 60000,
  h: 3600000,
  hr: 3600000,
  hrs: 3600000,
  hour: 3600000,
  hours: 3600000,
  jam: 3600000,
  d: 86400000,
  day: 86400000,
  days: 86400000,
  hari: 86400000,
};

function parseDuration(duration) {
  if (!duration && duration !== 0) return null;
  const raw = String(duration).trim().toLowerCase();

  // If pure digits, treat as seconds
  if (/^\d+$/.test(raw)) {
    const val = parseInt(raw, 10);
    return val > 0 ? val * 1000 : null;
  }

  const regex = /(\d+)\s*([a-zA-Z]+)/g;
  let totalMs = 0;
  let matchFound = false;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unitMultipliers[unit]) {
      totalMs += value * unitMultipliers[unit];
      matchFound = true;
    }
  }

  return matchFound && totalMs > 0 ? totalMs : null;
}

function formatDuration(ms, lang = 'en') {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remHours = hours % 24;
  const remMinutes = minutes % 60;
  const remSeconds = seconds % 60;

  if (lang === 'id') {
    const parts = [];
    if (days > 0) parts.push(`${days} hari`);
    if (remHours > 0) parts.push(`${remHours} jam`);
    if (remMinutes > 0) parts.push(`${remMinutes} menit`);
    if (remSeconds > 0 || parts.length === 0) parts.push(`${remSeconds} detik`);
    return parts.join(' ');
  }

  if (days > 0) return `${days}d ${remHours}h`;
  if (hours > 0) return `${hours}h ${remMinutes}m`;
  if (minutes > 0) return `${minutes}m ${remSeconds}s`;
  return `${seconds}s`;
}

module.exports = { parseDuration, formatDuration };

