/**
 * Canal SMS — DÉSACTIVÉ (payant). Stub prévu pour plus tard.
 *
 * Pour l'activer : choisir un fournisseur (Africa's Talking, Twilio, API SMS Orange CI…),
 * implémenter sendSms() puis exporter un Notifier et l'ajouter au tableau `notifiers`
 * dans ./index.ts. Ne pas oublier d'ajouter "sms" dans le CHECK de alert_messages.channel
 * et dans le type Notifier["name"] (./types.ts).
 */
export async function sendSms(_phone: string, _text: string): Promise<boolean> {
  return false;
}
