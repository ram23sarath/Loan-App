// src/utils/dateFormatter.ts

/**
 * Formats a date string (e.g., "2024-07-31") into a more readable format.
 * @param dateString The date string to format.
 * @param formatType The desired format type: 'display' for dd/mm/yyyy or 'whatsapp' for dd/mm/yy.
 * @returns The formatted date string.
 */
export const formatDate = (dateString: string, formatType: 'display' | 'whatsapp' = 'display'): string => {
  if (!dateString) return '';
  
  // Create a date object, ensuring it's treated as UTC to avoid timezone issues.
  // The 'T00:00:00' ensures the date isn't shifted by the user's local timezone.
  const date = new Date(dateString + 'T00:00:00');
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateString; // Return original string if it's not a valid date
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (formatType === 'whatsapp') {
    return `${day}/${month}/${String(year).slice(-2)}`;
  }

  // Default to 'display' format
  return `${day}/${month}/${year}`;
};
