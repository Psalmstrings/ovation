/* ==========================================================================
   OVATION MUSIC HOUSE — MUSIC CLASS BOOKING ENGINE
   Pure Vanilla JavaScript. No frameworks.
   Requires: js/firebase.js (OvationDB singleton)
   EmailJS loaded via CDN in booking.html
   ========================================================================== */

/* ----- CONFIGURATION ----- */

// EmailJS Configuration
const EMAILJS_SERVICE_ID  = 'service_kozue8t';
const EMAILJS_TEMPLATE_ID = 'template_nlt7cet';
const EMAILJS_PUBLIC_KEY  = 'dPUWsvdn-dDFYjg5n';
const CENTRAL_ADMIN_EMAIL = 'info@ovationmusichouse.com';

// Instruments (add new entries here to extend the list)
const INSTRUMENTS = [
  { id: 'drums',       name: 'Drums',                    emoji: '🥁' },
  { id: 'saxophone',   name: 'Saxophone',                emoji: '🎷' },
  { id: 'piano',       name: 'Piano',                    emoji: '🎹' },
  { id: 'trumpet',     name: 'Trumpet',                  emoji: '🎺' },
  { id: 'guitar',      name: 'Guitar',                   emoji: '🎸' },
  { id: 'trombone',    name: 'Trombone',                 emoji: '🎵' },
  { id: 'violin',      name: 'Violin',                   emoji: '🎻' },
  { id: 'bass-guitar', name: 'Bass Guitar',              emoji: '🎸' },
  { id: 'keyboard',    name: 'Keyboard',                 emoji: '🎹' },
  { id: 'clarinet',    name: 'Clarinet',                 emoji: '🎼' },
  { id: 'flute',       name: 'Flute',                    emoji: '🪈' },
  { id: 'vocal',       name: 'Vocal Training',           emoji: '🎤' },
];

// Pricing per session
const PRICING = {
  30: { price: 5000,  label: '30 Min' },
  45: { price: 7000,  label: '45 Min' },
  60: { price: 10000, label: '60 Min' },
};

// Frequency options
const FREQUENCIES = [
  { value: 1, label: 'Once a Week',       days: 1 },
  { value: 2, label: 'Twice a Week',      days: 2 },
  { value: 3, label: 'Three Times a Week', days: 3 },
];

// Available class days (Sunday is excluded)
const CLASS_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Class hours (10:00 AM – 6:00 PM = 10:00 – 18:00)
const CLASS_START_HOUR = 10;
const CLASS_END_HOUR   = 18; // No class must END after this hour

/* ----- UTILITY FUNCTIONS ----- */

function formatNaira(amount) {
  return '\u20A6' + amount.toLocaleString('en-NG');
}

function generateTimeSlots(durationMinutes) {
  const slots = [];
  let currentMinutes = CLASS_START_HOUR * 60;
  const endMinutes = CLASS_END_HOUR * 60;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const hours   = Math.floor(currentMinutes / 60);
    const mins    = currentMinutes % 60;
    const period  = hours >= 12 ? 'PM' : 'AM';
    const display = (hours > 12 ? hours - 12 : hours === 0 ? 12 : hours) +
                    (mins > 0 ? ':' + String(mins).padStart(2, '0') : ':00') +
                    ' ' + period;
    const value   = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
    slots.push({ display, value });
    currentMinutes += 30; // 30-minute increments
  }
  return slots;
}

function generateBookingReference() {
  const now  = new Date();
  const date = now.getFullYear().toString() +
               String(now.getMonth() + 1).padStart(2, '0') +
               String(now.getDate()).padStart(2, '0');
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let random   = '';
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'BKG-' + date + '-' + random;
}

function formatDateDisplay(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag] || tag)
  );
}

/* ----- BOOKING SYSTEM CLASS ----- */

class BookingSystem {
  constructor() {
    this.currentStep  = 1;
    this.totalSteps   = 3;
    this.isSubmitting = false;

    // Booking state
    this.state = {
      instrument:      null,
      frequency:       null,
      frequencyDays:   0,
      selectedDays:    [],
      duration:        null,
      selectedTime:    null,
      classType:       null,
      physicalAddress: '',
      fullName:        '',
      phone:           '',
      email:           '',
    };

    this.init();
  }

  init() {
    this.renderInstruments();
    this.renderFrequencies();
    this.renderDays();
    this.renderDurations();
    this.bindEvents();
    this.updateStepIndicator();
    this.updateSummary();
  }

