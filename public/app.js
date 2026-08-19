document.addEventListener("DOMContentLoaded", () => {
  let collectionData = null;
  let activeMode = "";
  let activeTab = "table";

  const usernameInput = document.getElementById("usernameInput");
  const searchInput = document.getElementById("searchInput");
  const minRatingInput = document.getElementById("minRatingInput");
  const bestAtInput = document.getElementById("bestAtInput");
  const includeExpansionsInput = document.getElementById("includeExpansionsInput");
  const fetchBtn = document.getElementById("fetchBtn");
  const fetchIcon = document.getElementById("fetchIcon");
  
  const presetButtons = document.querySelectorAll(".preset-btn");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  const statsCard = document.getElementById("statsCard");
  const statsDetail = document.getElementById("statsDetail");
  const statsPctBadge = document.getElementById("statsPctBadge");

  const resultsHeading = document.getElementById("resultsHeading");
  const resultsSummary = document.getElementById("resultsSummary");
  const tableBody = document.getElementById("tableBody");
  const compactListText = document.getElementById("compactListText");
  const jsonText = document.getElementById("jsonText");
  const copyListBtn = document.getElementById("copyListBtn");

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

  // Helper function to capitalize
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Format rating with color badge
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

  // Fetch collection from server API
  async function loadCollection() {
    const username = usernameInput.value.trim() || "bwobbones";

    fetchIcon.classList.add("animate-spin");
    fetchBtn.disabled = true;

    try {
      const params = new URLSearchParams({
        username,
        includeExpansions: includeExpansionsInput.checked ? "true" : "false",
      });

      if (activeMode) params.append("mode", activeMode);
      if (minRatingInput.value) params.append("minRating", minRatingInput.value);
      if (bestAtInput.value) params.append("bestAt", bestAtInput.value);

      const res = await fetch(`/api/collection?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "API error");
      }

      collectionData = json.data;

      // Update Gold Stats Card
      if (activeMode === "allgold" || collectionData.goldCount > 0) {
        statsCard.classList.remove("hidden");
        statsDetail.textContent = `${collectionData.goldCount} / ${collectionData.totalEligibleCount} Gold Games`;
        statsPctBadge.textContent = `${collectionData.goldPercentage}%`;
      } else {
        statsCard.classList.add("hidden");
      }

      // Update Results Header
      const modeLabel = activeMode ? ` [preset: ${activeMode}]` : "";
      resultsHeading.textContent = `Collection Results for ${collectionData.username}${modeLabel}`;
      
      renderTable();
      compactListText.value = collectionData.compactList || "";
      jsonText.textContent = JSON.stringify(collectionData.items, null, 2);

    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      fetchIcon.classList.remove("animate-spin");
      fetchBtn.disabled = false;
    }
  }

  // Render Table Rows with Client-side Title Search Filter
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
