document.addEventListener("DOMContentLoaded", () => {
  let collectionData = null;
  let activeMode = "";
  let activeTab = "table";
  let eventSource = null;

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
  let currentWheelItems = [];

  const usernameInput = document.getElementById("usernameInput");
  const searchInput = document.getElementById("searchInput");
  const minRatingInput = document.getElementById("minRatingInput");
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
        pill.classList.add("active-pc", "border-amber-500/50", "bg-amber-500/10", "text-amber-300", "shadow");
        pill.classList.remove("border-slate-700", "bg-slate-900", "text-slate-400");
      } else {
        pill.classList.remove("active-pc", "border-amber-500/50", "bg-amber-500/10", "text-amber-300", "shadow");
        pill.classList.add("border-slate-700", "bg-slate-900", "text-slate-400");
      }
    });
  }

  // Bind Player Count Pill Clicks (Multiselect on Change)
  pcPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("active-pc");
      if (pill.classList.contains("active-pc")) {
        pill.classList.add("border-amber-500/50", "bg-amber-500/10", "text-amber-300", "shadow");
        pill.classList.remove("border-slate-700", "bg-slate-900", "text-slate-400");
      } else {
        pill.classList.remove("border-amber-500/50", "bg-amber-500/10", "text-amber-300", "shadow");
        pill.classList.add("border-slate-700", "bg-slate-900", "text-slate-400");
      }

      // Trigger automatic re-query on change
      loadCollection();
    });
  });

  // Detect season based on current month (Northern Hemisphere)
  function detectCurrentSeason() {
    const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
    if (month === 11 || month === 0 || month === 1) return "winter";
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    return "autumn";
  }

  // Apply Season Theme to HTML Body and Badges
  function applySeasonTheme(season) {
    currentSeason = season;
    document.documentElement.setAttribute("data-season", season);

    const info = seasonBadges[season] || seasonBadges.summer;
    if (seasonIcon) seasonIcon.textContent = info.icon;
    if (seasonLabel) seasonLabel.textContent = info.label;

    seasonSelectBtns.forEach((btn) => {
      if (btn.dataset.seasonSelect === season) {
        btn.classList.add("bg-slate-800", "shadow");
      } else {
        btn.classList.remove("bg-slate-800", "shadow");
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

      // Sync player count pills to preset mode
      if (activeMode === "2p") {
        setSelectedPlayerCounts(["2p"]);
      } else if (activeMode === "gold" || activeMode === "shit") {
        setSelectedPlayerCounts(["3p", "4p", "5p", "6+p"]);
      }

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

  // Spin Modal Triggers
  openSpinModalBtn.addEventListener("click", () => {
    const items = getCurrentlyFilteredItems();
    if (!items || items.length === 0) {
      alert("No games available to spin! Please fetch a collection first.");
      return;
    }
    currentWheelItems = items;
    wheelSubheading.textContent = `Spinning among ${items.length} selected games`;
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

  function getCurrentlyFilteredItems() {
    if (!collectionData || !collectionData.items) return [];
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return collectionData.items;
    return collectionData.items.filter((i) =>
      i.name.toLowerCase().includes(query)
    );
  }

  // Draw Graphical Wheel on HTML5 Canvas using Seasonal Palette
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
      ctx.strokeStyle = "#334155";
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

    winnerTitle.textContent = winner.name;
    winnerBestAt.textContent = winner.bestAt ? `Best At: ${winner.bestAt}` : "Player Count: N/A";
    winnerRating.textContent = winner.averageRating
      ? `Avg: ${winner.averageRating.toFixed(1)}`
      : "Avg: N/A";

    if (winner.thumbnail) {
      winnerImgContainer.innerHTML = `<img src="${winner.thumbnail}" alt="${winner.name}" class="w-full h-full object-cover">`;
    } else {
      winnerImgContainer.innerHTML = `<i class="fa-solid fa-trophy text-amber-400 text-2xl"></i>`;
    }

    winnerCard.classList.remove("hidden");
  }

  // Fetch collection from server API using SSE Stream
  function loadCollection() {
    const username = usernameInput.value.trim() || "bwobbones";

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

    const selectedPlayerCounts = getSelectedPlayerCounts();

    const params = new URLSearchParams({
      username,
      includeExpansions: includeExpansionsInput.checked ? "true" : "false",
    });

    if (activeMode) params.append("mode", activeMode);
    if (minRatingInput.value) params.append("minRating", minRatingInput.value);
    if (selectedPlayerCounts.length > 0) {
      params.append("playerCounts", selectedPlayerCounts.join(","));
    }

    eventSource = new EventSource(`/api/collection/stream?${params.toString()}`);

    eventSource.addEventListener("progress", (e) => {
      try {
        const payload = JSON.parse(e.data);
        const pct = payload.percentage || 10;
        let stepName = "Step 1/3";

        if (payload.step === "collection" || payload.step === "queue") {
          stepName = "Step 1/3";
        } else if (payload.step === "things_start" || payload.step === "things" || payload.step === "ratelimit") {
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

          // Render Gold Stats Card ONLY when in 'allgold' or 'gold' preset mode
          if (activeMode === "allgold" || activeMode === "gold") {
            statsCard.classList.remove("hidden");
            statsDetail.textContent = `${collectionData.goldCount} / ${collectionData.totalEligibleCount} Gold Games`;
            statsPctBadge.textContent = `${collectionData.goldPercentage}%`;
          } else {
            statsCard.classList.add("hidden");
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

  // Apply initial seasonal theme
  applySeasonTheme(currentSeason);

  // Load initial collection on page load
  loadCollection();
});
