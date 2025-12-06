// =============== Chart Setup =================
const chartContainer = document.getElementById("chart-container");
const titleEl = document.getElementById("chart-title");
const descEl = document.getElementById("chart-desc");

const explanations = {
  gold: {
    title: "Figure — 10-Minute Gold Difference vs Win Rate",
    desc: `The gold difference between teams at the 10-minute mark is a powerful predictor of victory.
           Once a team is ahead by more than +1k gold, its chance of winning rises sharply,
           indicating how decisive early tempo advantages are in professional play.`
  },

  dragon: {
    title: "Figure — Dragon Control vs Win Rate",
    desc: `Dragon control plays a critical role in shaping mid-to-late-game outcomes.
           Each dragon secured provides stacking buffs that strengthen a team's skirmishing and objective power,
           leading to a steadily increasing likelihood of winning the match.`
  },

  baron: {
    title: "Figure — Baron Control vs Win Rate",
    desc: `Securing Baron Nashor is one of the most decisive turning points in professional play.
           The Baron buff dramatically enhances siege potential and map control,
           often enabling teams to convert their advantage into a game-winning push.`
  },

  towers: {
    title: "Figure — Tower Control vs Win Rate",
    desc: `Towers are permanent map objectives that open pathways and increase map pressure.
          Teams that secure more towers consistently gain greater control of rotations,
          enabling safer vision, deeper jungle access, and a higher chance of winning.`
  },

  kills: {
    title: "Figure — Early Kill Difference vs Win Rate",
    desc: `Early kill leads often translate into more gold, lane pressure, and objective control.
          Teams with higher kill advantage at 10 minutes tend to snowball their tempo advantages
          into higher mid-game win rates.`
  },

  vision: {
    title: "Figure — Vision Score vs Win Rate",
    desc: `Vision Score reflects a team’s control over fog of war. Higher vision enables safer
          objective setups, ambush prevention, and better macro decisions—strongly contributing
          to higher win rates in coordinated play.`
  }

};


// =============== SVG setup =================
const margin = { top: 30, right: 20, bottom: 60, left: 60 };
const width = 760;
const height = 360;

const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const chartG = svg
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// tooltip
const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const x = d3.scaleBand().range([0, chartWidth]).padding(0.2);
const y = d3.scaleLinear().domain([0, 1]).range([chartHeight, 0]);

const xAxisG = chartG
  .append("g")
  .attr("class", "axis axis-x")
  .attr("transform", `translate(0,${chartHeight})`);

const yAxisG = chartG.append("g").attr("class", "axis axis-y");

svg
  .append("text")
  .attr("x", margin.left - 40)
  .attr("y", margin.top - 10)
  .attr("fill", "#e5e7eb")
  .attr("text-anchor", "start")
  .style("font-size", "11px")
  .text("Win Rate");

const baselineLine = chartG
  .append("line")
  .attr("class", "baseline")
  .attr("stroke", "#6b7280")
  .attr("stroke-dasharray", "4 3");

const baselineLabel = chartG
  .append("text")
  .attr("class", "baseline-label")
  .attr("text-anchor", "end")
  .attr("fill", "#9ca3af")
  .style("font-size", "11px");

let globalData = [];

// =============== Win Probability Model (First 10 Minutes) =================
const B0 = -0.39750995;   // intercept
const B1 =  1.00495136;   // gold10k (golddiffat10 / 1000)
const B2 = -0.06700415;   // killsDiff10
const B3 =  0.79456393;   // firstDragon (1 if your team, else 0)

function logistic(z) {
  return 1 / (1 + Math.exp(-z));
}

// Predict win probability given inputs
function predictWinProb(inputs) {
  const gold10k = inputs.gold10 / 1000.0;
  const killsDiff10 = inputs.killsDiff10;
  const firstDragon = inputs.firstDragon;

  const z =
    B0 +
    B1 * gold10k +
    B2 * killsDiff10 +
    B3 * firstDragon;

  return logistic(z);
}

// Load data
d3.csv("lol_team_clean.csv", d3.autoType).then((data) => {
  globalData = data;

  console.log("Columns:", data.columns);
  console.log("Sample row:", data[0]);

  yAxisG.call(
    d3.axisLeft(y)
      .ticks(5)
      .tickFormat((d) => d3.format(".0%")(d))
  );
});

