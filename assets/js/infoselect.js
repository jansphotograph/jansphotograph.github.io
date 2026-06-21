// ═══════════════════════════════════════════
//  INFOSELECT — Lógica de la página de abono
// ═══════════════════════════════════════════

const WA_NUMBER     = '50768622402';
const PHONE_DISPLAY  = '+507 6862-2402';
const PHONE_DIGITS   = '6862-2402'; // copied value (local format, what people actually dial/Yappy with)

// ── Supabase — same project used across the site, public key (safe to expose) ──
const SUPABASE_URL = 'https://qwwotzscuwnduzlralew.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kiy_NJVZUEYTcNkzPDUdWA_7zpTL99g';
let sbClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch(e) {
  console.warn('No se pudo inicializar Supabase:', e);
}

// ── Load the Yappy QR image, controlled from the Master, stored in Supabase ──
async function loadYappyQr() {
  const frame = document.getElementById('qrFrame');
  const img   = document.getElementById('yappyQrImg');
  if (!frame || !img) return;

  if (!sbClient) {
    frame.classList.add('qr-missing');
    return;
  }

  try {
    const { data, error } = await sbClient
      .from('company_assets')
      .select('data_url')
      .eq('id', 'yappy_qr')
      .single();

    if (error || !data || !data.data_url) {
      frame.classList.add('qr-missing');
      return;
    }

    img.src = data.data_url;
    img.onload = () => frame.classList.add('qr-loaded');
    img.onerror = () => frame.classList.add('qr-missing');
  } catch(e) {
    frame.classList.add('qr-missing');
  }
}

document.addEventListener('DOMContentLoaded', loadYappyQr);

// ── Copy phone number to clipboard, with a graceful fallback for older browsers ──
async function copyPhoneNumber() {
  const btn     = document.getElementById('copyPhoneBtn');
  const btnText = document.getElementById('copyPhoneBtnText');
  if (!btn || !btnText) return;

  const valueToCopy = PHONE_DIGITS;
  let copied = false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(valueToCopy);
      copied = true;
    }
  } catch (e) {
    copied = false;
  }

  // Fallback for browsers without Clipboard API support (or insecure context)
  if (!copied) {
    try {
      const tmp = document.createElement('textarea');
      tmp.value = valueToCopy;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      copied = document.execCommand('copy');
      document.body.removeChild(tmp);
    } catch (e) {
      copied = false;
    }
  }

  if (copied) {
    const originalText = btnText.textContent;
    btn.classList.add('copied');
    btnText.textContent = '¡Copiado!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btnText.textContent = originalText;
    }, 2000);
  } else {
    // If copying truly fails, at least let them see/select the number manually
    alert(`No se pudo copiar automáticamente. El número es: ${PHONE_DISPLAY}`);
  }
}

// ── Build a pre-filled WhatsApp message based on the chosen payment method ──
function goToWhatsapp(method) {
  let message = '';
  if (method === 'Yappy') {
    message = 'Hola, acabo de realizar el abono del 50% por Yappy. Adjunto el comprobante de pago.';
  } else if (method === 'Transferencia bancaria') {
    message = 'Hola, me gustaría realizar el abono del 50% por transferencia bancaria. ¿Podrían enviarme los datos de la cuenta?';
  } else if (method === 'Efectivo') {
    message = 'Hola, me gustaría realizar el abono del 50% en efectivo. ¿Podemos coordinar un punto de encuentro?';
  } else {
    message = 'Hola, quisiera información sobre cómo realizar el abono del 50%.';
  }

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
}
