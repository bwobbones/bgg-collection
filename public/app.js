document.addEventListener("DOMContentLoaded", () => {
  let collectionData = null;
  let activeMode = "";
  let activeTab = "table";
  let eventSource = null;

  const usernameInput = document.getElementById("usernameInput");
  const searchInput = document.getElementById("searchInput");
  const minRatingInput = document.getElementById("minRatingInput");
  const bestAtInput = document.getElementById("bestAtInput");
  const includeExpansionsInput = document.getElementById("includeExpansionsInput");
  const fetchBtn = document.getElementById("fetchBtn");
  const fetchIcon = document.getElementById("fetchIcon");

  const progressBox = document.getElementById("progressBox");
  const progressStepBadge = document.getElementById("progressStepBadge");
  const progressMessage = document.getElementById("progressMessage");
  const progressPercentageText = document.getElementById("progressPercentageText");
  const progressBar = document.getElementById("progressBar");

  const statsCard = document.getElementById("statsCard");
  const statsDetail = document.getElementById("statsDetail");
  const statsPctBadge = document.getElementById("statsPctBadge");

  const resultsCard = document.getElementById("resultsCard");
  const resultsHeading = document.getElementById("resultsHeading");
  const resultsSummary = document.getElementById("resultsSummary");
  const tableBody = document.getElementById("tableBody");
  const compactListText = document.getElementById("compactListText");
  const jsonText = document.getElementById("jsonText");
  const copyListBtn = document.getElementById("copyListBtn");

  const presetButtons = document.querySelectorAll(".preset-btn");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Handle Preset Button Clicks
  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      presetButtons.forEach((b) => {
        b.classList.remove(
          "border-amber-500/50",
          "bg-amber-500/10",
          "text-amber-300"
        );
        b.classList.add("border-slate-700", "bg-slate-900", "text-slate-300");
      });

      btn.classList.remove("border-slate-700", "bg-slate-900", "text-slate-300");
      btn.classList.add(
        "border-amber-500/50",
        "bg-amber-500/10",
        "text-amber-300"
      );

      activeMode = btn.dataset.mode || "";
      loadCollection();
    });
  });

  // Handle Tab Switching
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("bg-slate-800", "text-white", "shadow");
        b.classList.add("text-slate-400");
      });

      btn.classList.remove("text-slate-400");
      btn.classList.add("bg-slate-800", "text-white", "shadow");

      activeTab = btn.dataset.tab;
      tabContents.forEach((c) => c.classList.add("hidden"));
      document.getElementById(`tab${capitalize(activeTab)}`).classList.remove("hidden");
    });
  });

  // Handle Copy Button
  copyListBtn.addEventListener("click", () => {
    compactListText.select();
    navigator.clipboard.writeText(compactListText.value).then(() => {
      const originalText = copyListBtn.innerHTML;
      copyListBtn.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> Copied!`;
      setTimeout(() => {
        copyListBtn.innerHTML = originalText;
      }, 2000);
    });
  });

  // Live Filter on Search Input
  searchInput.addEventListener("input", () => {
    renderTable();
  });

  fetchBtn.addEventListener("click", () => loadCollection());

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatRatingBadge(rating) {
    if (rating === null || rating === undefined || isNaN(rating)) {
      return `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-500">N/A</span>`;
    }
    const val = parseFloat(rating);
    const text = val.toFixed(1);

    if (val >= 8.0) {
      return `<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">${text}</span>`;
    }
    if (val >= 7.2) {
      return `<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">${text}</span>`;
    }
    if (val >= 6.0) {
      return `<span class="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">${text}</span>`;
    }
    return `<span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">${text}</span>`;
  }

  function updateProgressUI(pct, stepName, msg) {
    const safePct = Math.min(100, Math.max(0, pct || 0));
    progressBar.style.width = `${safePct}%`;
    progressPercentageText.textContent = `${safePct}%`;
    if (stepName) progressStepBadge.textContent = stepName;
    if (msg) progressMessage.textContent = msg;
  }

  // Fetch collection from server API using SSE Stream
  function loadCollection() {
    const username = usernameInput.value.trim() || "bwobbones";

    // Close any previous SSE stream
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    // 1. Immediately remove current collection listing at start of new fetch
    resultsCard.classList.add("hidden");
    statsCard.classList.add("hidden");
    tableBody.innerHTML = "";
    compactListText.value = "";
    jsonText.textContent = "";

    // 2. Show Progress Box & reset progress bar
    progressBox.classList.remove("hidden");
    updateProgressUI(0, "Step 1/3", `Connecting to BGG for user "${username}"...`);

    fetchIcon.classList.add("animate-spin");
    fetchBtn.disabled = true;

    const params = new URLSearchParams({
      username,
      includeExpansions: includeExpansionsInput.checked ? "true" : "false",
    });

    if (activeMode) params.append("mode", activeMode);
    if (minRatingInput.value) params.append("minRating", minRatingInput.value);
    if (bestAtInput.value) params.append("bestAt", bestAtInput.value);

    eventSource = new EventSource(`/api/collection/stream?${params.toString()}`);

    eventSource.addEventListener("progress", (e) => {
      try {
        const payload = JSON.parse(e.data);
        const pct = payload.percentage || 10;
        let stepName = "Step 1/3";

        if (payload.step === "collection" || payload.step === "queue") {
          stepName = "Step 1/3";
        } else if (payload.step === "things_start" || payload.step === "things") {
          stepName = "Step 2/3";
        } else if (payload.step === "filtering" || payload.step === "formatting") {
          stepName = "Step 3/3";
        }

        updateProgressUI(pct, stepName, payload.message);
      } catch (err) {
        console.error("Progress parse error:", err);
      }
    });

    eventSource.addEventListener("complete", (e) => {
      try {
        const payload = JSON.parse(e.data);
        eventSource.close();
        eventSource = null;

        if (!payload.success || !payload.data) {
          throw new Error(payload.error || "Failed to load collection");
        }

        collectionData = payload.data;

        // Finish Progress UI
        updateProgressUI(100, "Done!", "Collection loaded successfully!");

        setTimeout(() => {
          progressBox.classList.add("hidden");

          // Render Gold Stats Card if active
          if (activeMode === "allgold" || collectionData.goldCount > 0) {
            statsCard.classList.remove("hidden");
            statsDetail.textContent = `${collectionData.goldCount} / ${collectionData.totalEligibleCount} Gold Games`;
            statsPctBadge.textContent = `${collectionData.goldPercentage}%`;
          }

          // Update Results Heading & Render Table
          const modeLabel = activeMode ? ` [preset: ${activeMode}]` : "";
          resultsHeading.textContent = `Collection Results for ${collectionData.username}${modeLabel}`;

          renderTable();
          compactListText.value = collectionData.compactList || "";
          jsonText.textContent = JSON.stringify(collectionData.items, null, 2);

          resultsCard.classList.remove("hidden");
        }, 500);

      } catch (err) {
        handleFetchError(err.message);
      } finally {
        fetchIcon.classList.remove("animate-spin");
        fetchBtn.disabled = false;
      }
    });

    eventSource.addEventListener("error", (e) => {
      let errMsg = "Connection to server failed";
      try {
        if (e.data) {
          const payload = JSON.parse(e.data);
          errMsg = payload.error || errMsg;
        }
      } catch (ex) {}

      handleFetchError(errMsg);
    });
  }

  function handleFetchError(msg) {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    progressBox.classList.add("hidden");
    fetchIcon.classList.remove("animate-spin");
    fetchBtn.disabled = false;
    alert(`Error: ${msg}`);
  }

  function renderTable() {
    if (!collectionData || !collectionData.items) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No collection data loaded.</td></tr>`;
      return;
    }

    const query = searchInput.value.trim().toLowerCase();
    let displayItems = collectionData.items;

    if (query) {
      displayItems = displayItems.filter((i) =>
        i.name.toLowerCase().includes(query)
      );
    }

    resultsSummary.textContent = `Showing ${displayItems.length} of ${collectionData.returnedCount} matching items (Total in collection: ${collectionData.totalItems})`;

    if (displayItems.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No games found matching search query.</td></tr>`;
      return;
    }

    tableBody.innerHTML = displayItems
      .map((item, idx) => {
        const img = item.thumbnail
          ? `<img src="${item.thumbnail}" alt="${item.name}" class="w-10 h-10 object-cover rounded-lg border border-slate-700">`
          : `<div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-slate-600"><i class="fa-solid fa-dice-d6"></i></div>`;

        const bestAtBadge = item.bestAt
          ? `<span class="px-2 py-1 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"><i class="fa-solid fa-users text-cyan-400 text-[10px] mr-1"></i>${item.bestAt}</span>`
          : `<span class="text-slate-600">—</span>`;

        return `
          <tr class="hover:bg-slate-700/30 transition">
            <td class="py-3 px-4 text-center text-xs text-slate-500 font-mono">${idx + 1}</td>
            <td class="py-3 px-4">${img}</td>
            <td class="py-3 px-4 font-bold text-white">${item.name}</td>
            <td class="py-3 px-4">${bestAtBadge}</td>
            <td class="py-3 px-4 text-center">${formatRatingBadge(item.averageRating)}</td>
            <td class="py-3 px-4 text-center font-mono font-semibold text-slate-300">${item.numPlays || 0}</td>
          </tr>
        `;
      })
      .join("");
  }

  // Load initial collection on page load
  loadCollection();
});
