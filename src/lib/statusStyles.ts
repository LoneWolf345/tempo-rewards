export const getStatusStyles = (status: string): string => {
  const s = status.toLowerCase();
  if (s === "used") return "bg-green-600 text-white border-transparent";
  if (s === "sent") return "bg-sky-400 text-white border-transparent";
  if (s === "clicked" || s === "opened") return "bg-blue-700 text-white border-transparent";
  if (s === "expired" || s === "credited") return "bg-amber-500 text-white border-transparent";
  return "";
};
