(() => {
  "use strict";

  const target = document.querySelector("[data-authenticator-qr]");
  if (!(target instanceof HTMLElement)) return;

  const uri = target.dataset.authenticatorQr || "";
  if (!uri || typeof QRCode === "undefined") {
    target.textContent = "Không thể tạo mã QR. Hãy dùng khóa thiết lập thủ công bên dưới.";
    target.setAttribute("data-qr-state", "error");
    return;
  }

  try {
    target.textContent = "";
    new QRCode(target, {
      text: uri,
      width: 232,
      height: 232,
      colorDark: "#07120f",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    delete target.dataset.authenticatorQr;
    target.setAttribute("data-qr-state", "ready");
  } catch {
    target.textContent = "Không thể tạo mã QR. Hãy dùng khóa thiết lập thủ công bên dưới.";
    target.setAttribute("data-qr-state", "error");
  }
})();