// gold bins
const goldBins = [
  { label: "< -3000", min: -9999, max: -3000 },
  { label: "-3000 ~ -2000", min: -3000, max: -2000 },
  { label: "-2000 ~ -1000", min: -2000, max: -1000 },
  { label: "-1000 ~ 0", min: -1000, max: 0 },
  { label: "0 ~ 1000", min: 0, max: 1000 },
  { label: "1000 ~ 2000", min: 1000, max: 2000 },
  { label: "2000 ~ 3000", min: 2000, max: 3000 },
  { label: "> 3000", min: 3000, max: 9999 }
];

// compute stats
function computeGoldStats(data) {
  return goldBins.map((bin) => {
    const subset = data.filter(
      (d) => d.golddiffat10 >= bin.min && d.golddiffat10 < bin.max
    );
    const winrate = d3.mean(subset, (d) => d.win);
    return {
      label: bin.label,
      winrate: winrate ?? 0,
      count: subset.length
    };
  });
}

// dragon stats
function computeDragonStats(data) {
  const filtered = data.filter((d) => d.dragons != null);
  const rolled = d3.rollup(
    filtered,
    (v) => ({
      winrate: d3.mean(v, (d) => d.win),
      count: v.length
    }),
    (d) => Number(d.dragons)
  );

  return Array.from(rolled, ([dragons, obj]) => ({
    label: dragons.toString(),
    winrate: obj.winrate ?? 0,
    count: obj.count
  })).sort((a, b) => +a.label - +b.label);
}

// ======== TOWER STATS ========
function computeTowerStats(data) {
  const rolled = d3.rollup(
    data,
    v => ({
      winrate: d3.mean(v, d => d.win),
      count: v.length
    }),
    d => d.towers  // team towers taken
  );

  return Array.from(rolled, ([towers, obj]) => ({
    label: towers.toString(),
    winrate: obj.winrate ?? 0,
    count: obj.count
  })).sort((a, b) => +a.label - +b.label);
}


// ======== KILL DIFFERENCE STATS ========
function computeKillStats(data) {
  const rolled = d3.rollup(
    data,
    v => ({
      winrate: d3.mean(v, d => d.win),
      count: v.length
    }),
    d => d.kills_diff_10   // kill diff at 10 minutes
  );

  return Array.from(rolled, ([killDiff, obj]) => ({
    label: killDiff.toString(),
    winrate: obj.winrate ?? 0,
    count: obj.count
  })).sort((a, b) => +a.label - +b.label);
}


// ======== VISION SCORE STATS ========
function computeVisionStats(data) {
  const rolled = d3.rollup(
    data,
    v => ({
      winrate: d3.mean(v, d => d.win),
      count: v.length
    }),
    d => Math.round(d.visionscore / 50) * 50   // group by 50 for readability
  );

  return Array.from(rolled, ([vs, obj]) => ({
    label: vs.toString(),
    winrate: obj.winrate ?? 0,
    count: obj.count
  })).sort((a, b) => +a.label - +b.label);
}


// baron stats
function computeBaronStats(data) {
  const rolled = d3.rollup(
    data,
    (v) => ({
      winrate: d3.mean(v, (d) => d.win),
      count: v.length
    }),
    (d) => d.barons
  );

  return Array.from(rolled, ([barons, obj]) => ({
    label: barons.toString(),
    winrate: obj.winrate ?? 0,
    count: obj.count
  })).sort((a, b) => +a.label - +b.label);
}

