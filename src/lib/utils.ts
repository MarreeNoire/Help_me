import type { LatLng } from "./types";

/** Numéros d'urgence (Côte d'Ivoire) — À VÉRIFIER avant la mise en production. */
export const EMERGENCY = {
  police: "110",
  pompiers: "180",
  samu: "185",
} as const;

export function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  // Côté navigateur : l'origine courante est toujours l'URL publique réelle,
  // même si NEXT_PUBLIC_APP_URL n'était pas définie au moment du build.
  if (typeof window !== "undefined" && window.location?.origin?.startsWith("http")) {
    return window.location.origin;
  }
  // Repli serveur : URL fournie automatiquement par Vercel
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function mapsLink(loc: LatLng) {
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

export function directionsLink(loc: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
}

/** Message d'alerte standard. */
export function buildAlertMessage(name: string, trackUrl?: string | null, loc?: LatLng | null) {
  const lines = [`🚨 ${name} a besoin d'aide ! Merci de réagir immédiatement.`];
  if (trackUrl) lines.push(`Position en direct : ${trackUrl}`);
  if (loc) lines.push(`Dernière position connue : ${mapsLink(loc)}`);
  return lines.join("\n");
}

/**
 * Normalise un numéro pour wa.me / sms: (chiffres uniquement, avec indicatif).
 * Côte d'Ivoire : 10 chiffres (ex. 0707070707) -> 2250707070707
 */
export function normalizePhone(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (phone.trim().startsWith("00")) digits = digits.replace(/^00/, "");
  if (digits.length === 10) digits = "225" + digits;
  return digits;
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function smsLink(phone: string, text: string) {
  return `sms:+${normalizePhone(phone)}?&body=${encodeURIComponent(text)}`;
}

export function waShareLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function timeAgo(iso: string | number | Date) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `il y a ${diff} s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
