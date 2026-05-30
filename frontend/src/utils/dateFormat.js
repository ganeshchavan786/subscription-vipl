// Date formatting utilities
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

/**
 * Format date string to dd-MMM-yyyy
 * Input:  "2021-04-01" or Date object
 * Output: "01-APR-2021"
 */
export const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return dateStr;
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
};

/**
 * Format month label: "APR 2024"
 */
export const fmtMonth = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Get Financial Year label from date
 * Apr 2024 → "FY 2024-25"
 */
export const getFYLabel = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  const fyStart = m >= 3 ? y : y - 1; // April=3
  return `FY ${fyStart}-${String(fyStart + 1).slice(2)}`;
};

/**
 * Get FY start year from date
 * Apr 2024 → 2024
 */
export const getFYStartYear = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth();
  const y = d.getFullYear();
  return m >= 3 ? y : y - 1;
};

/**
 * Get all FY years between two dates
 */
export const getFYRange = (minDate, maxDate) => {
  const start = getFYStartYear(minDate);
  const end   = getFYStartYear(maxDate);
  const years = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
};

export default fmtDate;
