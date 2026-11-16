(function() {
  if (localStorage.getItem('creaven_cookie_consent')) return;

  const banner = document.createElement('div');
  banner.id = 'creavenCookieBanner';
  
  banner.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #1A2A1A;
    color: #fff;
    padding: 20px 24px;
    z-index: 999999;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
    border-top: 3px solid #3A6B3A;
  `;

  banner.innerHTML = `
    <div style="flex: 1; min-width: 280px; line-height: 1.6;">
      We use essential cookies to make our platform work (authentication, security). 
      We do not use advertising cookies. 
      <a href="privacy.html" style="color: #B8CEB9; text-decoration: underline;">Read our Privacy Policy</a>.
    </div>
    <div style="display: flex; gap: 10px;">
      <button id="cookieDecline" style="
        background: transparent; border: 1px solid rgba(255,255,255,0.3); color: #fff;
        padding: 10px 20px; border-radius: 20px; cursor: pointer; font-family: 'DM Sans', sans-serif;
        font-size: 13px; transition: background 0.2s;
      ">Decline</button>
      <button id="cookieAccept" style="
        background: #3A6B3A; border: none; color: #fff;
        padding: 10px 24px; border-radius: 20px; cursor: pointer; font-family: 'DM Sans', sans-serif;
        font-size: 13px; font-weight: 600; transition: background 0.2s;
      ">Accept & Continue</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('cookieAccept').addEventListener('click', function() {
    localStorage.setItem('creaven_cookie_consent', 'accepted');
    banner.remove();
  });


  document.getElementById('cookieDecline').addEventListener('click', function() {
    localStorage.setItem('creaven_cookie_consent', 'declined');
    banner.remove();
  
    alert("You have declined cookies. Please note that you will not be able to log in or use the platform without accepting essential cookies.");
  });
})();
