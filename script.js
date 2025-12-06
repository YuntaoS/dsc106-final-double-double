// script.js

// setup dimensions
const margin = { top: 30, right: 20, bottom: 60, left: 60 };
const width = 760;
const height = 360;

const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

//SVG & group
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

// Global data variable
let globalData = [];

// Load data and initialize chart
d3.csv("lol_team_clean.csv", d3.autoType).then((data) => {
  globalData = data;

  console.log("Columns:", data.columns);
  console.log("Sample row:", data[0]);

  yAxisG.call(
    d3.axisLeft(y)
      .ticks(5)
      .tickFormat((d) => d3.format(".0%")(d))
  );

  updateMetric("gold");
});

// compute gold stats
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

// compute gold stats
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

// compute dragon stats
function computeDragonStats(data) {
  const filtered = data.filter(d => d.dragons != null);
  const rolled = d3.rollup(
    filtered,
    v => ({
      winrate: d3.mean(v, d => d.win),
      count: v.length
    }),
    d => Number(d.dragons)
  );

  const stats = Array.from(rolled, ([dragons, obj]) => ({
    label: dragons.toString(),
    winrate: obj.winrate ?? 0,
    count: obj.count
  })).sort((a, b) => +a.label - +b.label);

  return stats;
}


// compute baron stats
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

  // Adjust x-axis label orientation based on metric
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

  // Data join for bars
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
  document.querySelectorAll(".map-icon").forEach((b) => {
    b.classList.toggle("active", b.dataset.metric === metric);
  });

  if (!globalData.length) return;

  let stats;
  if (metric === "gold") {
    stats = computeGoldStats(globalData);
  } else if (metric === "dragon") {
    stats = computeDragonStats(globalData);
  } else if (metric === "baron") {
    stats = computeBaronStats(globalData);
  } else {
    console.warn(`Unknown metric: ${metric}`);
    return;
  }

  drawBarChart(stats, metric);
}

// button event listeners
document.querySelectorAll(".map-icon").forEach((btn) => {
  btn.addEventListener("click", () => {
    updateMetric(btn.dataset.metric);
  });
});
