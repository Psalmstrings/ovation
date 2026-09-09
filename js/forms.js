/* ==========================================================================
   OVATION MUSIC HOUSE — FORM HANDLING & INTERACTIVE MODALS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initContactForm();
  initWhatsAppButton();
  initModalCloseHandlers();
});

/* ----- 1. CONTACT FORM HANDLER & VALIDATION ----- */
function initContactForm() {
  const form = document.getElementById('ovationContactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const service = document.getElementById('serviceRequired')?.value;
    const preferredDate = document.getElementById('preferredDate')?.value;
    const message = document.getElementById('message')?.value.trim();

    // Validation
    if (!fullName || !email || !phone || !service || !message) {
      showModal('Missing Information', 'Please complete all required fields before submitting your enquiry.', '⚠️');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending...</span>';

    const enquiryData = {
      fullName,
      email,
      phone,
      serviceRequired: service,
      preferredDate: preferredDate || 'N/A',
      message
    };

    try {
      const result = await window.OvationDB.saveEnquiry(enquiryData);
      
      form.reset();
      showModal(
        'Enquiry Received!', 
        `Thank you, ${fullName}. Your request for ${service} has been submitted successfully. Our sound specialists will contact you shortly.`,
        '✨'
      );
    } catch (err) {
      console.error(err);
      showModal('Submission Error', 'An issue occurred while submitting your enquiry. Please reach us directly via WhatsApp or Phone.', '❌');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

/* ----- 2. WHATSAPP DIRECT CHAT BUTTON HANDLER ----- */
function initWhatsAppButton() {
  const waBtn = document.getElementById('directWhatsAppBtn');
  if (!waBtn) return;

  waBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const phone = document.getElementById('phone')?.value || '';
    const name = document.getElementById('fullName')?.value || 'a client';
    const service = document.getElementById('serviceRequired')?.value || 'Music & Sound Solutions';

    const defaultText = `Hello Ovation Music House, I am ${name} inquiring about ${service}. Please assist me.`;
    const encodedMsg = encodeURIComponent(defaultText);

    // Official Ovation WhatsApp Number
    const waUrl = `https://wa.me/2348001234567?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  });
}

/* ----- 3. MODAL UI HANDLERS ----- */
function showModal(title, text, icon = '✦') {
  let modalOverlay = document.getElementById('appModalOverlay');
  
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'appModalOverlay';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-icon" id="modalIcon">✦</div>
        <h3 class="modal-title" id="modalTitle" style="font-size:1.5rem; margin-bottom:0.75rem; color:#D4AF37;"></h3>
        <p class="modal-text" id="modalText" style="color:#CBD5E1; margin-bottom:1.5rem; font-size:0.95rem;"></p>
        <button class="btn btn-gold btn-sm" id="closeModalBtn">Close Window</button>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    modalOverlay.querySelector('#closeModalBtn').addEventListener('click', () => {
      modalOverlay.classList.remove('active');
    });

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }

  document.getElementById('modalIcon').innerText = icon;
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalText').innerText = text;
  
  modalOverlay.classList.add('active');
}

function initModalCloseHandlers() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('appModalOverlay');
      if (modal) modal.classList.remove('active');
    }
  });
}

// Make showModal globally accessible
window.showModal = showModal;
