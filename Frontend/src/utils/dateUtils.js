/**
 * Get the current date and time in IST (Indian Standard Time)
 * Converts UTC to IST by adding 5 hours 30 minutes offset
 * @returns {string} Formatted IST date string — "YYYY-MM-DD HH:MM:SS"
 * @example getFormattedISTDate() → "2026-02-19 14:30:45"
 */
export const getFormattedISTDate = () => {
  const currentUTC = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(currentUTC.getTime() + istOffset);

  return istDate.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
};

/**
 * Convert a Date object to ISO string format for sending to backend API
 * Backend will handle IST conversion using convertToIST()
 * @param {Date} date - JavaScript Date object
 * @returns {string} ISO UTC string — "2026-02-19T02:30:00.000Z"
 * @example toISOForApi(new Date(2026, 1, 19, 8, 0)) → "2026-02-19T02:30:00.000Z"
 */
export const toISOForApi = (date) => {
  return date.toISOString();
};

/**
 * Convert a Date object to "YYYY-MM-DDTHH:mm" format
 * Required by HTML <input type="datetime-local" /> for value binding
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted string — "2026-02-19T08:00"
 * @example toDateTimeLocal(new Date()) → "2026-02-19T14:30"
 */
export const toDateTimeLocal = (date) => {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Format any date value for API request
 * Converts to ISO 8601 UTC string format
 * @param {string|Date} date - Date string or Date object
 * @returns {string} ISO format — "2026-02-19T08:00:00.000Z" or empty string
 * @example formatDateForApi("2026-02-19") → "2026-02-19T00:00:00.000Z"
 */
export const formatDateForApi = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString();
};

/**
 * Get today's shift date range (8:00 AM today → now)
 * Returns ISO UTC strings for API and local strings for input binding
 * Backend converts ISO to IST using convertToIST()
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * - startDate/endDate → ISO UTC strings (for API)
 * - startLocal/endLocal → "YYYY-MM-DDTHH:mm" (for datetime-local input)
 * @example getTodayRange() → { startDate: "2026-02-19T02:30:00.000Z", startLocal: "2026-02-19T08:00", ... }
 */
export const getTodayRange = () => {
  const now = new Date();
  const today8AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );

  return {
    startDate: today8AM.toISOString(),
    endDate: now.toISOString(),
    startLocal: toDateTimeLocal(today8AM),
    endLocal: toDateTimeLocal(now),
  };
};

/**
 * Get yesterday's shift date range (yesterday 8:00 AM → today 8:00 AM)
 * Full 24hr shift cycle
 * Backend converts ISO to IST using convertToIST()
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * @example getYesterdayRange() → { startDate: "2026-02-18T02:30:00.000Z", ... }
 */
export const getYesterdayRange = () => {
  const now = new Date();
  const today8AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );
  const yesterday8AM = new Date(today8AM);
  yesterday8AM.setDate(today8AM.getDate() - 1);

  return {
    startDate: yesterday8AM.toISOString(),
    endDate: today8AM.toISOString(),
    startLocal: toDateTimeLocal(yesterday8AM),
    endLocal: toDateTimeLocal(today8AM),
  };
};

/**
 * Get Month-To-Date (MTD) shift date range
 * 1st of current month 8:00 AM → current time
 * Backend converts ISO to IST using convertToIST()
 * @returns {{ startDate: string, endDate: string, startLocal: string, endLocal: string }}
 * @example getMTDRange() → { startDate: "2026-02-01T02:30:00.000Z", ... }
 */
export const getMTDRange = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);

  return {
    startDate: startOfMonth.toISOString(),
    endDate: now.toISOString(),
    startLocal: toDateTimeLocal(startOfMonth),
    endLocal: toDateTimeLocal(now),
  };
};

/**
 * Format a date string/object for datetime-local input value binding
 * Handles timezone offset to show correct local time
 * @param {string|Date} date - Date string or Date object
 * @returns {string} "YYYY-MM-DDTHH:mm" or empty string
 * @example formatDateTimeLocal("2026-02-19T08:00:00.000Z") → "2026-02-19T13:30"
 */
export const formatDateTimeLocal = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};
