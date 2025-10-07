document
  .getElementById("feedbackForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const data = new FormData(form);

    const response = await fetch("https://formspree.io/f/yourFormId", {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });

    const statusEl = document.getElementById("feedbackStatus");

    if (response.ok) {
      statusEl.textContent = "✅ Thanks for your feedback!";
      form.reset();
    } else {
      statusEl.textContent = "❌ Oops! Something went wrong.";
    }
  });
