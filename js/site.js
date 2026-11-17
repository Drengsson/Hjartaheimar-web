(function(){
    var btn = document.getElementById('navToggle');
    var body = document.body;
    var links = document.getElementById('navLinks');
    if(!btn || !links) return;
    // The collapsible panel only exists below this breakpoint (see the
    // matching @media(max-width:1260px) rules) — above it nav.links is
    // always shown inline in the header and must never be inert.
    var mq = window.matchMedia('(max-width:1260px)');

    function setOpen(open){
      body.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Loka valmynd' : 'Opna valmynd');
      // Closed *mobile* menu links must not be reachable by Tab, a screen
      // reader, or a click, even though they stay in the DOM for the
      // opacity/transform transition. Bug fixed 2026-09-06: this used to be
      // "links.inert = !open" unconditionally, which left #navLinks inert
      // forever on desktop (setOpen(false) runs once on load and nothing
      // ever calls setOpen(true) there, since the toggle button is hidden)
      // — every nav link became unclickable, with clicks silently falling
      // through to the header behind them.
      links.inert = mq.matches && !open;
    }
    setOpen(false);

    btn.addEventListener('click', function(){ setOpen(!body.classList.contains('nav-open')); });
    links.addEventListener('click', function(e){
      if(e.target.tagName === 'A'){ setOpen(false); }
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && body.classList.contains('nav-open')){
        setOpen(false);
        btn.focus();
      }
    });
    // Keep inert correct if the viewport crosses the breakpoint (e.g. a
    // tablet rotated, or a resized desktop window) without a toggle click.
    mq.addEventListener('change', function(){ setOpen(body.classList.contains('nav-open')); });
  })();


  // Drive in-page anchor navigation (nav links, index-strip links, the
  // "Sjá Einkatímar" link) ourselves instead of relying on the browser's
  // native fragment-scroll: relying on it left links intermittently
  // updating the URL hash without ever scrolling. scrollIntoView still
  // honors each target's scroll-margin-top, so the sticky header offset
  // stays correct.
  (function(){
    document.querySelectorAll('a[href^="#"]:not(.open-booking-modal)').forEach(function(link){
      var id = link.getAttribute('href').slice(1);
      if(!id) return;
      link.addEventListener('click', function(e){
        var target = document.getElementById(id);
        if(!target) return;
        e.preventDefault();
        var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({behavior: still ? 'auto' : 'smooth', block:'start'});
        if(history.pushState){ history.pushState(null, '', '#' + id); }
      });
    });
  })();


    // Leftover "contact-fallback" tracking hook: every .book-service-btn
    // on the page now opens a modal (booking, voucher or enquiry) rather
    // than scrolling to #samband, so in practice this only still fires
    // for the LovE Yoga course-link button. Kept as a fallback in case a
    // future service CTA goes back to a plain #samband scroll link.
    document.querySelectorAll('.book-service-btn').forEach(function(btn){
      if(btn.classList.contains('open-booking-modal') || btn.classList.contains('open-voucher-modal') || btn.classList.contains('open-voucher20-modal') || btn.classList.contains('open-enquiry-modal') || btn.id === 'enquiryFormSuccessClose') return;
      btn.addEventListener('click', function(){
        if(typeof gtag === 'function'){
          gtag('event', 'book_button_click', { label: 'contact-fallback' });
        }
      });
    });

    // Reusable Noona iframe-modal controller — used for both the fastir
    // tímar booking modal and the 10-tíma-kort voucher modal below.
    // While a dialog is open, everything else on the page is inert: not
    // focusable, not clickable, hidden from screen readers.
    function setBackgroundInert(modal, on){
      Array.prototype.forEach.call(document.body.children, function(el){
        if(el === modal || el.tagName === 'SCRIPT') return;
        if(on){ if(!el.inert){ el.inert = true; el.setAttribute('data-hh-inert', ''); } }
        else if(el.hasAttribute('data-hh-inert')){ el.inert = false; el.removeAttribute('data-hh-inert'); }
      });
    }
    document.querySelectorAll('.booking-modal-body iframe').forEach(function(f){
      f.addEventListener('load', function(){ f.parentNode.classList.add('loaded'); });
    });

    function initNoonaModal(triggerSelector, modalId, closeId, gtagLabel){
      var openTriggers = document.querySelectorAll(triggerSelector);
      var modal = document.getElementById(modalId);
      if(!openTriggers.length || !modal) return;
      var closeBtn = document.getElementById(closeId);
      var lastFocused = null;

      function openModal(e){
        if(e) e.preventDefault();
        lastFocused = document.activeElement;
        modal.hidden = false;
        setBackgroundInert(modal, true);
        document.body.style.overflow = 'hidden';
        if(closeBtn) closeBtn.focus();
        // Give the modal its own history entry so a phone's back
        // button/gesture closes the modal instead of leaving the page
        // entirely. The URL itself doesn't change, so this is invisible
        // except that "back" now closes the overlay first.
        history.pushState({ hhModal: modalId }, '', location.href);
        if(typeof gtag === 'function'){
          gtag('event', 'book_button_click', { label: gtagLabel });
        }
      }
      function closeModal(fromPopstate){
        modal.hidden = true;
        setBackgroundInert(modal, false);
        document.body.style.overflow = '';
        if(lastFocused && typeof lastFocused.focus === 'function'){ lastFocused.focus(); }
        // Closed some other way (× button, backdrop, Escape): consume the
        // history entry we pushed on open, so back/forward stays clean and
        // a second back press doesn't land on a stale modal-open state.
        // Skip this when we're already responding to a back navigation —
        // that state is being popped on its own.
        if(!fromPopstate && history.state && history.state.hhModal === modalId){
          history.back();
        }
      }
      window.addEventListener('popstate', function(){
        if(!modal.hidden){ closeModal(true); }
      });

      function getFocusable(){
        // The Noona iframe is included so Tab can move into the booking UI
        // (and back out of it) instead of bouncing on the close button.
        var nodes = modal.querySelectorAll('a[href], button, input, textarea, select, iframe, [tabindex]:not([tabindex="-1"])');
        return Array.prototype.filter.call(nodes, function(el){
          return !el.disabled && el.offsetParent !== null;
        });
      }

      openTriggers.forEach(function(btn){ btn.addEventListener('click', openModal); });
      // Wrapped in a plain function rather than passed directly: passing
      // closeModal straight to addEventListener would hand it the click
      // event as its "fromPopstate" argument, which is truthy and would
      // wrongly skip the history.back() cleanup below.
      if(closeBtn) closeBtn.addEventListener('click', function(){ closeModal(); });
      modal.addEventListener('click', function(e){
        if(e.target === modal) closeModal();
      });
      // Escape closes the modal; Tab/Shift+Tab is kept looping inside it
      // while open, so keyboard focus never lands on the page underneath.
      document.addEventListener('keydown', function(e){
        if(modal.hidden) return;
        if(e.key === 'Escape'){ closeModal(); return; }
        if(e.key === 'Tab'){
          var focusable = getFocusable();
          if(!focusable.length) return;
          var first = focusable[0], last = focusable[focusable.length - 1];
          if(e.shiftKey && document.activeElement === first){
            e.preventDefault(); last.focus();
          } else if(!e.shiftKey && document.activeElement === last){
            e.preventDefault(); first.focus();
          }
        }
      });
    }

    // Jóga Nidra (weekly class) booking. Every entry point
    // that should open it carries .open-booking-modal: the nav "Bóka tíma"
    // button, the hero badge, and the "Bóka tíma" button inside the #joga
    // schedule card itself.
    initNoonaModal('.open-booking-modal', 'bookingModal', 'bookingModalClose', 'fastir-timar-noona-modal');

    // 10 tíma kort voucher purchase.
    initNoonaModal('.open-voucher-modal', 'voucherModal', 'voucherModalClose', 'fastir-timar-voucher-modal');

    // 20 tíma kort voucher purchase.
    initNoonaModal('.open-voucher20-modal', 'voucher20Modal', 'voucher20ModalClose', 'fastir-timar-voucher20-modal');

    // Private-session enquiry form (opens a modal with a form, not a
    // Noona iframe — the open/close/escape/backdrop behavior is
    // identical, so the same helper works here too). Every "Óska eftir
    // einkatíma" button across the page (Fimmtudagar-með-Gullu section,
    // Djúpslökun, Vatnsmeðferð, Reiki, Sjálfsþekking, Einkatímar
    // overview) opens this same modal.
    initNoonaModal('.open-enquiry-modal', 'enquiryModal', 'enquiryModalClose', 'enquiry-modal');

    // Reset the enquiry modal back to its form view (not the success
    // panel) each time it's opened, so a second enquiry later in the
    // session doesn't still show the previous "takk fyrir" message.
    document.querySelectorAll('.open-enquiry-modal').forEach(function(btn){
      btn.addEventListener('click', function(){
        var form = document.getElementById('enquiryForm');
        var panel = document.getElementById('enquiryFormSuccess');
        if(form) form.hidden = false;
        if(panel) panel.hidden = true;
        // Buttons can preselect the service: data-service="Reikiheilun"
        var service = btn.getAttribute('data-service');
        var select = document.getElementById('tf-service');
        if(select && service){
          var match = Array.prototype.some.call(select.options, function(o){ return o.value === service; });
          if(!match){ var o = document.createElement('option'); o.value = o.textContent = service; select.appendChild(o); }
          select.value = service;
        }
      });
    });

    // The success panel's own "Loka" button just triggers the real
    // close button, reusing its focus-restore/escape/backdrop handling.
    var enquirySuccessClose = document.getElementById('enquiryFormSuccessClose');
    if(enquirySuccessClose){
      enquirySuccessClose.addEventListener('click', function(){
        var realClose = document.getElementById('enquiryModalClose');
        if(realClose) realClose.click();
      });
    }

    document.querySelectorAll('.course-link').forEach(function(link){
      link.addEventListener('click', function(){
        if(typeof gtag === 'function'){
          gtag('event', 'course_link_click', { course: link.getAttribute('data-course') || '' });
        }
      });
    });


  // Reusable web3forms AJAX submit handler — used for both the main
  // contact form and the private-session enquiry form. Same delivery
  // mechanism (web3forms), same honeypot/reset pattern. The bottom
  // contact form shows its confirmation inline (it's never clipped —
  // nothing else on the page sits below it in a scroll container), but
  // the enquiry form lives inside a modal with a capped height, so its
  // "takk fyrir" message can end up below the fold and easy to miss.
  // For that one, pass a successPanelId: on success the form is swapped
  // out entirely for a short, always-visible confirmation panel instead
  // of relying on the visitor to scroll down within the modal.
  function wireContactForm(formId, statusId, successMessage, gtagEvent, successPanelId){
    var form = document.getElementById(formId);
    if(!form) return;
    var status = document.getElementById(statusId);
    var panel = successPanelId ? document.getElementById(successPanelId) : null;
    var btn = form.querySelector('.form-submit');
    var originalLabel = btn.textContent;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(form.querySelector('.hp').checked) return; // honeypot tripped, silently drop
      btn.disabled = true;
      btn.textContent = 'Sendi...';
      status.textContent = '';
      status.className = 'form-status';
      fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function(res){ return res.json(); })
        .then(function(data){
          if(data && data.success){
            form.reset();
            if(panel){
              form.hidden = true;
              panel.hidden = false;
            } else {
              status.textContent = successMessage;
              status.className = 'form-status ok';
            }
            if(typeof gtag === 'function' && gtagEvent){ gtag('event', gtagEvent); }
          } else {
            status.textContent = 'Eitthvað fór úrskeiðis. Prófaðu aftur, eða sendu mér línu á Gulla@hjartaheimar.is.';
            status.className = 'form-status err';
          }
        })
        .catch(function(){
          status.textContent = 'Eitthvað fór úrskeiðis. Prófaðu aftur, eða sendu mér línu á Gulla@hjartaheimar.is.';
          status.className = 'form-status err';
        })
        .finally(function(){
          btn.disabled = false;
          btn.textContent = originalLabel;
        });
    });
  }

  wireContactForm('contactForm', 'contactFormStatus', 'Takk fyrir — skilaboðin bárust. Ég svara eins fljótt og ég get.', 'contact_form_submit');
  wireContactForm('enquiryForm', 'enquiryFormStatus', 'Takk fyrir fyrirspurnina. Gulla verður í sambandi við þig.', 'enquiry_form_submit', 'enquiryFormSuccess');
  // Booking/enquiry forms on the offering pages (vatnsmeðferð, sómatísk vinna, fyrirtæki)
  wireContactForm('fyrirspurnForm', 'fyrirspurnFormStatus', 'Takk fyrir. Gulla verður í sambandi.', 'contact_form_submit', 'fyrirspurnFormSuccess');
  wireContactForm('fyrirtaekiForm', 'fyrirtaekiFormStatus', 'Takk fyrir fyrirspurnina. Gulla verður í sambandi við ykkur.', 'corporate_form_submit', 'fyrirtaekiFormSuccess');


  // Google Analytics and Meta Pixel only start loading once the visitor has
  // actively accepted optional cookies here — nothing is loaded up front.
  (function(){
    var KEY = 'hh_consent';
    var banner = document.getElementById('consentBanner');
    var acceptBtn = document.getElementById('consentAccept');
    var rejectBtn = document.getElementById('consentReject');
    var changeBtn = document.getElementById('consentChangeBtn');

    function loadGA(){
      if(window.__hhGaLoaded) return;
      window.__hhGaLoaded = true;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-TPB5RGKBBF';
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){ window.dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', 'G-TPB5RGKBBF');
    }

    function loadPixel(){
      if(window.__hhFbLoaded) return;
      window.__hhFbLoaded = true;
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '926281660184975');
      fbq('track', 'PageView');
    }

    function showBanner(){ if(banner){ banner.hidden = false; } }
    function hideBanner(){ if(banner){ banner.hidden = true; } }

    var choice = null;
    try{ choice = localStorage.getItem(KEY); }catch(err){}

    if(choice === 'granted'){ loadGA(); loadPixel(); }
    else if(choice !== 'denied'){ showBanner(); }

    if(acceptBtn) acceptBtn.addEventListener('click', function(){
      try{ localStorage.setItem(KEY, 'granted'); }catch(err){}
      loadGA(); loadPixel();
      hideBanner();
    });
    if(rejectBtn) rejectBtn.addEventListener('click', function(){
      var wasActive = window.__hhGaLoaded || window.__hhFbLoaded;
      try{ localStorage.setItem(KEY, 'denied'); }catch(err){}
      hideBanner();
      if(wasActive){
        // Withdrawing consent: stop GA and Meta in this page, remove their
        // cookies, and reload so neither script is running any more.
        window['ga-disable-G-TPB5RGKBBF'] = true;
        if(typeof gtag === 'function'){ gtag('consent', 'update', {analytics_storage:'denied', ad_storage:'denied'}); }
        if(typeof fbq === 'function'){ fbq('consent', 'revoke'); }
        document.cookie.split(';').forEach(function(c){
          var name = c.split('=')[0].trim();
          if(/^(_ga|_gid|_gat|_fbp|_fbc)/.test(name)){
            ['', '; domain=' + location.hostname, '; domain=.' + location.hostname.replace(/^www\./, '')].forEach(function(d){
              document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
            });
          }
        });
        location.reload();
      }
    });
    if(changeBtn) changeBtn.addEventListener('click', showBanner);
  })();


