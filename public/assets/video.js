// Swap a click-to-load YouTube thumbnail for the privacy-enhanced player.
document.addEventListener("click", function (event) {
  var link = event.target.closest && event.target.closest(".video-load");
  if (!link) return;
  var id = link.getAttribute("data-video-id");
  if (!/^[\w-]{11}$/.test(id || "")) return;
  event.preventDefault();
  var frame = document.createElement("iframe");
  frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
  frame.title = link.getAttribute("aria-label") || "Setup video";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  frame.allowFullscreen = true;
  link.replaceWith(frame);
});
