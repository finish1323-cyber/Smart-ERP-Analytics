import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "EGP") {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

export function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}