// draw bar chart
function drawBarChart(stats, metric) {
  x.domain(stats.map((d) => d.label));

  const xAxis = d3.axisBottom(x);
  xAxisG.call(xAxis);

  xAxisG
    .selectAll("text")
    .attr("transform", metric === "gold" ? "rotate(25)" : null)
    .style("text-anchor", metric === "gold" ? "start" : "middle");

  const overallWin = d3.mean(globalData, (d) => d.win);

  baselineLine
    .attr("x1", 0)
    .attr("x2", chartWidth)
    .attr("y1", y(overallWin))
    .attr("y2", y(overallWin));

  baselineLabel
    .attr("x", chartWidth - 4)
    .attr("y", y(overallWin) - 6)
    .text(`Overall ≈ ${d3.format(".0%")(overallWin)}`);

  const bars = chartG.selectAll("rect.bar").data(stats, (d) => d.label);

  bars
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("class", "bar")
          .attr("x", (d) => x(d.label))
          .attr("width", x.bandwidth())
          .attr("y", y(0))
          .attr("height", 0)
          .attr("fill", "#3b82f6")
          .call((enter) =>
            enter
              .transition()
              .duration(500)
              .attr("y", (d) => y(d.winrate))
              .attr("height", (d) => chartHeight - y(d.winrate))
          ),
      (update) =>
        update.call((update) =>
          update
            .transition()
            .duration(500)
            .attr("x", (d) => x(d.label))
            .attr("width", x.bandwidth())
            .attr("y", (d) => y(d.winrate))
            .attr("height", (d) => chartHeight - y(d.winrate))
        ),
      (exit) =>
        exit.call((exit) =>
          exit.transition().duration(300).attr("height", 0).attr("y", y(0)).remove()
        )
    )
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#f97316");

      let metricLabel = "";
      if (metric === "gold") {
        metricLabel = d.label;
      } else if (metric === "dragon") {
        metricLabel = `${d.label} dragons`;
      } else if (metric === "baron") {
        metricLabel = `${d.label} barons`;
      }

      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${metricLabel}</strong><br/>
           Win rate: ${d3.format(".1%")(d.winrate)}<br/>
           Games: ${d.count}`
        )
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "#3b82f6");
      tooltip.style("opacity", 0);
    });
}


// update metric
function updateMetric(metric) {
  if (!globalData.length) return;
  chartContainer.style.display = "block";

  document.querySelectorAll(".map-icon").forEach((b) => {
    b.classList.toggle("active", b.dataset.metric === metric);
  });

  if (explanations[metric]) {
    titleEl.textContent = explanations[metric].title;
    descEl.textContent = explanations[metric].desc;
  }

  let stats;
  if (metric === "gold") {
    stats = computeGoldStats(globalData);
  }
  else if (metric === "dragon") {
    stats = computeDragonStats(globalData);
  }
  else if (metric === "baron") {
    stats = computeBaronStats(globalData);
  }
  else if (metric === "towers") {
    stats = computeTowerStats(globalData);
  }
  else if (metric === "kills") {
    stats = computeKillStats(globalData);
  }
  else if (metric === "vision") {
    stats = computeVisionStats(globalData);
  }
  else {
    console.warn(`Unknown metric: ${metric}`);
    return;
  }

  drawBarChart(stats, metric);
}

// Event listeners for map buttons
document.querySelectorAll(".map-icon").forEach((btn) => {
  btn.addEventListener("click", () => {
    updateMetric(btn.dataset.metric);
  });
});


// =============== Win Probability Simulator Wiring =================
const goldSlider = document.getElementById("sim-gold");
const goldValueSpan = document.getElementById("sim-gold-value");

const killsSlider = document.getElementById("sim-kills");
const killsValueSpan = document.getElementById("sim-kills-value");

const probEl = document.getElementById("sim-prob");
const captionEl = document.getElementById("sim-caption");

function getFirstDragonValue() {
  const checked = document.querySelector('input[name="sim-firstdragon"]:checked');
  return checked ? Number(checked.value) : 0;
}

function updateSim() {
  // sanity check
  if (!goldSlider || !killsSlider || !probEl) {
    return;
  }

  const gold10 = Number(goldSlider.value);
  const killsDiff10 = Number(killsSlider.value);
  const firstDragon = getFirstDragonValue();

  // update display
  goldValueSpan.textContent = gold10;
  killsValueSpan.textContent = killsDiff10;

  const p = predictWinProb({ gold10, killsDiff10, firstDragon });
  const pct = Math.round(p * 100);
  probEl.textContent = pct + "%";

  // caption
  let text;
  if (pct < 40) {
    text =
      "Your team is statistically behind based on the first 10 minutes, but comebacks are still possible.";
  } else if (pct <= 60) {
    text =
      "The game is relatively even at 10 minutes. Small decisions and teamfights can swing the outcome.";
  } else {
    text =
      "Your team has a strong early lead. Historically, teams in this position convert their advantage into a win.";
  }
  captionEl.textContent = text;
}

// event listeners
if (goldSlider && killsSlider) {
  goldSlider.addEventListener("input", updateSim);
  killsSlider.addEventListener("input", updateSim);

  document
    .querySelectorAll('input[name="sim-firstdragon"]')
    .forEach((radio) => {
      radio.addEventListener("change", updateSim);
    });

  updateSim();
}
