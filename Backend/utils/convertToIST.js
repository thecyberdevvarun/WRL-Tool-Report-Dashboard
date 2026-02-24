// Helper function to convert to IST
export const convertToIST = (date) => {
  return new Date(new Date(date).getTime() + 330 * 60000);
};
