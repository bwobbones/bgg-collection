document.addEventListener("DOMContentLoaded", () => {
  let rawCollectionData = null; // Full dataset loaded from BGG server
  let filteredItems = [];       // Client-side filtered items
  let activeMode = "";          // '', 'gold', 'shit'
  let activeTab = "table";
  let eventSource = null;
  let loadedUsername = "";
  let loadedIncludeExpansions = false;

  // Seasonal Theme Setup
  let currentSeason = detectCurrentSeason();
  const seasonBadges = {
    winter: { icon: "❄️", label: "Winter Theme" },
    spring: { icon: "🌸", label: "Spring Theme" },
    summer: { icon: "☀️", label: "Summer Theme" },
    autumn: { icon: "🍁", label: "Autumn Theme" },
  };

  const seasonalWheelPalettes = {
    winter: ["#cff4fc", "#e0e7ff", "#dbeafe", "#bae6fd", "#f3e8ff", "#e0f2fe"],
    spring: ["#d1fae5", "#fce7f3", "#fef3c7", "#dbeafe", "#ccfbf1", "#f3e8ff"],
    summer: ["#fef3c7", "#ffedd5", "#ffe4e6", "#cff4fc", "#fce7f3", "#d1fae5"],
    autumn: ["#ffedd5", "#fef3c7", "#fecdd3", "#fed7aa", "#fef08a", "#fde68a"],
  };

  // Wheel State
  let wheelCanvas = document.getElementById("wheelCanvas");
  let ctx = wheelCanvas ? wheelCanvas.getContext("2d") : null;
  let currentAngle = 0;
  let isSpinning = false;

  const usernameInput = document.getElementById("usernameInput");
  const searchInput = document.getElementById("searchInput");
  const minRatingInput = document.getElementById("minRatingInput");
  const includeExpansionsInput = document.getElementById("includeExpansionsInput");
  const unplayedOnlyInput = document.getElementById("unplayedOnlyInput");
  const unplayedCountBadge = document.getElementById("unplayedCountBadge");
  const includeExclusionsInput = document.getElementById("includeExclusionsInput");
  const exclusionsCountBadge = document.getElementById("exclusionsCountBadge");
  const exclusionsOptionWrapper = document.getElementById("exclusionsOptionWrapper");
  const includeExclusionsLabel = document.getElementById("includeExclusionsLabel");
  const manageExclusionsBtnText = document.getElementById("manageExclusionsBtnText");
  const welcomeCard = document.getElementById("welcomeCard");
  const fetchBtn = document.getElementById("fetchBtn");
  const fetchIcon = document.getElementById("fetchIcon");
  const refreshBtn = document.getElementById("refreshBtn");
  const refreshIcon = document.getElementById("refreshIcon");
  const logoutBtn = document.getElementById("logoutBtn");

  const progressBox = document.getElementById("progressBox");
  const progressStepBadge = document.getElementById("progressStepBadge");
  const progressMessage = document.getElementById("progressMessage");
  const progressPercentageText = document.getElementById("progressPercentageText");
  const progressBar = document.getElementById("progressBar");

  // Togglable Progress Details & Live Activity Console Elements
  const toggleProgressDetailsBtn = document.getElementById("toggleProgressDetailsBtn");
  const progressDetailsChevron = document.getElementById("progressDetailsChevron");
  const progressDetailsToggleLabel = document.getElementById("progressDetailsToggleLabel");
  const progressDetailsBox = document.getElementById("progressDetailsBox");
  const step1StatusBadge = document.getElementById("step1StatusBadge");
  const step1DetailText = document.getElementById("step1DetailText");
  const step2StatusBadge = document.getElementById("step2StatusBadge");
  const step2DetailText = document.getElementById("step2DetailText");
  const step3StatusBadge = document.getElementById("step3StatusBadge");
  const step3DetailText = document.getElementById("step3DetailText");
  const progressLogConsole = document.getElementById("progressLogConsole");
  const logEntriesCount = document.getElementById("logEntriesCount");
  const viewFetchDetailsBtn = document.getElementById("viewFetchDetailsBtn");
  let clientActivityLogs = [];

  const errorBox = document.getElementById("errorBox");
  const errorHeading = document.getElementById("errorHeading");
  const errorMessage = document.getElementById("errorMessage");
  const errorDetailsWrapper = document.getElementById("errorDetailsWrapper");
  const errorDetailsText = document.getElementById("errorDetailsText");
  const dismissErrorBtn = document.getElementById("dismissErrorBtn");

  const statsCard = document.getElementById("statsCard");
  const statsDetail = document.getElementById("statsDetail");
  const statsPctBadge = document.getElementById("statsPctBadge");
  const playedStatsCard = document.getElementById("playedStatsCard");
  const playedStatsDetail = document.getElementById("playedStatsDetail");
  const playedStatsPctBadge = document.getElementById("playedStatsPctBadge");
  const playedStatsHint = document.getElementById("playedStatsHint");

  // Play history chart elements
  const playHistoryCard = document.getElementById("playHistoryCard");
  const playHistoryChart = document.getElementById("playHistoryChart");
  const playHistoryChips = document.getElementById("playHistoryChips");
  const playHistoryLoading = document.getElementById("playHistoryLoading");
  const playHistoryLoadingText = document.getElementById("playHistoryLoadingText");
  const playHistoryMessage = document.getElementById("playHistoryMessage");
  const playHistoryTooltip = document.getElementById("playHistoryTooltip");
  const playHistoryBasis = document.getElementById("playHistoryBasis");
  const playHistoryToggleLabel = document.getElementById("playHistoryToggleLabel");
  const playHistoryToggleChevron = document.getElementById("playHistoryToggleChevron");
  let playHistoryRequestId = 0;
  let pendingForceRefresh = false;
  // The chart is collapsed until the Played Games card is clicked, so its
  // (fairly expensive) play-history fetch only happens on demand.
  let playHistoryExpanded = false;
  let playHistoryLoaded = false;

  const resultsCard = document.getElementById("resultsCard");
  const resultsHeading = document.getElementById("resultsHeading");
  const resultsSummary = document.getElementById("resultsSummary");
  const tableBody = document.getElementById("tableBody");
  const compactListText = document.getElementById("compactListText");
  const jsonText = document.getElementById("jsonText");
  const copyListBtn = document.getElementById("copyListBtn");

  const seasonIcon = document.getElementById("seasonIcon");
  const seasonLabel = document.getElementById("seasonLabel");
  const seasonSelectBtns = document.querySelectorAll(".season-select-btn");

  const presetButtons = document.querySelectorAll(".preset-btn");
  const pcPills = document.querySelectorAll(".pc-pill");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Spin Modal Elements
  const openSpinModalBtn = document.getElementById("openSpinModalBtn");
  const closeSpinModalBtn = document.getElementById("closeSpinModalBtn");
  const spinModal = document.getElementById("spinModal");
  const wheelSubheading = document.getElementById("wheelSubheading");
  const doSpinBtn = document.getElementById("doSpinBtn");
  const winnerCard = document.getElementById("winnerCard");
  const winnerTitle = document.getElementById("winnerTitle");
  const winnerBestAt = document.getElementById("winnerBestAt");
  const winnerRating = document.getElementById("winnerRating");
  const winnerImgContainer = document.getElementById("winnerImgContainer");
  const discordShareWrapper = document.getElementById("discordShareWrapper");
  const shareSpinBtn = document.getElementById("shareSpinBtn");
  const shareSpinLabel = document.getElementById("shareSpinLabel");
  const discordShareStatus = document.getElementById("discordShareStatus");
  let lastSpin = null; // { winner, startAngle, angleDelta, duration, numSlices } for the GIF export
  let lastSpinAnimation = null; // animation params stashed by spinWheel()

  // Manage Exclusions Modal Elements
  const openExclusionsModalBtn = document.getElementById("openExclusionsModalBtn");
  const closeExclusionsModalBtn = document.getElementById("closeExclusionsModalBtn");
  const exclusionsModal = document.getElementById("exclusionsModal");
  const exclusionsModalTitle = document.getElementById("exclusionsModalTitle");
  const newExclusionInput = document.getElementById("newExclusionInput");
  const collectionTitlesDatalist = document.getElementById("collectionTitlesDatalist");
  const addExclusionBtn = document.getElementById("addExclusionBtn");
  const modalExclusionsList = document.getElementById("modalExclusionsList");
  const modalExclusionsCount = document.getElementById("modalExclusionsCount");
  const clearAllExclusionsBtn = document.getElementById("clearAllExclusionsBtn");
  const resetDefaultExclusionsBtn = document.getElementById("resetDefaultExclusionsBtn");
  const saveExclusionsBtn = document.getElementById("saveExclusionsBtn");

  // State for modal editing
  let editingExclusions = [];

  // Get active selected player counts from pills
  function getSelectedPlayerCounts() {
    const selected = [];
    pcPills.forEach((pill) => {
      if (pill.classList.contains("active-pc")) {
        selected.push(pill.dataset.pc);
      }
    });
    return selected;
  }

  // Set active player count pills
  function setSelectedPlayerCounts(counts) {
    pcPills.forEach((pill) => {
      const pc = pill.dataset.pc;
      if (counts.includes(pc)) {
        pill.classList.add("active-pc");
      } else {
        pill.classList.remove("active-pc");
      }
    });
  }

  // Bind Player Count Pill Clicks (Client-side instant change)
  pcPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("active-pc");
      applyClientFilters();
    });
  });

  // Detect season based on current month (Northern Hemisphere)
  function detectCurrentSeason() {
    const month = new Date().getMonth();
    if (month === 11 || month === 0 || month === 1) return "winter";
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    return "autumn";
  }

  // Apply Season Theme
  function applySeasonTheme(season) {
    currentSeason = season;
    document.documentElement.setAttribute("data-season", season);

    const info = seasonBadges[season] || seasonBadges.summer;
    if (seasonIcon) seasonIcon.textContent = info.icon;
    if (seasonLabel) seasonLabel.textContent = info.label;

    seasonSelectBtns.forEach((btn) => {
      if (btn.dataset.seasonSelect === season) {
        btn.classList.add("bg-white", "shadow-sm", "text-slate-800");
      } else {
        btn.classList.remove("bg-white", "shadow-sm", "text-slate-800");
      }
    });

    if (spinModal && !spinModal.classList.contains("hidden")) {
      drawWheel();
    }
  }

  // Bind Season Selector Buttons
  seasonSelectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      applySeasonTheme(btn.dataset.seasonSelect);
    });
  });

  // Handle Preset Button Clicks (Client-side instant filter)
  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      presetButtons.forEach((b) => b.classList.remove("active-preset"));
      btn.classList.add("active-preset");

      activeMode = btn.dataset.mode || "";

      if (activeMode === "gold" || activeMode === "shit") {
        setSelectedPlayerCounts(["3p", "4p", "5p", "6+p"]);
      }

      applyClientFilters();
    });
  });

  // Handle Tab Switching
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("bg-white", "text-slate-800", "shadow-sm");
        b.classList.add("text-slate-500");
      });

      btn.classList.remove("text-slate-500");
      btn.classList.add("bg-white", "text-slate-800", "shadow-sm");

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

  // Client-side Filters Trigger
  searchInput.addEventListener("input", () => applyClientFilters());
  minRatingInput.addEventListener("input", () => applyClientFilters());

  // Reload collection only on Enter key or when input loses focus (change)
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newUsername = usernameInput.value.trim();
      if (newUsername && newUsername !== loadedUsername) {
        loadCollection({ forceRefresh: true });
      }
    }
  });

  usernameInput.addEventListener("change", () => {
    const newUsername = usernameInput.value.trim();
    if (newUsername && newUsername !== loadedUsername) {
      loadCollection({ forceRefresh: true });
    }
  });

  // Reload when "Include Expansions" or "Include Exclusions" checkbox toggles
  includeExpansionsInput.addEventListener("change", () => {
    loadCollection({ forceRefresh: true });
  });

  if (includeExclusionsInput) {
    includeExclusionsInput.addEventListener("change", () => {
      loadCollection({ forceRefresh: true });
    });
  }

  // "Unplayed Only" is a pure client-side filter, so no refetch is needed
  if (unplayedOnlyInput) {
    unplayedOnlyInput.addEventListener("change", () => {
      applyClientFilters();
    });
  }

  // The Played Games card doubles as the toggle for the play-history chart
  if (playedStatsCard) {
    playedStatsCard.addEventListener("click", () => {
      setPlayHistoryExpanded(!playHistoryExpanded, {
        forceRefresh: pendingForceRefresh,
      });
    });
    playedStatsCard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setPlayHistoryExpanded(!playHistoryExpanded, {
          forceRefresh: pendingForceRefresh,
        });
      }
    });
  }

  if (dismissErrorBtn) {
    dismissErrorBtn.addEventListener("click", () => {
      errorBox.classList.add("hidden");
    });
  }

  // Fetch / Refresh Buttons
  fetchBtn.addEventListener("click", () => loadCollection({ forceRefresh: true }));
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadCollection({ forceRefresh: true }));
  }

  // Cloudflare Access Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Cloudflare Access revokes the active session cookie at /cdn-cgi/access/logout
      window.location.href = `${window.location.origin}/cdn-cgi/access/logout`;
    });
  }

  // Manage Exclusions Modal Handlers
  if (openExclusionsModalBtn) {
    openExclusionsModalBtn.addEventListener("click", () => {
      openExclusionsModal();
    });
  }

  if (closeExclusionsModalBtn) {
    closeExclusionsModalBtn.addEventListener("click", () => {
      if (exclusionsModal) exclusionsModal.classList.add("hidden");
    });
  }

  function openExclusionsModal() {
    const user = (loadedUsername || usernameInput.value.trim()).toLowerCase();
    if (!user) {
      alert("Please enter a BGG username first.");
      usernameInput.focus();
      return;
    }
    if (exclusionsModalTitle) {
      exclusionsModalTitle.textContent = `Manage Exclusions for "${user}"`;
    }

    // Populate datalist with all collection titles for quick autocomplete
    if (collectionTitlesDatalist && rawCollectionData?.items) {
      collectionTitlesDatalist.innerHTML = rawCollectionData.items
        .map((i) => `<option value="${i.name}">`)
        .join("");
    }

    // Clone current user exclusions
    editingExclusions = Array.isArray(rawCollectionData?.userExclusions)
      ? [...rawCollectionData.userExclusions]
      : [];

    renderModalExclusionsList();
    if (exclusionsModal) exclusionsModal.classList.remove("hidden");
  }

  function renderModalExclusionsList() {
    if (!modalExclusionsList) return;
    if (modalExclusionsCount) modalExclusionsCount.textContent = editingExclusions.length;

    if (editingExclusions.length === 0) {
      modalExclusionsList.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-medium">No exclusions set for this user.</div>`;
      return;
    }

    modalExclusionsList.innerHTML = editingExclusions
      .map((title, idx) => `
        <div class="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <span class="text-xs font-bold text-slate-800 truncate mr-2">${title}</span>
          <button data-remove-idx="${idx}" class="remove-exclusion-btn text-xs text-slate-400 hover:text-rose-600 p-1 transition" title="Remove exclusion">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `)
      .join("");

    // Bind remove buttons
    modalExclusionsList.querySelectorAll(".remove-exclusion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.removeIdx, 10);
        if (!isNaN(idx)) {
          editingExclusions.splice(idx, 1);
          renderModalExclusionsList();
        }
      });
    });
  }

  // Add Exclusion Handler
  if (addExclusionBtn && newExclusionInput) {
    const handleAdd = () => {
      const val = newExclusionInput.value.trim();
      if (!val) return;
      if (!editingExclusions.some((e) => e.toLowerCase() === val.toLowerCase())) {
        editingExclusions.unshift(val);
        newExclusionInput.value = "";
        renderModalExclusionsList();
      }
    };
    addExclusionBtn.addEventListener("click", handleAdd);
    newExclusionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    });
  }

  // Clear All Exclusions
  if (clearAllExclusionsBtn) {
    clearAllExclusionsBtn.addEventListener("click", () => {
      editingExclusions = [];
      renderModalExclusionsList();
    });
  }

  // Reset to Code Defaults
  if (resetDefaultExclusionsBtn) {
    resetDefaultExclusionsBtn.addEventListener("click", async () => {
      const user = (loadedUsername || usernameInput.value.trim() || "bwobbones").toLowerCase();
      if (user === "bwobbones") {
        editingExclusions = [
          "Agricola (Revised Edition)",
          "Excalibur",
          "Flash Point: Legacy of Flame",
          "GKR: Heavy Hitters",
          "Glen More II: Chronicles",
          "Moon Colony Bloodbath",
          "Pictomania (Second Edition)",
          "Psycho Raiders",
          "Quacks",
          "Ready Set Bet",
          "Sagrada Artisans",
          "Shikoku 1889",
          "The Queen's Dilemma",
          "Through Ice & Snow",
          "Ticket to Ride: Europe",
          "Wingspan",
          "Camel Up",
        ];
      } else {
        editingExclusions = [];
      }
      renderModalExclusionsList();
    });
  }

  // Save Exclusions to Cloudflare KV permanently across all devices
  if (saveExclusionsBtn) {
    saveExclusionsBtn.addEventListener("click", async () => {
      const user = (loadedUsername || usernameInput.value.trim() || "bwobbones").toLowerCase();
      const originalBtnHTML = saveExclusionsBtn.innerHTML;
      saveExclusionsBtn.disabled = true;
      saveExclusionsBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Saving...`;

      try {
        const res = await fetch("/api/exclusions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: user,
            exclusions: editingExclusions,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to save exclusions");
        }

        // Close modal
        if (exclusionsModal) exclusionsModal.classList.add("hidden");

        // Force refresh collection to apply new KV exclusions
        loadCollection({ forceRefresh: true });
      } catch (err) {
        alert(`Error saving exclusions: ${err.message}`);
      } finally {
        saveExclusionsBtn.disabled = false;
        saveExclusionsBtn.innerHTML = originalBtnHTML;
      }
    });
  }

  // Spin Modal Triggers
  openSpinModalBtn.addEventListener("click", () => {
    if (!filteredItems || filteredItems.length === 0) {
      alert("No games available to spin! Please fetch a collection first.");
      return;
    }
    currentWheelItems = filteredItems;
    wheelSubheading.textContent = `Spinning among ${filteredItems.length} selected games`;
    winnerCard.classList.add("hidden");
    resetDiscordShareUI();
    spinModal.classList.remove("hidden");
    drawWheel();
  });

  closeSpinModalBtn.addEventListener("click", () => {
    if (isSpinning) return;
    spinModal.classList.add("hidden");
  });

  doSpinBtn.addEventListener("click", () => {
    if (isSpinning || currentWheelItems.length === 0) return;
    spinWheel();
  });

  if (shareSpinBtn) {
    shareSpinBtn.addEventListener("click", () => sendSpinResultToDiscord());
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatRatingBadge(rating) {
    if (rating === null || rating === undefined || isNaN(rating)) {
      return `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500">N/A</span>`;
    }
    const val = parseFloat(rating);
    const text = val.toFixed(1);

    if (val >= 8.0) {
      return `<span class="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-xs">${text}</span>`;
    }
    if (val >= 7.2) {
      return `<span class="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">${text}</span>`;
    }
    if (val >= 6.0) {
      return `<span class="px-2.5 py-1 rounded-lg text-xs font-black bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-xs">${text}</span>`;
    }
    return `<span class="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-xs">${text}</span>`;
  }

  // Append line to live activity log console
  function appendActivityLog(step, msg) {
    const time = new Date().toLocaleTimeString();
    clientActivityLogs.push({ step, time, message: msg });

    if (logEntriesCount) {
      logEntriesCount.textContent = `${clientActivityLogs.length} entries`;
    }

    if (progressLogConsole) {
      const line = document.createElement("div");
      line.className = "flex items-start gap-2 text-xs font-mono leading-relaxed";

      let stepBadge = "";
      if (step === 1) stepBadge = '<span class="text-sky-400 font-bold">[Step 1]</span>';
      else if (step === 2) stepBadge = '<span class="text-amber-400 font-bold">[Step 2]</span>';
      else if (step === 3) stepBadge = '<span class="text-emerald-400 font-bold">[Step 3]</span>';
      else stepBadge = '<span class="text-slate-400 font-bold">[Info]</span>';

      line.innerHTML = `<span class="text-slate-500">${time}</span> ${stepBadge} <span class="text-slate-200">${msg}</span>`;
      progressLogConsole.appendChild(line);
      progressLogConsole.scrollTop = progressLogConsole.scrollHeight;
    }
  }

  // Toggle Progress Details Box
  if (toggleProgressDetailsBtn && progressDetailsBox) {
    toggleProgressDetailsBtn.addEventListener("click", () => {
      const isHidden = progressDetailsBox.classList.contains("hidden");
      if (isHidden) {
        progressDetailsBox.classList.remove("hidden");
        if (progressDetailsToggleLabel) progressDetailsToggleLabel.textContent = "Hide Details";
        if (progressDetailsChevron) progressDetailsChevron.classList.add("rotate-180");
      } else {
        progressDetailsBox.classList.add("hidden");
        if (progressDetailsToggleLabel) progressDetailsToggleLabel.textContent = "Show Details";
        if (progressDetailsChevron) progressDetailsChevron.classList.remove("rotate-180");
      }
    });
  }

  // Re-open Fetch Details from Results Card Header
  if (viewFetchDetailsBtn && progressBox) {
    viewFetchDetailsBtn.addEventListener("click", () => {
      progressBox.classList.toggle("hidden");
      if (!progressBox.classList.contains("hidden") && progressDetailsBox) {
        progressDetailsBox.classList.remove("hidden");
        if (progressDetailsToggleLabel) progressDetailsToggleLabel.textContent = "Hide Details";
        if (progressDetailsChevron) progressDetailsChevron.classList.add("rotate-180");
      }
    });
  }

  function updateProgressUI(pct, stepName, msg) {
    const safePct = Math.min(100, Math.max(0, pct || 0));
    progressBar.style.width = `${safePct}%`;
    progressPercentageText.textContent = `${safePct}%`;
    if (stepName) progressStepBadge.textContent = stepName;
    if (msg) progressMessage.textContent = msg;

    if (stepName && stepName.includes("1/3") && step1StatusBadge) {
      step1StatusBadge.textContent = "In Progress...";
      step1StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse";
    } else if (stepName && stepName.includes("2/3")) {
      if (step1StatusBadge) {
        step1StatusBadge.textContent = "✔ Done";
        step1StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
      if (step2StatusBadge) {
        step2StatusBadge.textContent = `In Progress (${safePct}%)`;
        step2StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse";
      }
    } else if (stepName && stepName.includes("3/3")) {
      if (step1StatusBadge) {
        step1StatusBadge.textContent = "✔ Done";
        step1StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
      if (step2StatusBadge) {
        step2StatusBadge.textContent = "✔ Done";
        step2StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
      if (step3StatusBadge) {
        step3StatusBadge.textContent = "In Progress...";
        step3StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse";
      }
    }
  }

  // Wheel geometry is authored in this logical size; the live canvas uses it
  // directly and the GIF exporter scales it down.
  const WHEEL_BASE_SIZE = 420;

  // Animated GIF export settings (kept modest so Discord uploads stay quick)
  const GIF_SIZE = 360;
  const GIF_FPS = 12;
  const GIF_HOLD_MS = 1500;
  // GIFs have no alpha channel, so transparent canvas pixels would snap to the
  // nearest palette color (dark navy). Paint a light background instead.
  const GIF_BACKGROUND = "#f8fafc";

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function hexToRgb(hex) {
    const h = String(hex).replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  // Fixed palette for exported GIFs (seasonal wheel colors + UI chrome).
  // Using one fixed palette instead of quantizing every frame is faster and
  // keeps colors from flickering between frames.
  function buildGifPalette() {
    const colors = [
      GIF_BACKGROUND,
      "#0f172a",
      "#cbd5e1",
      "#f59e0b",
      "#f43f5e",
      ...(seasonalWheelPalettes[currentSeason] || seasonalWheelPalettes.summer),
    ];
    const seen = new Set();
    const palette = [];
    for (const color of colors) {
      const rgb = hexToRgb(color);
      const key = rgb.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        palette.push(rgb);
      }
    }
    return palette;
  }

  function roundRectPath(targetCtx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius, y);
    targetCtx.lineTo(x + w - radius, y);
    targetCtx.quadraticCurveTo(x + w, y, x + w, y + radius);
    targetCtx.lineTo(x + w, y + h - radius);
    targetCtx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    targetCtx.lineTo(x + radius, y + h);
    targetCtx.quadraticCurveTo(x, y + h, x, y + h - radius);
    targetCtx.lineTo(x, y + radius);
    targetCtx.quadraticCurveTo(x, y, x, y + radius);
    targetCtx.closePath();
  }

  function fitText(targetCtx, text, maxWidth) {
    const full = String(text);
    if (targetCtx.measureText(full).width <= maxWidth) return full;
    let cut = full.length;
    while (cut > 1) {
      cut--;
      const candidate = `${full.slice(0, cut)}…`;
      if (targetCtx.measureText(candidate).width <= maxWidth) return candidate;
    }
    return "…";
  }

  // Winner banner drawn on top of the final GIF frame
  function drawWinnerBanner(targetCtx, size, title, subtitle) {
    targetCtx.save();
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);

    const padding = Math.round(size * 0.05);
    const maxTextWidth = size - padding * 2;
    const labelSize = Math.max(10, Math.round(size * 0.036));
    const titleSize = Math.max(15, Math.round(size * 0.064));
    const subSize = Math.max(10, Math.round(size * 0.037));

    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";

    targetCtx.font = `900 ${titleSize}px sans-serif`;
    const titleText = fitText(targetCtx, title, maxTextWidth);
    const titleWidth = targetCtx.measureText(titleText).width;

    let subText = null;
    if (subtitle) {
      targetCtx.font = `700 ${subSize}px sans-serif`;
      subText = fitText(targetCtx, subtitle, maxTextWidth);
    }

    const lineGap = Math.round(labelSize * 0.5);
    const chipWidth = Math.min(size - 6, Math.max(titleWidth, padding * 3) + padding * 1.4);
    const chipHeight =
      labelSize + titleSize + (subText ? subSize + lineGap : 0) + padding * 1.1;
    const chipX = (size - chipWidth) / 2;
    const chipY = size - chipHeight - Math.round(size * 0.045);

    targetCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
    targetCtx.strokeStyle = "#f59e0b";
    targetCtx.lineWidth = 2;
    roundRectPath(targetCtx, chipX, chipY, chipWidth, chipHeight, Math.round(size * 0.035));
    targetCtx.fill();
    targetCtx.stroke();

    let cursorY = chipY + padding * 0.55 + labelSize / 2;
    targetCtx.fillStyle = "#f59e0b";
    targetCtx.font = `900 ${labelSize}px sans-serif`;
    targetCtx.fillText("WINNER", size / 2, cursorY);

    cursorY += labelSize / 2 + lineGap + titleSize / 2;
    targetCtx.fillStyle = "#ffffff";
    targetCtx.font = `900 ${titleSize}px sans-serif`;
    targetCtx.fillText(titleText, size / 2, cursorY);

    if (subText) {
      cursorY += titleSize / 2 + lineGap + subSize / 2;
      targetCtx.fillStyle = "#cbd5e1";
      targetCtx.font = `700 ${subSize}px sans-serif`;
      targetCtx.fillText(subText, size / 2, cursorY);
    }

    targetCtx.restore();
  }

  // Draw the graphical wheel into any 2D context. Shared by the live canvas and
  // the GIF exporter so the two can never drift apart.
  function drawWheelTo(targetCtx, size, angle, options = {}) {
    const items = options.items || currentWheelItems || [];
    const numSlices = items.length;
    if (!targetCtx || numSlices === 0) return;

    const palette = seasonalWheelPalettes[currentSeason] || seasonalWheelPalettes.summer;
    const scale = size / WHEEL_BASE_SIZE;
    const centerX = WHEEL_BASE_SIZE / 2;
    const centerY = WHEEL_BASE_SIZE / 2;
    const outerRadius = centerX - 8;
    const innerRadius = 32;
    const arc = (2 * Math.PI) / numSlices;

    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, size, size);
    if (options.background) {
      targetCtx.fillStyle = options.background;
      targetCtx.fillRect(0, 0, size, size);
    }
    targetCtx.save();
    targetCtx.scale(scale, scale);

    for (let i = 0; i < numSlices; i++) {
      const sliceAngle = angle + i * arc;

      // Fill Seasonal Slice
      targetCtx.beginPath();
      targetCtx.arc(centerX, centerY, outerRadius, sliceAngle, sliceAngle + arc);
      targetCtx.lineTo(centerX, centerY);
      targetCtx.fillStyle = palette[i % palette.length];
      targetCtx.fill();
      targetCtx.strokeStyle = "#cbd5e1";
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();

      // Render Centered Title Text along Slice Angle
      targetCtx.save();
      targetCtx.translate(centerX, centerY);
      targetCtx.rotate(sliceAngle + arc / 2);
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "middle";
      targetCtx.fillStyle = "#0f172a";
      targetCtx.font =
        numSlices > 50
          ? "bold 8px sans-serif"
          : numSlices > 25
          ? "bold 10px sans-serif"
          : "bold 12px sans-serif";

      let title = items[i].name;
      const maxTextLen = numSlices > 40 ? 10 : numSlices > 20 ? 14 : 20;
      if (title.length > maxTextLen) {
        title = title.substring(0, maxTextLen - 2) + "..";
      }

      const midRadius = (innerRadius + outerRadius) / 2 + 10;
      targetCtx.fillText(title, midRadius, 0);
      targetCtx.restore();
    }

    // Center Hub Circle
    targetCtx.beginPath();
    targetCtx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    targetCtx.fillStyle = "#0f172a";
    targetCtx.fill();
    targetCtx.strokeStyle = "#f59e0b";
    targetCtx.lineWidth = 3;
    targetCtx.stroke();

    // Center Dice Text / Icon
    targetCtx.fillStyle = "#f59e0b";
    targetCtx.font = "bold 16px sans-serif";
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    targetCtx.fillText("🎲", centerX, centerY);

    targetCtx.restore();

    if (options.banner) {
      drawWinnerBanner(targetCtx, size, options.banner, options.bannerSubtitle);
    }
  }

  // Draw Graphical Wheel on HTML5 Canvas
  function drawWheel() {
    if (!ctx || !wheelCanvas) return;
    drawWheelTo(ctx, wheelCanvas.width, currentAngle);
  }

  // Spin Wheel Physics Animation
  function spinWheel() {
    isSpinning = true;
    doSpinBtn.disabled = true;
    doSpinBtn.classList.add("opacity-50", "cursor-not-allowed");
    winnerCard.classList.add("hidden");
    resetDiscordShareUI();
    lastSpin = null;

    const numSlices = currentWheelItems.length;
    const arc = (2 * Math.PI) / numSlices;

    const extraRotations = 5 + Math.floor(Math.random() * 4);
    const randomSlice = Math.floor(Math.random() * numSlices);
    const targetAngle =
      extraRotations * 2 * Math.PI +
      (3 * Math.PI) / 2 -
      (randomSlice * arc + arc / 2);

    const startAngle = currentAngle;
    const angleDelta = targetAngle - startAngle;
    const duration = 4500;
    const startTimestamp = performance.now();

    // Remember the animation so the spin can be re-rendered as an animated GIF
    lastSpinAnimation = {
      startAngle,
      angleDelta,
      duration,
      numSlices,
      items: currentWheelItems.slice(),
    };

    function animate(now) {
      const elapsed = now - startTimestamp;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOutCubic(progress);

      currentAngle = startAngle + angleDelta * easedProgress;
      drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isSpinning = false;
        doSpinBtn.disabled = false;
        doSpinBtn.classList.remove("opacity-50", "cursor-not-allowed");

        const normalizedAngle = (currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        let winningIndex = Math.floor(
          ((1.5 * Math.PI - normalizedAngle + 2 * Math.PI) % (2 * Math.PI)) / arc
        );
        winningIndex = (winningIndex + numSlices) % numSlices;

        const winner = currentWheelItems[winningIndex];
        announceWinner(winner);
      }
    }

    requestAnimationFrame(animate);
  }

  function announceWinner(winner) {
    if (!winner) return;

    const bggUrl = `https://boardgamegeek.com/boardgame/${winner.id}`;

    winnerTitle.innerHTML = `
      <a href="${bggUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-amber-600 hover:underline inline-flex items-center gap-1.5 truncate max-w-full">
        <span>${winner.name}</span>
        <i class="fa-solid fa-arrow-up-right-from-square text-xs text-amber-500"></i>
      </a>
    `;
    winnerBestAt.textContent = winner.bestAt
      ? winner.isCommunityBest !== false
        ? `Best At: ${winner.bestAt}`
        : `Players: ${winner.bestAt} (publisher)`
      : "Player Count: N/A";
    winnerRating.textContent = winner.averageRating
      ? `Avg: ${winner.averageRating.toFixed(1)}`
      : "Avg: N/A";

    if (winner.thumbnail) {
      winnerImgContainer.innerHTML = `
        <a href="${bggUrl}" target="_blank" rel="noopener noreferrer" class="block w-full h-full">
          <img src="${winner.thumbnail}" alt="${winner.name}" class="w-full h-full object-cover">
        </a>
      `;
    } else {
      winnerImgContainer.innerHTML = `<i class="fa-solid fa-trophy text-amber-500 text-2xl"></i>`;
    }

    winnerCard.classList.remove("hidden");

    // Enable the Discord share button for this result
    lastSpin = lastSpinAnimation ? { ...lastSpinAnimation, winner } : null;
    resetDiscordShareUI();
    if (discordShareWrapper) {
      discordShareWrapper.classList.remove("hidden");
    }
  }

  // ---------------------------------------------------------------------------
  // Discord sharing: render the spin as an animated GIF and post it
  // ---------------------------------------------------------------------------

  function spinWinnerSubtitle(winner) {
    const parts = [];
    if (winner.bestAt) {
      parts.push(
        winner.isCommunityBest !== false
          ? `Best at ${winner.bestAt}`
          : `${winner.bestAt} players (publisher)`
      );
    }
    if (winner.averageRating) parts.push(`Avg ${winner.averageRating.toFixed(1)}`);
    return parts.join("  •  ");
  }

  function resetDiscordShareUI() {
    if (discordShareWrapper) discordShareWrapper.classList.add("hidden");
    if (shareSpinBtn) {
      shareSpinBtn.disabled = false;
      shareSpinBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
    if (shareSpinLabel) shareSpinLabel.textContent = "Send Spin to Discord";
    if (discordShareStatus) {
      discordShareStatus.classList.add("hidden");
      discordShareStatus.textContent = "";
    }
  }

  function setDiscordShareStatus(message, isError = false) {
    if (!discordShareStatus) return;
    discordShareStatus.textContent = message;
    discordShareStatus.className = `text-center text-xs font-bold ${
      isError ? "text-rose-600" : "text-slate-600"
    }`;
    discordShareStatus.classList.remove("hidden");
  }

  // Re-render the recorded spin into a GIF at a fixed frame rate so the export
  // is smooth regardless of the display refresh rate during the live spin.
  async function buildSpinGif(spin) {
    const { GIFEncoder, applyPalette } = await import("/vendor/gifenc.esm.js");
    const canvas = document.createElement("canvas");
    canvas.width = GIF_SIZE;
    canvas.height = GIF_SIZE;
    const gifCtx = canvas.getContext("2d", { willReadFrequently: true });

    const palette = buildGifPalette();
    const gif = GIFEncoder();
    const frameDelay = Math.round(1000 / GIF_FPS);
    const spinFrames = Math.max(2, Math.round(spin.duration / frameDelay));

    const captureFrame = (angle, banner) => {
      drawWheelTo(gifCtx, GIF_SIZE, angle, {
        items: spin.items,
        background: GIF_BACKGROUND,
        banner,
        bannerSubtitle: banner ? spinWinnerSubtitle(spin.winner) : null,
      });
      const { data } = gifCtx.getImageData(0, 0, GIF_SIZE, GIF_SIZE);
      return applyPalette(new Uint8Array(data.buffer), palette);
    };

    for (let i = 0; i < spinFrames; i++) {
      const t = i / (spinFrames - 1);
      const angle = spin.startAngle + spin.angleDelta * easeOutCubic(t);
      const indexed = captureFrame(angle, null);
      gif.writeFrame(indexed, GIF_SIZE, GIF_SIZE, { palette, delay: frameDelay });

      // Yield occasionally so the button/status stay responsive during encoding
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    // Final frame holds on the winner banner
    const finalAngle = spin.startAngle + spin.angleDelta;
    const finalIndexed = captureFrame(finalAngle, spin.winner.name);
    gif.writeFrame(finalIndexed, GIF_SIZE, GIF_SIZE, {
      palette,
      delay: GIF_HOLD_MS,
    });

    gif.finish();
    return new Blob([gif.bytes()], { type: "image/gif" });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read GIF data"));
      reader.readAsDataURL(blob);
    });
  }

  async function sendSpinResultToDiscord() {
    if (!lastSpin || !lastSpin.winner || !shareSpinBtn || shareSpinBtn.disabled) return;

    const winner = lastSpin.winner;
    shareSpinBtn.disabled = true;
    shareSpinBtn.classList.add("opacity-50", "cursor-not-allowed");
    if (shareSpinLabel) shareSpinLabel.textContent = "Rendering GIF…";
    setDiscordShareStatus("Drawing the wheel frames…");

    try {
      const blob = await buildSpinGif(lastSpin);
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);

      if (shareSpinLabel) shareSpinLabel.textContent = "Uploading…";
      setDiscordShareStatus(`Uploading animated GIF (${sizeMb} MB) to Discord…`);

      const res = await fetch("/api/discord/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gif: await blobToBase64(blob),
          winner: {
            id: winner.id,
            name: winner.name,
            year: winner.year,
            bestAt: winner.bestAt,
            isCommunityBest: winner.isCommunityBest,
            averageRating: winner.averageRating,
            numPlays: winner.numPlays,
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Discord share failed (HTTP ${res.status})`);
      }

      if (shareSpinLabel) shareSpinLabel.textContent = "Sent to Discord!";
      setDiscordShareStatus("🎉 Spin result posted to Discord!");
    } catch (err) {
      if (shareSpinLabel) shareSpinLabel.textContent = "Retry Send to Discord";
      setDiscordShareStatus(err.message || "Could not send to Discord.", true);
    } finally {
      shareSpinBtn.disabled = false;
      shareSpinBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }

  // Client-side Player Count Matcher
  function matchesPlayerCountsClient(item, selectedCounts) {
    if (!selectedCounts || selectedCounts.length === 0) return true;

    let nums = [];
    if (item.bestAt && item.bestAt !== "(Undetermined)") {
      const rawNums = item.bestAt.match(/\d+/g)?.map(Number) || [];
      if ((item.bestAt.includes("–") || item.bestAt.includes("-")) && rawNums.length >= 2) {
        const min = Math.min(...rawNums);
        const max = Math.max(...rawNums);
        for (let n = min; n <= max; n++) nums.push(n);
      } else {
        nums = rawNums;
      }
    } else if (item.minPlayers && item.maxPlayers) {
      for (let p = item.minPlayers; p <= item.maxPlayers; p++) nums.push(p);
    }

    for (const opt of selectedCounts) {
      const cleanOpt = String(opt).toLowerCase().trim();
      if (cleanOpt === "1p" && nums.includes(1)) return true;
      if (cleanOpt === "2p" && nums.includes(2)) return true;
      if (cleanOpt === "3p" && nums.includes(3)) return true;
      if (cleanOpt === "4p" && nums.includes(4)) return true;
      if (cleanOpt === "5p" && nums.includes(5)) return true;
      if (cleanOpt === "6+p" && nums.some((n) => n >= 6)) return true;
    }

    return false;
  }

  // Client-side Truncated Compact List Generator (1500 chars, Unique & Identifiable)
  function generateCompactListClient(items, maxLength = 1500) {
    if (!items || items.length === 0) return "";

    function cleanTitle(fullName) {
      let name = fullName.replace(/\([^)]*\)/g, "").trim();
      return name.replace(/\s+/g, "");
    }

    const fullNames = items.map((i) => cleanTitle(i.name));

    function disambiguate(list) {
      const counts = new Map();
      list.forEach((i) => counts.set(i, (counts.get(i) || 0) + 1));
      const res = [...list];

      const dupKeys = new Set(
        Array.from(counts.entries())
          .filter(([, c]) => c > 1)
          .map(([k]) => k)
      );

      if (dupKeys.size === 0) return res;

      for (const k of dupKeys) {
        const idxs = [];
        res.forEach((v, idx) => {
          if (v === k) idxs.push(idx);
        });

        idxs.forEach((idx) => {
          const fn = fullNames[idx];
          let diff = fn.slice(k.length).replace(/[^a-zA-Z0-9]/g, "");
          if (diff.length > 0) {
            res[idx] = k + diff.slice(0, 2);
          } else {
            res[idx] = k + (idxs.indexOf(idx) + 1);
          }
        });
      }

      const finalCounts = new Map();
      res.forEach((i) => finalCounts.set(i, (finalCounts.get(i) || 0) + 1));
      const seen = new Map();

      return res.map((i) => {
        if (finalCounts.get(i) > 1) {
          const c = (seen.get(i) || 0) + 1;
          seen.set(i, c);
          return `${i}${c}`;
        }
        return i;
      });
    }

    let candidateNames = disambiguate(fullNames);
    let candidate = candidateNames.join(",");
    if (candidate.length <= maxLength) return candidate;

    const maxLen = Math.max(...fullNames.map((n) => n.length));

    for (let K = maxLen; K >= 1; K--) {
      let truncated = fullNames.map((n) => n.slice(0, K));
      truncated = disambiguate(truncated);
      candidate = truncated.join(",");
      if (candidate.length <= maxLength) {
        return candidate;
      }
    }

    return candidateNames
      .map((n, idx) => `${n.slice(0, 1)}${idx + 1}`)
      .join(",")
      .slice(0, maxLength);
  }

  // Instant Client-Side Query Filtering & Rendering
  function applyClientFilters() {
    if (!rawCollectionData || !rawCollectionData.items) return;

    let items = [...rawCollectionData.items];
    const selectedPlayerCounts = getSelectedPlayerCounts();

    const isGold = (i) =>
      i.averageRating !== null &&
      i.averageRating >= 7.2 &&
      i.usersRated !== null &&
      i.usersRated > 300;

    // 1. Filter by Preset Mode (gold, shit)
    if (activeMode === "shit") {
      items = items.filter(
        (i) =>
          i.averageRating !== null &&
          i.averageRating <= 7.1 &&
          matchesPlayerCountsClient(i, selectedPlayerCounts)
      );
    } else if (activeMode === "gold") {
      items = items.filter(
        (i) => isGold(i) && matchesPlayerCountsClient(i, selectedPlayerCounts)
      );
    } else {
      // All Games mode: filter by selected player counts
      items = items.filter((i) =>
        matchesPlayerCountsClient(i, selectedPlayerCounts)
      );
    }

    // 2. Filter by Search Query
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      items = items.filter((i) => i.name.toLowerCase().includes(query));
    }

    // 3. Filter by Min Rating
    if (minRatingInput.value) {
      const minR = parseFloat(minRatingInput.value);
      if (!isNaN(minR)) {
        items = items.filter((i) => (i.averageRating ?? 0) >= minR);
      }
    }

    // 4. Filter to Unplayed Only (0 recorded plays)
    const unplayedCount = rawCollectionData.items.filter(
      (i) => (i.numPlays || 0) === 0
    ).length;
    if (unplayedCountBadge) {
      unplayedCountBadge.textContent = String(unplayedCount);
    }
    const unplayedOnly = !!(unplayedOnlyInput && unplayedOnlyInput.checked);
    if (unplayedOnly) {
      items = items.filter((i) => (i.numPlays || 0) === 0);
    }

    filteredItems = items;

    // Render Gold Stats Card
    if (rawCollectionData.totalEligibleCount > 0) {
      statsCard.classList.remove("hidden");
      statsDetail.textContent = `${rawCollectionData.goldCount} / ${rawCollectionData.totalEligibleCount} Gold Games`;
      statsPctBadge.textContent = `${rawCollectionData.goldPercentage}%`;
    }

    // Render Played Stats Card (whole collection, independent of the active filters)
    if (playedStatsCard) {
      const totalEligible = rawCollectionData.totalEligibleCount || 0;
      if (totalEligible > 0) {
        // Fall back to counting client-side so cached payloads from before this
        // metric existed still render correctly
        const playedCount =
          typeof rawCollectionData.playedCount === "number"
            ? rawCollectionData.playedCount
            : rawCollectionData.items.filter((i) => (i.numPlays || 0) > 0).length;
        const playedPct =
          rawCollectionData.playedPercentage ??
          ((playedCount / totalEligible) * 100).toFixed(1);
        const unplayedCount =
          typeof rawCollectionData.unplayedCount === "number"
            ? rawCollectionData.unplayedCount
            : totalEligible - playedCount;

        playedStatsDetail.textContent = `${playedCount} / ${totalEligible} Games Played`;
        playedStatsPctBadge.textContent = `${playedPct}%`;
        if (playedStatsHint) {
          playedStatsHint.textContent = `Percentage of collection with at least 1 logged play • ${unplayedCount} unplayed`;
        }
        playedStatsCard.classList.remove("hidden");
      } else {
        playedStatsCard.classList.add("hidden");
      }
    }

    // Update Results Heading
    const modeLabel = activeMode ? ` [preset: ${activeMode}]` : "";
    const unplayedLabel = unplayedOnly ? " [unplayed only]" : "";
    resultsHeading.textContent = `Collection Results for ${rawCollectionData.username}${modeLabel}${unplayedLabel}`;

    renderTable();
    compactListText.value = generateCompactListClient(filteredItems);
    jsonText.textContent = JSON.stringify(filteredItems, null, 2);

    resultsCard.classList.remove("hidden");
  }

  // ---------------------------------------------------------------------------
  // Play history: how the share of the collection played changed over time
  // ---------------------------------------------------------------------------

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatMonthDay(isoDate) {
    if (!isoDate) return "—";
    const [y, m] = isoDate.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  function updatePlayHistoryToggle() {
    const card = document.getElementById("playedStatsCard");
    if (card) card.setAttribute("aria-expanded", playHistoryExpanded ? "true" : "false");
    if (playHistoryToggleLabel) {
      playHistoryToggleLabel.textContent = playHistoryExpanded
        ? "Hide played-over-time chart"
        : "Show played-over-time chart";
    }
    if (playHistoryToggleChevron) {
      playHistoryToggleChevron.classList.toggle("rotate-180", playHistoryExpanded);
    }
  }

  function playHistoryShowLoading(message) {
    if (!playHistoryCard) return;
    playHistoryCard.classList.remove("hidden");
    if (playHistoryLoading) playHistoryLoading.classList.remove("hidden");
    if (playHistoryChart) playHistoryChart.classList.add("hidden");
    if (playHistoryMessage) playHistoryMessage.classList.add("hidden");
    if (playHistoryTooltip) playHistoryTooltip.classList.add("hidden");
    if (playHistoryLoadingText) playHistoryLoadingText.textContent = message;
  }

  function playHistoryShowMessage(message) {
    if (!playHistoryCard) return;
    if (playHistoryLoading) playHistoryLoading.classList.add("hidden");
    if (playHistoryChart) playHistoryChart.classList.add("hidden");
    if (playHistoryTooltip) playHistoryTooltip.classList.add("hidden");
    if (playHistoryMessage) {
      playHistoryMessage.textContent = message;
      playHistoryMessage.classList.remove("hidden");
    }
  }

  // Expand/collapse the chart from the Played Games card. The play history is
  // fetched lazily on first expand (and re-fetched whenever the collection is
  // reloaded), so a collapsed chart costs nothing.
  function setPlayHistoryExpanded(expanded, { forceRefresh = false } = {}) {
    playHistoryExpanded = expanded;
    updatePlayHistoryToggle();

    if (!expanded) {
      if (playHistoryCard) playHistoryCard.classList.add("hidden");
      playHistoryRequestId++; // drop any in-flight response
      return;
    }

    if (playHistoryLoaded) {
      if (playHistoryCard) playHistoryCard.classList.remove("hidden");
      return;
    }

    loadPlayHistory({ forceRefresh });
  }

  function resetPlayHistoryUI() {
    playHistoryRequestId++;
    playHistoryExpanded = false;
    playHistoryLoaded = false;
    if (playHistoryCard) playHistoryCard.classList.add("hidden");
    if (playHistoryChart) playHistoryChart.innerHTML = "";
    if (playHistoryChips) playHistoryChips.innerHTML = "";
    updatePlayHistoryToggle();
  }

  async function loadPlayHistory({ forceRefresh = false } = {}) {
    if (!playHistoryCard) return;
    const username = (loadedUsername || usernameInput.value).trim();
    if (!username) return;
    if (!rawCollectionData || !rawCollectionData.items) return;

    const requestId = ++playHistoryRequestId;
    playHistoryShowLoading(forceRefresh ? "Refreshing play history from BGG…" : "Reading your BGG play history…");

    const slowHint = setTimeout(() => {
      if (requestId === playHistoryRequestId && playHistoryLoadingText) {
        playHistoryLoadingText.textContent = "Still reading — big play history, hang tight…";
      }
    }, 4000);

    // BGG play pages are fetched in bounded bundles (Worker subrequest limits),
    // so walk them here and build the timeline from the collection we already have.
    const PAGES_PER_REQUEST = 6;
    const MAX_BUNDLES = 25;

    try {
      const { buildPlayTimeline } = await import("/vendor/playsTimeline.mjs");
      const eligibleIds = new Set(rawCollectionData.items.map((i) => i.id).filter(Boolean));
      const eligibleCount = rawCollectionData.totalEligibleCount || eligibleIds.size;

      const plays = [];
      let from = 1;
      let totalPages = 1;

      for (let bundle = 0; bundle < MAX_BUNDLES; bundle++) {
        const params = new URLSearchParams({
          username,
          from: String(from),
          count: String(PAGES_PER_REQUEST),
        });
        if (forceRefresh) params.set("forceRefresh", "true");

        const res = await fetch(`/api/plays/pages?${params.toString()}`, {
          credentials: "include",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || `Could not load play history (HTTP ${res.status})`);
        }
        if (requestId !== playHistoryRequestId) return; // superseded by a newer request

        const data = payload.data || {};
        if (Array.isArray(data.plays)) plays.push(...data.plays);
        totalPages = data.totalPages || 1;
        from += data.count || PAGES_PER_REQUEST;

        if (from > totalPages) break;
        if (playHistoryLoadingText) {
          playHistoryLoadingText.textContent = `Reading play history… page ${Math.min(from - 1, totalPages)} of ${totalPages}`;
        }
      }

      if (requestId !== playHistoryRequestId) return;

      const timeline = buildPlayTimeline({ plays, eligibleIds, eligibleCount });

      if (!timeline.points || timeline.points.length === 0) {
        playHistoryLoaded = true;
        playHistoryShowMessage(
          plays.length === 0
            ? "No plays logged on BoardGameGeek yet."
            : "None of your logged plays are in this collection view. Try including exclusions or expansions."
        );
        renderPlayHistoryChips(timeline);
        return;
      }

      playHistoryLoaded = true;
      renderPlayHistoryChips(timeline);
      renderPlayHistoryChart(timeline);
    } catch (err) {
      if (requestId !== playHistoryRequestId) return;
      playHistoryShowMessage(err.message || "Could not load your play history.");
    } finally {
      clearTimeout(slowHint);
    }
  }

  function renderPlayHistoryChips(timeline) {
    if (!playHistoryChips) return;
    const chip = (label, value, tone) => {
      const tones = {
        emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
        slate: "bg-slate-50 text-slate-700 border-slate-200",
        amber: "bg-amber-50 text-amber-800 border-amber-200",
      };
      return `<span class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${tones[tone || "slate"]}">
        <span class="opacity-70 font-semibold">${label}</span><span>${value}</span></span>`;
    };

    const parts = [];
    if (timeline.eligibleCount) {
      parts.push(chip("played", `${timeline.distinctPlayedGames}/${timeline.eligibleCount} (${timeline.playedPercentage}%)`, "emerald"));
    }
    if (timeline.totalPlays) {
      parts.push(chip("plays logged", timeline.totalPlays.toLocaleString()));
    }
    if (timeline.firstPlayDate) {
      parts.push(chip("first play", formatMonthDay(timeline.firstPlayDate), "amber"));
    }
    if (timeline.years) {
      parts.push(chip("history", `${timeline.years} yrs`));
    }
    playHistoryChips.innerHTML = parts.join("");

    if (playHistoryBasis) {
      playHistoryBasis.textContent = timeline.eligibleCount
        ? `${timeline.eligibleCount} games`
        : "—";
    }
  }

  // Hand-rolled responsive SVG chart (no charting dependency)
  function renderPlayHistoryChart(timeline) {
    if (!playHistoryChart) return;
    const points = timeline.points || [];
    const n = points.length;
    if (n === 0) return;

    const W = 820;
    const H = 280;
    const padL = 46;
    const padR = 18;
    const padT = 16;
    const padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const xAt = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
    const yAt = (pct) => padT + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH;

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.percentage).toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L${xAt(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

    // Y gridlines at 0/25/50/75/100%
    const gridLines = [0, 25, 50, 75, 100]
      .map((pct) => {
        const y = yAt(pct).toFixed(1);
        return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e2e8f0" stroke-width="1" ${pct === 0 ? "" : 'stroke-dasharray="3 4"'} />
        <text x="${padL - 8}" y="${y}" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="end" dominant-baseline="middle">${pct}%</text>`;
      })
      .join("");

    // X labels: first point of each year, thinned out so they never collide
    const yearTicks = [];
    let lastLabelX = -Infinity;
    points.forEach((p, i) => {
      const year = p.date.slice(0, 4);
      const isYearStart = p.date.slice(5, 7) === "01" || i === 0;
      if (!isYearStart) return;
      if (yearTicks.some((t) => t.year === year)) return;
      const x = xAt(i);
      if (x - lastLabelX < 58) return;
      lastLabelX = x;
      yearTicks.push({ year, x });
    });
    const xLabels = yearTicks
      .map(({ year, x }) => `<text x="${x.toFixed(1)}" y="${H - 10}" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">${year}</text>`)
      .join("");

    const finalPct = points[n - 1].percentage;
    const finalY = yAt(finalPct).toFixed(1);

    playHistoryChart.innerHTML = `
      <defs>
        <linearGradient id="phFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.38" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.03" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#phFill)" />
      <path d="${linePath}" fill="none" stroke="#059669" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <line x1="${padL}" y1="${finalY}" x2="${W - padR}" y2="${finalY}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.85" />
      <circle cx="${xAt(n - 1).toFixed(1)}" cy="${finalY}" r="4.5" fill="#059669" stroke="#ffffff" stroke-width="2" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#cbd5e1" stroke-width="1" />
      ${xLabels}
      <line id="phCrosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="#059669" stroke-width="1" stroke-dasharray="3 3" opacity="0" />
      <circle id="phMarker" cx="0" cy="0" r="4" fill="#059669" stroke="#ffffff" stroke-width="2" opacity="0" />
      <rect id="phHitArea" x="${padL - 10}" y="${padT}" width="${plotW + 20}" height="${plotH}" fill="transparent" style="cursor:crosshair" />
    `;

    if (playHistoryLoading) playHistoryLoading.classList.add("hidden");
    if (playHistoryMessage) playHistoryMessage.classList.add("hidden");
    playHistoryChart.classList.remove("hidden");

    // Hover crosshair + tooltip
    const hitArea = playHistoryChart.querySelector("#phHitArea");
    const crosshair = playHistoryChart.querySelector("#phCrosshair");
    const marker = playHistoryChart.querySelector("#phMarker");

    const hideHover = () => {
      crosshair.setAttribute("opacity", "0");
      marker.setAttribute("opacity", "0");
      if (playHistoryTooltip) playHistoryTooltip.classList.add("hidden");
    };

    hitArea.addEventListener("mousemove", (event) => {
      const rect = playHistoryChart.getBoundingClientRect();
      if (!rect.width) return;
      const svgX = ((event.clientX - rect.left) / rect.width) * W;
      const ratio = n === 1 ? 0 : (svgX - padL) / plotW;
      const index = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
      const point = points[index];
      const px = xAt(index);
      const py = yAt(point.percentage);

      crosshair.setAttribute("x1", px.toFixed(1));
      crosshair.setAttribute("x2", px.toFixed(1));
      crosshair.setAttribute("opacity", "0.55");
      marker.setAttribute("cx", px.toFixed(1));
      marker.setAttribute("cy", py.toFixed(1));
      marker.setAttribute("opacity", "1");

      if (playHistoryTooltip) {
        playHistoryTooltip.innerHTML = `${formatMonthDay(point.date)} — <span class="text-emerald-300">${point.playedCount}</span> of ${timeline.eligibleCount} played (${point.percentage.toFixed(1)}%)`;
        playHistoryTooltip.style.left = `${((px / W) * 100).toFixed(2)}%`;
        playHistoryTooltip.style.top = `${((py / H) * 100).toFixed(2)}%`;
        playHistoryTooltip.classList.remove("hidden");
        playHistoryTooltip.classList.add("-mt-2");
      }
    });
    hitArea.addEventListener("mouseleave", hideHover);
  }

  // Fetch collection from server API (supports SSE stream with automatic fetch fallback)
  async function loadCollection(options = {}) {
    const { forceRefresh = false } = options;
    const username = usernameInput.value.trim();

    // Remembered for the background play-history request kicked off on success
    pendingForceRefresh = forceRefresh;

    if (!username) {
      usernameInput.focus();
      if (welcomeCard) welcomeCard.classList.remove("hidden");
      resultsCard.classList.add("hidden");
      statsCard.classList.add("hidden");
      if (playedStatsCard) playedStatsCard.classList.add("hidden");
      resetPlayHistoryUI();
      return;
    }

    if (welcomeCard) welcomeCard.classList.add("hidden");
    const includeExpansions = includeExpansionsInput.checked;
    const includeExclusions = includeExclusionsInput ? includeExclusionsInput.checked : false;

    // If data is already loaded for this user, expansion & exclusion setting, filter client-side instantly!
    if (
      !forceRefresh &&
      rawCollectionData &&
      loadedUsername === username &&
      loadedIncludeExpansions === includeExpansions &&
      loadedIncludeExclusions === includeExclusions
    ) {
      applyClientFilters();
      return;
    }

    // Close any previous SSE stream
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    // 1. Immediately remove current collection listing and error box at start of new fetch
    if (errorBox) errorBox.classList.add("hidden");
    resultsCard.classList.add("hidden");
    statsCard.classList.add("hidden");
    if (playedStatsCard) playedStatsCard.classList.add("hidden");
    resetPlayHistoryUI();
    tableBody.innerHTML = "";
    compactListText.value = "";
    jsonText.textContent = "";

    // 2. Show Progress Box & reset progress bar
    progressBox.classList.remove("hidden");
    updateProgressUI(0, "Step 1/3", `Connecting to BGG for user "${username}"...`);

    // Reset live activity log & step cards
    if (progressLogConsole) progressLogConsole.innerHTML = "";
    clientActivityLogs = [];
    appendActivityLog(1, `Connecting to BoardGameGeek XMLAPI2 for user "${username}"...`);

    if (step1StatusBadge) {
      step1StatusBadge.textContent = "In Progress...";
      step1StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse";
    }
    if (step1DetailText) step1DetailText.textContent = "Queries BGG user XMLAPI2 and polls queue.";
    if (step2StatusBadge) {
      step2StatusBadge.textContent = "Pending";
      step2StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600";
    }
    if (step2DetailText) step2DetailText.textContent = "Fetches Best At polls & true game types.";
    if (step3StatusBadge) {
      step3StatusBadge.textContent = "Pending";
      step3StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600";
    }
    if (step3DetailText) step3DetailText.textContent = "Applies exclusions & calculates Gold metric.";

    fetchIcon.classList.add("animate-spin");
    if (refreshIcon) refreshIcon.classList.add("animate-spin");
    fetchBtn.disabled = true;
    if (refreshBtn) refreshBtn.disabled = true;

    const params = new URLSearchParams({
      username,
      includeExpansions: includeExpansions ? "true" : "false",
      includeExclusions: includeExclusions ? "true" : "false",
    });

    let sseReceivedAnyData = false;

    // Helper to process completed data
    const handleSuccessData = (payloadData) => {
      rawCollectionData = payloadData;
      loadedUsername = username;
      loadedIncludeExpansions = includeExpansions;
      loadedIncludeExclusions = includeExclusions;

      // Manage User Exclusions visibility and manage button
      const userExclList = Array.isArray(rawCollectionData.userExclusions)
        ? rawCollectionData.userExclusions
        : [];
      const hasUserExclusions = userExclList.length > 0;

      if (exclusionsOptionWrapper) {
        exclusionsOptionWrapper.classList.remove("hidden");
      }

      if (includeExclusionsLabel) {
        if (hasUserExclusions) {
          includeExclusionsLabel.classList.remove("hidden");
          if (exclusionsCountBadge) {
            exclusionsCountBadge.textContent = `${userExclList.length} excluded`;
          }
        } else {
          includeExclusionsLabel.classList.add("hidden");
          if (includeExclusionsInput) includeExclusionsInput.checked = false;
        }
      }

      if (manageExclusionsBtnText) {
        manageExclusionsBtnText.textContent = hasUserExclusions
          ? `Manage (${userExclList.length})`
          : `+ Add Exclusions`;
      }

      // Update step status cards and activity log if provided
      if (Array.isArray(payloadData.activityLog) && payloadData.activityLog.length > 0) {
        if (progressLogConsole) progressLogConsole.innerHTML = "";
        payloadData.activityLog.forEach((log) => {
          appendActivityLog(log.step, log.message);
        });
      }

      if (step1StatusBadge) {
        step1StatusBadge.textContent = "✔ Done";
        step1StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
      if (step1DetailText) {
        step1DetailText.textContent = `Downloaded ${payloadData.totalItems || 0} collection items from BGG.`;
      }
      if (step2StatusBadge) {
        step2StatusBadge.textContent = "✔ Done";
        step2StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
      if (step2DetailText) {
        step2DetailText.textContent = `Enriched ${payloadData.totalItems || 0} games with Best At polls & types.`;
      }
      if (step3StatusBadge) {
        step3StatusBadge.textContent = "✔ Done";
        step3StatusBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
      }
      if (step3DetailText) {
        step3DetailText.textContent = `${payloadData.totalEligibleCount || 0} base owned games ready.`;
      }

      // Finish Progress UI
      updateProgressUI(100, "Done!", "Collection loaded successfully!");

      setTimeout(() => {
        progressBox.classList.add("hidden");
        applyClientFilters();
      }, 400);

      // The play-history chart is fetched lazily when the Played Games card is
      // expanded, so only refresh it here if it is currently open.
      playHistoryLoaded = false;
      if (playHistoryExpanded) {
        loadPlayHistory({ forceRefresh: pendingForceRefresh });
      }

      fetchIcon.classList.remove("animate-spin");
      if (refreshIcon) refreshIcon.classList.remove("animate-spin");
      fetchBtn.disabled = false;
      if (refreshBtn) refreshBtn.disabled = false;
    };

    // Attempt 1: Connect via Server-Sent Events (SSE) stream
    try {
      eventSource = new EventSource(`/api/collection/stream?${params.toString()}`, {
        withCredentials: true,
      });

      eventSource.addEventListener("progress", (e) => {
        sseReceivedAnyData = true;
        try {
          const payload = JSON.parse(e.data);
          const pct = payload.percentage || 10;
          let stepName = "Step 1/3";

          if (payload.step === "collection" || payload.step === "queue") {
            stepName = "Step 1/3";
            appendActivityLog(1, payload.message);
          } else if (payload.step === "things_start" || payload.step === "things" || payload.step === "ratelimit") {
            stepName = "Step 2/3";
            appendActivityLog(2, payload.message);
          } else if (payload.step === "filtering" || payload.step === "formatting") {
            stepName = "Step 3/3";
            appendActivityLog(3, payload.message);
          }

          updateProgressUI(pct, stepName, payload.message);
        } catch (err) {
          console.error("Progress parse error:", err);
        }
      });

      eventSource.addEventListener("complete", (e) => {
        sseReceivedAnyData = true;
        try {
          const payload = JSON.parse(e.data);
          eventSource.close();
          eventSource = null;

          if (!payload.success || !payload.data) {
            throw new Error(payload.error || "Failed to load collection");
          }

          handleSuccessData(payload.data);
        } catch (err) {
          handleFetchError(err.message);
        }
      });

      eventSource.addEventListener("error", async (e) => {
        // If SSE failed immediately (e.g. streaming buffered or unsupported on CDN), fallback to standard JSON fetch!
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        if (!sseReceivedAnyData) {
          updateProgressUI(40, "Step 2/3", `Fetching collection data via standard API...`);
          try {
            const fallbackRes = await fetch(`/api/collection?${params.toString()}`, {
              credentials: "include",
            });
            const text = await fallbackRes.text();
            let json;
            try {
              json = JSON.parse(text);
            } catch (jsonErr) {
              throw new Error(`Server returned HTTP ${fallbackRes.status} (${fallbackRes.statusText}): ${text.slice(0, 300)}`);
            }

            if (!json.success || !json.data) {
              throw new Error(json.error || "Failed to fetch collection from BGG");
            }

            handleSuccessData(json.data);
            return;
          } catch (fallbackErr) {
            handleFetchError(fallbackErr.message, { details: { message: fallbackErr.message, stack: fallbackErr.stack } });
            return;
          }
        }

        let errMsg = "Connection to server failed or timed out.";
        let errPayload = null;
        try {
          if (e.data) {
            errPayload = JSON.parse(e.data);
            errMsg = errPayload.error || errMsg;
          }
        } catch (ex) {}

        handleFetchError(errMsg, errPayload);
      });
    } catch (err) {
      handleFetchError(err.message);
    }
  }

  function handleFetchError(msg, payload = null) {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    progressBox.classList.add("hidden");
    fetchIcon.classList.remove("animate-spin");
    if (refreshIcon) refreshIcon.classList.remove("animate-spin");
    fetchBtn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;

    // Show Red Error Status Box with full details
    if (errorBox) {
      errorMessage.textContent = msg;

      let detailString = "";
      if (payload && payload.details) {
        detailString = JSON.stringify(payload.details, null, 2);
      } else if (payload) {
        detailString = JSON.stringify(payload, null, 2);
      } else {
        detailString = `Timestamp: ${new Date().toISOString()}\nError Message: ${msg}\nTarget: BoardGameGeek XML API2`;
      }

      if (errorDetailsText) {
        errorDetailsText.textContent = detailString;
      }
      if (errorDetailsWrapper) {
        errorDetailsWrapper.classList.remove("hidden");
      }

      errorBox.classList.remove("hidden");
    }
  }

  function renderTable() {
    if (!filteredItems) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No collection data loaded.</td></tr>`;
      return;
    }

    resultsSummary.textContent = `Showing ${filteredItems.length} matching items (Total in collection: ${rawCollectionData?.totalItems || 0})`;

    if (filteredItems.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No games found matching current filters.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filteredItems
      .map((item, idx) => {
        const bggUrl = `https://boardgamegeek.com/boardgame/${item.id}`;

        const img = item.thumbnail
          ? `<a href="${bggUrl}" target="_blank" rel="noopener noreferrer" title="View ${item.name} on BoardGameGeek" class="block w-10 h-10 transition transform hover:scale-110">
               <img src="${item.thumbnail}" alt="${item.name}" class="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-xs">
             </a>`
          : `<a href="${bggUrl}" target="_blank" rel="noopener noreferrer" title="View ${item.name} on BoardGameGeek" class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-500 transition">
               <i class="fa-solid fa-dice-d6"></i>
             </a>`;

        const titleHtml = `
          <a href="${bggUrl}" target="_blank" rel="noopener noreferrer" title="Open ${item.name} on BoardGameGeek (opens in new tab)" class="hover:text-amber-600 hover:underline font-bold text-slate-900 inline-flex items-center gap-1.5 transition">
            <span>${item.name}</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400 hover:text-amber-500"></i>
          </a>
        `;

        const bestAtBadge = item.bestAt
          ? item.isCommunityBest !== false
            ? `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200" title="Community Best Player Count"><i class="fa-solid fa-users text-cyan-600 text-[10px] mr-1"></i>${item.bestAt}</span>`
            : `<span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200" title="Publisher Player Count (No community consensus)"><i class="fa-solid fa-building text-slate-400 text-[10px] mr-1"></i>${item.bestAt} <span class="text-[9px] text-slate-400 font-normal">(pub)</span></span>`
          : `<span class="text-slate-400">—</span>`;

        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-3.5 px-4 text-center text-xs text-slate-400 font-mono font-bold">${idx + 1}</td>
            <td class="py-3.5 px-4">${img}</td>
            <td class="py-3.5 px-4">${titleHtml}</td>
            <td class="py-3.5 px-4">${bestAtBadge}</td>
            <td class="py-3.5 px-4 text-center">${formatRatingBadge(item.averageRating)}</td>
            <td class="py-3.5 px-4 text-center font-mono font-bold text-slate-700">${item.numPlays || 0}</td>
          </tr>
        `;
      })
      .join("");
  }

  // Apply initial seasonal theme
  applySeasonTheme(currentSeason);

  // If username is already filled, load; otherwise show welcome card and wait for user input
  if (usernameInput.value.trim()) {
    loadCollection();
  } else {
    if (welcomeCard) welcomeCard.classList.remove("hidden");
    resultsCard.classList.add("hidden");
    statsCard.classList.add("hidden");
    if (playedStatsCard) playedStatsCard.classList.add("hidden");
    resetPlayHistoryUI();
  }
});