  /* ----- RENDER INSTRUMENTS ----- */
  renderInstruments() {
    const grid = document.getElementById('instrumentGrid');
    if (!grid) return;
    grid.innerHTML = INSTRUMENTS.map(inst => `
      <div class="instrument-card" data-instrument="${escHtml(inst.id)}" title="${escHtml(inst.name)}">
        <span class="instrument-emoji">${inst.emoji}</span>
        <span class="instrument-name">${escHtml(inst.name)}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.instrument-card').forEach(card => {
      card.addEventListener('click', () => {
        grid.querySelectorAll('.instrument-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.state.instrument = card.dataset.instrument;
        const inst = INSTRUMENTS.find(i => i.id === card.dataset.instrument);
        this.state.instrumentName = inst ? inst.name : card.dataset.instrument;
        this.updateSummary();
        this.clearError('instrument');
      });
    });
  }

  /* ----- RENDER FREQUENCY ----- */
  renderFrequencies() {
    const container = document.getElementById('frequencyOptions');
    if (!container) return;
    container.innerHTML = FREQUENCIES.map(f => `
      <div class="frequency-option" data-value="${f.value}" data-days="${f.days}">
        <div class="frequency-number">${f.value}x</div>
        <div class="frequency-label">${escHtml(f.label)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.frequency-option').forEach(opt => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('.frequency-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.state.frequency     = parseInt(opt.dataset.value);
        this.state.frequencyDays = parseInt(opt.dataset.days);
        this.state.frequencyLabel = FREQUENCIES.find(f => f.value === this.state.frequency)?.label || '';
        // Reset days when frequency changes
        this.state.selectedDays = [];
        this.renderDays();
        this.updateSummary();
        this.clearError('frequency');
      });
    });
  }

  /* ----- RENDER DAYS ----- */
  renderDays() {
    const grid = document.getElementById('daysGrid');
    const helpText = document.getElementById('daysHelpText');
    if (!grid) return;

    const maxDays = this.state.frequencyDays || 0;

    if (helpText) {
      if (maxDays === 0) {
        helpText.textContent = 'Please select your class frequency above first.';
      } else {
        helpText.textContent = `Select exactly ${maxDays} day${maxDays > 1 ? 's' : ''} for your classes.`;
      }
    }

    grid.innerHTML = CLASS_DAYS.map(day => `
      <div>
        <input type="checkbox" class="day-checkbox-item" id="day_${day}" value="${day}"
          ${this.state.selectedDays.includes(day) ? 'checked' : ''}
          ${maxDays === 0 ? 'disabled' : ''}>
        <label class="day-checkbox-label ${maxDays === 0 ? 'disabled-day' : ''}" for="day_${day}">${day}</label>
      </div>
    `).join('');

    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const day = cb.value;
        if (cb.checked) {
          if (this.state.selectedDays.length >= maxDays) {
            cb.checked = false;
            this.showInlineError('days', `You can only select ${maxDays} day${maxDays > 1 ? 's' : ''} for your chosen frequency.`);
            return;
          }
          this.state.selectedDays.push(day);
        } else {
          this.state.selectedDays = this.state.selectedDays.filter(d => d !== day);
        }
        this.clearError('days');
        this.updateSummary();
      });
    });
  }

  /* ----- RENDER DURATIONS ----- */
  renderDurations() {
    const container = document.getElementById('durationOptions');
    if (!container) return;
    container.innerHTML = Object.entries(PRICING).map(([mins, data]) => `
      <div class="duration-option" data-duration="${mins}">
        <div class="duration-time">${mins}</div>
        <div class="duration-label">Minutes</div>
        <div class="duration-price">${formatNaira(data.price)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.duration-option').forEach(opt => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('.duration-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.state.duration = parseInt(opt.dataset.duration);
        this.state.selectedTime = null; // Reset time when duration changes
        this.renderTimeSlots();
        this.updateSummary();
        this.clearError('duration');
      });
    });
  }

  /* ----- RENDER TIME SLOTS ----- */
  renderTimeSlots() {
    const grid = document.getElementById('timeSlotGrid');
    if (!grid) return;

    if (!this.state.duration) {
      grid.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.85rem; font-style:italic; grid-column:1/-1;">Please select a duration above to see available time slots.</p>';
      return;
    }

    const slots = generateTimeSlots(this.state.duration);
    grid.innerHTML = slots.map(slot => `
      <button class="time-slot-btn ${this.state.selectedTime === slot.value ? 'selected' : ''}"
              data-value="${slot.value}" data-display="${escHtml(slot.display)}" type="button">
        ${escHtml(slot.display)}
      </button>
    `).join('');

    grid.querySelectorAll('.time-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.state.selectedTime        = btn.dataset.value;
        this.state.selectedTimeDisplay = btn.dataset.display;
        this.updateSummary();
        this.clearError('time');
      });
    });
  }

  /* ----- BIND EVENTS ----- */
  bindEvents() {
    // Class type toggle
    document.querySelectorAll('.class-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.class-type-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.state.classType = opt.dataset.type;

        const addressContainer = document.getElementById('addressFieldContainer');
        if (addressContainer) {
          if (this.state.classType === 'Physical') {
            addressContainer.classList.add('visible');
          } else {
            addressContainer.classList.remove('visible');
            this.state.physicalAddress = '';
            const addrInput = document.getElementById('bookingAddress');
            if (addrInput) addrInput.value = '';
          }
        }
        this.updateSummary();
        this.clearError('classType');
      });
    });

    // Address field
    const addressInput = document.getElementById('bookingAddress');
    if (addressInput) {
      addressInput.addEventListener('input', () => {
        this.state.physicalAddress = addressInput.value.trim();
        this.updateSummary();
      });
    }

    // Student info inputs
    ['bookingFullName', 'bookingPhone', 'bookingEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.state.fullName = document.getElementById('bookingFullName')?.value.trim() || '';
          this.state.phone    = document.getElementById('bookingPhone')?.value.trim() || '';
          this.state.email    = document.getElementById('bookingEmail')?.value.trim() || '';
          this.updateSummary();
        });
      }
    });

    // Navigation buttons
    document.getElementById('nextToStep2')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('backToStep1')?.addEventListener('click', () => this.goToStep(1));
    document.getElementById('nextToStep3')?.addEventListener('click', () => this.goToStep(3));
    document.getElementById('backToStep2')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('submitBookingBtn')?.addEventListener('click', () => this.submitBooking());
    document.getElementById('bookAnotherBtn')?.addEventListener('click', () => this.resetForm());
  }

  /* ----- STEP NAVIGATION ----- */
  goToStep(step) {
    // Validate before advancing
    if (step > this.currentStep) {
      if (!this.validateStep(this.currentStep)) return;
    }

    document.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active'));
    const targetStep = document.getElementById('step' + step);
    if (targetStep) targetStep.classList.add('active');

    this.currentStep = step;
    this.updateStepIndicator();

    // Scroll to top of form
    const panel = document.querySelector('.booking-form-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ----- STEP INDICATOR ----- */
  updateStepIndicator() {
    document.querySelectorAll('.step-item').forEach(item => {
      const stepNum = parseInt(item.dataset.step);
      item.classList.remove('active', 'completed');
      if (stepNum === this.currentStep) item.classList.add('active');
      if (stepNum < this.currentStep) item.classList.add('completed');
    });

    document.querySelectorAll('.step-line').forEach(line => {
      const lineStep = parseInt(line.dataset.afterStep);
      line.classList.toggle('completed', lineStep < this.currentStep);
    });
  }

  /* ----- VALIDATE STEP ----- */
  validateStep(step) {
    let valid = true;

    if (step === 1) {
      if (!this.state.instrument) {
        this.showInlineError('instrument', 'Please select an instrument.');
        valid = false;
      }
      if (!this.state.frequency) {
        this.showInlineError('frequency', 'Please select a class frequency.');
        valid = false;
      }
      if (this.state.selectedDays.length !== this.state.frequencyDays) {
        this.showInlineError('days', `Please select exactly ${this.state.frequencyDays} day${this.state.frequencyDays > 1 ? 's' : ''}.`);
        valid = false;
      }
      if (!this.state.duration) {
        this.showInlineError('duration', 'Please select a class duration.');
        valid = false;
      }
      if (!this.state.selectedTime) {
        this.showInlineError('time', 'Please select a class time.');
        valid = false;
      }
      if (!this.state.classType) {
        this.showInlineError('classType', 'Please select Online or Physical class.');
        valid = false;
      }
      if (this.state.classType === 'Physical' && !this.state.physicalAddress) {
        this.showInlineError('address', 'Please enter your physical class address.');
        valid = false;
      }
    }

    if (step === 2) {
      if (!this.state.fullName) {
        this.setFieldError('bookingFullName', 'Full name is required.');
        valid = false;
      }
      if (!this.state.phone || this.state.phone.length < 7) {
        this.setFieldError('bookingPhone', 'Please enter a valid phone number.');
        valid = false;
      }
      if (!this.state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.state.email)) {
        this.setFieldError('bookingEmail', 'Please enter a valid email address.');
        valid = false;
      }
    }

    return valid;
  }

  setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + 'Error');
    if (field) field.classList.add('error');
    if (errEl) { errEl.textContent = message; errEl.classList.add('visible'); }
  }

  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + 'Error');
    if (field) field.classList.remove('error');
    if (errEl) errEl.classList.remove('visible');
  }

  showInlineError(key, message) {
    const el = document.getElementById('error_' + key);
    if (el) { el.textContent = message; el.classList.add('visible'); }
  }

  clearError(key) {
    const el = document.getElementById('error_' + key);
    if (el) el.classList.remove('visible');
  }

  /* ----- LIVE BOOKING SUMMARY ----- */
  updateSummary() {
    const pricing = this.state.duration ? PRICING[this.state.duration] : null;
    const pricePerSession = pricing ? pricing.price : 0;
    const weeklyCost = pricePerSession * (this.state.frequency || 0);
    this.state.pricePerSession = pricePerSession;
    this.state.weeklyCost      = weeklyCost;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('sumInstrument',    this.state.instrumentName || '—');
    set('sumFrequency',     this.state.frequencyLabel || '—');
    set('sumDays',          this.state.selectedDays.length ? this.state.selectedDays.join(', ') : '—');
    set('sumTime',          this.state.selectedTimeDisplay || '—');
    set('sumDuration',      this.state.duration ? this.state.duration + ' Minutes' : '—');
    set('sumClassType',     this.state.classType || '—');
    set('sumAddress',       this.state.classType === 'Physical' ? (this.state.physicalAddress || '—') : 'N/A (Online)');
    set('sumStudent',       this.state.fullName || '—');
    set('sumPhone',         this.state.phone || '—');
    set('sumEmail',         this.state.email || '—');
    set('sumPriceSession',  pricePerSession ? formatNaira(pricePerSession) : '—');
    set('sumWeeklyCost',    weeklyCost ? formatNaira(weeklyCost) : '—');
  }

  /* ----- SUBMIT BOOKING ----- */
  async submitBooking() {
    if (this.isSubmitting) return;

    // Clear inputs from step 2
    this.state.fullName = document.getElementById('bookingFullName')?.value.trim() || '';
    this.state.phone    = document.getElementById('bookingPhone')?.value.trim() || '';
    this.state.email    = document.getElementById('bookingEmail')?.value.trim() || '';

    if (!this.validateStep(2)) return;

    this.isSubmitting = true;
    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Processing...';
    }

    const bookingReference = generateBookingReference();
    const now = new Date();

    const bookingData = {
      bookingReference,
      fullName:        this.state.fullName,
      phoneNumber:     this.state.phone,
      email:           this.state.email,
      instrument:      this.state.instrumentName,
      classType:       this.state.classType,
      physicalAddress: this.state.classType === 'Physical' ? this.state.physicalAddress : '',
      frequency:       this.state.frequencyLabel,
      selectedDays:    this.state.selectedDays.join(', '),
      selectedTime:    this.state.selectedTimeDisplay,
      duration:        this.state.duration + ' Minutes',
      pricePerSession: this.state.pricePerSession,
      weeklyCost:      this.state.weeklyCost,
      status:          'Pending',
    };

    try {
      // Step 1: Save to Firebase Firestore
      const result = await window.OvationDB.saveBooking(bookingData);
      console.log('Booking saved to Firebase:', result.id, '| Mode:', result.mode);

      // Step 2: Send EmailJS notification (non-blocking — Firebase booking is already saved)
      try {
        await this.sendAdminEmailNotification(bookingData, now);
        console.log('Admin email notification sent via EmailJS.');
      } catch (emailErr) {
        // EmailJS failed — booking is still saved. Log and continue.
        console.error('EmailJS notification failed (booking is still saved):', emailErr);
      }

      // Step 3: Show confirmation
      this.showConfirmation(bookingData, now);

    } catch (firebaseErr) {
      // Firebase completely failed — do NOT send email
      console.error('Firebase booking save failed:', firebaseErr);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🎵 Confirm Booking';
      }
      this.isSubmitting = false;

      if (window.showModal) {
        window.showModal('Booking Failed', 'Unable to save your booking due to a connection issue. Please check your internet and try again, or contact us directly via WhatsApp.', '❌');
      } else {
        alert('Booking failed. Please try again or contact us directly.');
      }
    }
  }

  /* ----- SEND EMAILJS ADMIN NOTIFICATION ----- */
  async sendAdminEmailNotification(bookingData, bookingDate) {
    if (typeof emailjs === 'undefined') {
      throw new Error('EmailJS SDK not loaded.');
    }

    emailjs.init(EMAILJS_PUBLIC_KEY);

    const templateParams = {
      to_email:         CENTRAL_ADMIN_EMAIL,
      booking_reference: bookingData.bookingReference,
      student_name:     bookingData.fullName,
      student_phone:    bookingData.phoneNumber,
      student_email:    bookingData.email,
      instrument:       bookingData.instrument,
      class_type:       bookingData.classType,
      physical_address: bookingData.physicalAddress || 'N/A (Online Class)',
      frequency:        bookingData.frequency,
      selected_days:    bookingData.selectedDays,
      selected_time:    bookingData.selectedTime,
      duration:         bookingData.duration,
      price_per_session: formatNaira(bookingData.pricePerSession),
      weekly_cost:      formatNaira(bookingData.weeklyCost),
      booking_status:   'Pending',
      booking_date:     bookingDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    return await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
  }

  /* ----- SHOW CONFIRMATION SCREEN ----- */
  showConfirmation(bookingData, bookingDate) {
    // Hide form, show confirmation
    document.querySelector('.booking-form-panel').style.display = 'none';
    const confirmEl = document.getElementById('bookingConfirmation');
    if (!confirmEl) return;

    confirmEl.classList.add('visible');

    // Populate reference
    const refCodeEl = document.getElementById('confirmRefCode');
    if (refCodeEl) refCodeEl.textContent = bookingData.bookingReference;

    // Populate confirmation details
    const detailsEl = document.getElementById('confirmDetails');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="confirmation-detail-row">
          <span class="conf-key">Student</span>
          <span class="conf-val">${escHtml(bookingData.fullName)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Email</span>
          <span class="conf-val">${escHtml(bookingData.email)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Instrument</span>
          <span class="conf-val gold">${escHtml(bookingData.instrument)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Class Type</span>
          <span class="conf-val">${escHtml(bookingData.classType)}</span>
        </div>
        ${bookingData.classType === 'Physical' ? `
        <div class="confirmation-detail-row">
          <span class="conf-key">Address</span>
          <span class="conf-val">${escHtml(bookingData.physicalAddress)}</span>
        </div>` : ''}
        <div class="confirmation-detail-row">
          <span class="conf-key">Frequency</span>
          <span class="conf-val">${escHtml(bookingData.frequency)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Days</span>
          <span class="conf-val">${escHtml(bookingData.selectedDays)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Time</span>
          <span class="conf-val">${escHtml(bookingData.selectedTime)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Duration</span>
          <span class="conf-val">${escHtml(bookingData.duration)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Per Session</span>
          <span class="conf-val gold">${formatNaira(bookingData.pricePerSession)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Weekly Cost</span>
          <span class="conf-val gold">${formatNaira(bookingData.weeklyCost)}</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Status</span>
          <span class="conf-val green">Pending Confirmation</span>
        </div>
        <div class="confirmation-detail-row">
          <span class="conf-key">Booked On</span>
          <span class="conf-val">${bookingDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      `;
    }

    confirmEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ----- RESET FORM ----- */
  resetForm() {
    this.state = {
      instrument: null, instrumentName: null,
      frequency: null, frequencyDays: 0, frequencyLabel: null,
      selectedDays: [],
      duration: null,
      selectedTime: null, selectedTimeDisplay: null,
      classType: null,
      physicalAddress: '',
      fullName: '', phone: '', email: '',
      pricePerSession: 0, weeklyCost: 0,
    };

    this.currentStep  = 1;
    this.isSubmitting = false;

    // Re-show form, hide confirmation
    document.querySelector('.booking-form-panel').style.display = '';
    const confirmEl = document.getElementById('bookingConfirmation');
    if (confirmEl) confirmEl.classList.remove('visible');

    // Reset all UI selections
    document.querySelectorAll('.instrument-card.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.frequency-option.selected').forEach(o => o.classList.remove('selected'));
    document.querySelectorAll('.duration-option.selected').forEach(o => o.classList.remove('selected'));
    document.querySelectorAll('.class-type-option.selected').forEach(o => o.classList.remove('selected'));

    const addrContainer = document.getElementById('addressFieldContainer');
    if (addrContainer) addrContainer.classList.remove('visible');

    document.querySelectorAll('.booking-input').forEach(i => { i.value = ''; i.classList.remove('error'); });
    document.querySelectorAll('.field-error-msg').forEach(e => e.classList.remove('visible'));

    this.renderDays();
    this.renderTimeSlots();
    this.goToStep(1);
    this.updateSummary();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ----- INIT ON DOM READY ----- */
document.addEventListener('DOMContentLoaded', () => {
  window.BookingApp = new BookingSystem();
});