/* Dates that look after themselves:
   [data-until="YYYY-MM-DDTHH:MM"]  hidden once that moment has passed
   [data-hide-when-empty]           hidden when none of its [data-until] children are left
   [data-biweekly="YYYY-MM-DD" data-ends="HH:MM"]  filled with the next date in a
                                    two-week cycle starting on that date */
(function(){
  var now = new Date();
  document.querySelectorAll('[data-until]').forEach(function(el){
    var v = el.getAttribute('data-until');
    if(!/(Z|[+-]\d\d:\d\d)$/.test(v)) v += 'Z'; // Iceland is UTC all year
    if(new Date(v) < now) el.hidden = true;
  });
  document.querySelectorAll('[data-hide-when-empty]').forEach(function(box){
    var items = box.querySelectorAll('[data-until]');
    if(items.length && Array.prototype.every.call(items, function(i){ return i.hidden; })) box.hidden = true;
  });
  var days = ['sunnudaginn','mánudaginn','þriðjudaginn','miðvikudaginn','fimmtudaginn','föstudaginn','laugardaginn'];
  var months = ['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];
  document.querySelectorAll('[data-biweekly]').forEach(function(el){
    var end = (el.getAttribute('data-ends') || '23:59').split(':');
    var d = new Date(el.getAttribute('data-biweekly') + 'T00:00Z');
    var finished = function(x){ var e = new Date(x); e.setUTCHours(+end[0], +end[1]); return e < now; };
    while(finished(d)) d.setUTCDate(d.getUTCDate() + 14);
    var txt = days[d.getUTCDay()] + ' ' + d.getUTCDate() + '. ' + months[d.getUTCMonth()];
    el.textContent = el.hasAttribute('data-cap') ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt;
  });
})();

/* Optional embeds (Spotify) load only when the visitor asks for them. */
document.querySelectorAll('[data-embed-src]').forEach(function(btn){
  btn.addEventListener('click', function(){
    var f = document.createElement('iframe');
    f.src = btn.getAttribute('data-embed-src') + '&autoplay=1';
    f.title = btn.getAttribute('data-embed-title') || '';
    f.width = '100%'; f.height = '352'; f.style.border = '0';
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    btn.replaceWith(f);
  });
});
