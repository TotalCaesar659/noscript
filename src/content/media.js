
if ("MediaSource" in window) ns.on("capabilities", event => {
  debug("Media Hook", document.URL, document.documentElement && document.documentElement.innerHTML, ns.capabilities); // DEV_ONLY
  let mediaBlocker = !ns.allows("media");
  let unpatched = new Map();
  function patch(obj, methodName, replacement) {
     let methods = unpatched.get(obj) || {};
     methods[methodName] = obj[methodName];
     exportFunction(replacement, obj, {defineAs: methodName});
     unpatched.set(obj, methods);
  }
  let urlMap = new WeakMap();
  patch(window.URL, "createObjectURL",  function(o, ...args) {
    let url = unpatched.get(window.URL).createObjectURL.call(this, o, ...args);
    if (o instanceof MediaSource) {
      let urls = urlMap.get(o);
      if (!urls) urlMap.set(o, urls = new Set());
      urls.add(url);
    }
    return url;
  });

  patch(window.MediaSource.prototype, "addSourceBuffer", function(mime, ...args) {
    let ms = this;
    let urls = urlMap.get(ms);

    let request = {
      id: "noscript-media",
      type: "media",
      url: document.URL,
      documentUrl: document.URL,
      embeddingDocument: true,
    };
    seen.record({policyType: "media", request, allowed: false});
    notifyPage();

    if (mediaBlocker) {
      let exposedMime = `${mime} (MSE)`;
      setTimeout(() => {
        let me = Array.from(document.querySelectorAll("video,audio"))
          .find(e => e.srcObject === ms || urls && urls.has(e.src));
        if (!me) return;
        try {
          let ph = PlaceHolder.create("media", request);
          ph.replace(me);
          PlaceHolder.listen();
        } catch (e) {
          error(e);
        }
      }, 0);
      throw new Error(`${exposedMime} blocked by NoScript`);
    }

    return unpatched.get(window.MediaSource.prototype).addSourceBuffer.call(ms, mime, ...args);
  });
});
