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

  // Draw Graphical Wheel on HTML5 Canvas
  function drawWheel() {
    if (!ctx || currentWheelItems.length === 0) return;

    const palette = seasonalWheelPalettes[currentSeason] || seasonalWheelPalettes.summer;
    const numSlices = currentWheelItems.length;
    const arc = (2 * Math.PI) / numSlices;
    const centerX = wheelCanvas.width / 2;
    const centerY = wheelCanvas.height / 2;
    const outerRadius = centerX - 8;
    const innerRadius = 32;

    ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

    for (let i = 0; i < numSlices; i++) {
      const angle = currentAngle + i * arc;

      // Fill Seasonal Slice
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, angle, angle + arc);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Render Centered Title Text along Slice Angle
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0f172a";
      ctx.font =
        numSlices > 50
          ? "bold 8px sans-serif"
          : numSlices > 25
          ? "bold 10px sans-serif"
          : "bold 12px sans-serif";

      let title = currentWheelItems[i].name;
      const maxTextLen = numSlices > 40 ? 10 : numSlices > 20 ? 14 : 20;
      if (title.length > maxTextLen) {
        title = title.substring(0, maxTextLen - 2) + "..";
      }

      const midRadius = (innerRadius + outerRadius) / 2 + 10;
      ctx.fillText(title, midRadius, 0);
      ctx.restore();
    }

    // Center Hub Circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Dice Text / Icon
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎲", centerX, centerY);
  }

  // Spin Wheel Physics Animation
  function spinWheel() {
    isSpinning = true;
    doSpinBtn.disabled = true;
    doSpinBtn.classList.add("opacity-50", "cursor-not-allowed");
    winnerCard.classList.add("hidden");

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

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

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

    // Update Results Heading
    const modeLabel = activeMode ? ` [preset: ${activeMode}]` : "";
    const unplayedLabel = unplayedOnly ? " [unplayed only]" : "";
    resultsHeading.textContent = `Collection Results for ${rawCollectionData.username}${modeLabel}${unplayedLabel}`;

    renderTable();
    compactListText.value = generateCompactListClient(filteredItems);
    jsonText.textContent = JSON.stringify(filteredItems, null, 2);

    resultsCard.classList.remove("hidden");
  }

  // Fetch collection from server API (supports SSE stream with automatic fetch fallback)
  async function loadCollection(options = {}) {
    const { forceRefresh = false } = options;
    const username = usernameInput.value.trim();

    if (!username) {
      usernameInput.focus();
      if (welcomeCard) welcomeCard.classList.remove("hidden");
      resultsCard.classList.add("hidden");
      statsCard.classList.add("hidden");
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
  }
});
