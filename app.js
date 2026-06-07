// Global State
let dashboardData = null;
let kbPortfolioData = null;
let currentGoalType = 'pension'; // 'pension', 'investment', 'hui'
let currentAssetFilter = 'all';

// Chart instances to allow updates/destroys
let portfolioChart = null;
let trendChart = null;
let goalChart = null;
let projectionChart = null;
let salaryChart = null;
let stockCategoryChart = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Initializing Lucide Icons
    lucide.createIcons();
    
    // Tab switching
    initTabs();
    
    // Load data
    fetchData();
});

// Tab Navigation Logic
function initTabs() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabContents = document.querySelectorAll(".tab-content");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            
            navItems.forEach(nav => nav.classList.remove("active"));
            tabContents.forEach(tab => tab.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(targetTab).classList.add("active");

            // Recalculate/resize charts when tabs change to avoid scaling issues
            resizeCharts();
        });
    });
}

// Fetch dashboard data from data.json
async function fetchData() {
    try {
        const response = await fetch("data/data.json");
        if (!response.ok) {
            throw new Error("데이터를 가져오는 데 실패했습니다.");
        }
        dashboardData = await response.json();
        
        // Try load detailed stock portfolio
        try {
            const kbRes = await fetch("data/kb_portfolio.json");
            if (kbRes.ok) {
                kbPortfolioData = await kbRes.json();
            }
        } catch (e) {
            console.error("Failed to load kb_portfolio.json", e);
        }
        
        // Initialize dashboard UI
        updateUI();
        initOverviewTab();
        initTrendTab();
        initGoalsTab();
        initProjectionTab();
        initStrategyTab();
        
        if (kbPortfolioData) {
            initStockPortfolioTab();
        }
        
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        alert("데이터 로드 중 오류가 발생했습니다. 로컬 서버 실행 중인지 혹은 데이터가 정제되었는지 확인해 주세요.");
    }
}

// Utility formatting functions
function formatKRW(val) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    
    // val is in 10,000 KRW
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    const billion = Math.floor(absVal / 10000);
    const remaining = Math.round(absVal % 10000);
    
    if (billion > 0) {
        return `${sign}${billion}억 ${remaining > 0 ? remaining.toLocaleString() : ''}만원`;
    }
    return `${sign}${remaining.toLocaleString()}만원`;
}

function formatShortKRW(val) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 10000) {
        return `${sign}${(absVal / 10000).toFixed(2)}억원`;
    }
    return `${sign}${Math.round(absVal).toLocaleString()}만원`;
}

// Update basic stats and dates in Header
function updateUI() {
    if (!dashboardData) return;
    
    // Latest Update Date
    const trends = dashboardData.historical_trend;
    if (trends && trends.length > 0) {
        const latestRecord = trends[trends.length - 1];
        document.getElementById("latest-update-date").innerText = latestRecord.date;
        document.getElementById("top-net-assets").innerText = formatKRW(latestRecord.net_assets);
    }
}

// Overview Tab Logic
function initOverviewTab() {
    const summary = dashboardData.current_assets.summary;
    const items = dashboardData.current_assets.items;
    
    // Map KPI elements
    const kpiValEstate = document.getElementById("kpi-val-estate");
    const kpiValFinancial = document.getElementById("kpi-val-financial");
    const kpiValPension = document.getElementById("kpi-val-pension");
    const kpiValHui = document.getElementById("kpi-val-hui");
    
    const kpiPctEstate = document.getElementById("kpi-pct-estate");
    const kpiPctFinancial = document.getElementById("kpi-pct-financial");
    const kpiPctPension = document.getElementById("kpi-pct-pension");
    const kpiPctHui = document.getElementById("kpi-pct-hui");
    
    // Calculate total for percentages
    let totalNet = 0;
    let estateVal = 0;
    let savingsVal = 0;
    let pensionVal = 0;
    let investVal = 0;
    let huiVal = 0;
    
    summary.forEach(cat => {
        const val = cat.value;
        const name = cat.category;
        if (name === "부동산") estateVal = val;
        else if (name === "예적금") savingsVal = val;
        else if (name === "보험연금") pensionVal = val;
        else if (name.includes("투자")) investVal = val;
        else if (name === "휴이") huiVal = val;
        else if (name === "순자산") totalNet = val;
    });
    
    // Financial assets is sum of Savings + Investments
    const financialVal = savingsVal + investVal;
    
    // Display values
    kpiValEstate.innerText = formatKRW(estateVal);
    kpiValFinancial.innerText = formatKRW(financialVal);
    kpiValPension.innerText = formatKRW(pensionVal);
    kpiValHui.innerText = formatKRW(huiVal);
    
    // Percentages
    const calcPct = (val) => totalNet > 0 ? ((val / totalNet) * 100).toFixed(1) + '%' : '0%';
    kpiPctEstate.innerText = calcPct(estateVal);
    kpiPctFinancial.innerText = calcPct(financialVal);
    kpiPctPension.innerText = calcPct(pensionVal);
    kpiPctHui.innerText = calcPct(huiVal);
    
    // Render portfolio doughnut chart
    renderPortfolioChart(estateVal, savingsVal, pensionVal, investVal, huiVal);
    
    // Bind table filter buttons
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentAssetFilter = btn.getAttribute("data-filter");
            renderAssetTable();
        });
    });
    
    // Render initial table rows
    renderAssetTable();
}

function renderPortfolioChart(estate, savings, pension, invest, hui) {
    const ctx = document.getElementById("portfolioDoughnutChart").getContext("2d");
    
    if (portfolioChart) {
        portfolioChart.destroy();
    }
    
    portfolioChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['부동산', '예적금', '보험/연금', '투자자산', '휴이'],
            datasets: [{
                data: [estate, savings, pension, invest, hui],
                backgroundColor: [
                    '#f59e0b', // orange
                    '#3b82f6', // blue
                    '#8b5cf6', // purple
                    '#10b981', // green
                    '#f43f5e'  // rose
                ],
                borderWidth: 2,
                borderColor: '#1e293b',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit, Noto Sans KR', size: 12 },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((val / total) * 100).toFixed(1) + '%';
                            return ` ${context.label}: ${formatShortKRW(val)} (${pct})`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderAssetTable() {
    const tbody = document.getElementById("asset-list-tbody");
    tbody.innerHTML = "";
    
    const items = dashboardData.current_assets.items;
    
    // Compute total assets sum (excluding negative marks, just sum them up)
    let totalSum = 0;
    items.forEach(item => {
        totalSum += item.value;
    });
    
    // Filter items
    const filteredItems = items.filter(item => {
        if (currentAssetFilter === 'all') return true;
        
        // Mapping asset classification
        if (currentAssetFilter === '부동산') return item.type === '부동산';
        if (currentAssetFilter === '예적금') return item.type === '예적금';
        if (currentAssetFilter === '보험/연금') return item.type === '보험/연금' || item.type === '보험연금';
        if (currentAssetFilter === '투자') return item.type === '투자' || item.type === '코인';
        return false;
    });
    
    filteredItems.forEach(item => {
        const pct = totalSum > 0 ? ((item.value / totalSum) * 100).toFixed(1) + '%' : '0%';
        const tr = document.createElement("tr");
        
        // Class color for badges
        let badgeClass = "badge-other";
        if (item.type === "부동산") badgeClass = "badge-estate";
        else if (item.type === "예적금") badgeClass = "badge-savings";
        else if (item.type === "보험/연금" || item.type === "보험연금") badgeClass = "badge-pension";
        else if (item.type === "투자") badgeClass = "badge-invest";
        else if (item.type === "휴이") badgeClass = "badge-hui";
        
        tr.innerHTML = `
            <td><span class="table-badge ${badgeClass}">${item.type}</span></td>
            <td class="font-weight-500">${item.name}</td>
            <td class="text-right font-numeric">${item.value.toLocaleString()}</td>
            <td class="text-right font-numeric text-secondary">${pct}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Trend Tab Logic
function initTrendTab() {
    const trendData = dashboardData.historical_trend;
    if (!trendData || trendData.length === 0) return;
    
    const labels = trendData.map(d => d.date);
    const netAssets = trendData.map(d => d.net_assets);
    const realEstate = trendData.map(d => d.real_estate);
    const savings = trendData.map(d => d.savings);
    const insurancePension = trendData.map(d => d.insurance_pension);
    const investment = trendData.map(d => d.investment);
    const hui = trendData.map(d => d.hui);
    
    // YoY statistics calculate
    const lastRecord = trendData[trendData.length - 1];
    const yoyVal = lastRecord.yoy_diff;
    const yoyElem = document.getElementById("yoy-amount");
    const yoyPctElem = document.getElementById("yoy-percentage");
    
    if (yoyVal !== null && yoyVal !== undefined) {
        yoyElem.innerText = formatKRW(yoyVal);
        yoyElem.className = yoyVal >= 0 ? "trend-stat-val text-green" : "trend-stat-val text-red";
        
        const previousYearVal = lastRecord.net_assets - yoyVal;
        if (previousYearVal > 0) {
            const growthRate = ((yoyVal / previousYearVal) * 100).toFixed(1);
            yoyPctElem.innerText = `${growthRate > 0 ? '+' : ''}${growthRate}%`;
            yoyPctElem.className = growthRate >= 0 ? "trend-stat-val text-green" : "trend-stat-val text-red";
        }
    }
    
    // Render growth line chart
    const ctx = document.getElementById("assetTrendLineChart").getContext("2d");
    if (trendChart) {
        trendChart.destroy();
    }
    
    const netAssetsData = trendData.map(d => ({ x: new Date(d.date).getTime(), y: d.net_assets }));
    const realEstateData = trendData.map(d => ({ x: new Date(d.date).getTime(), y: d.real_estate }));
    const savingsData = trendData.map(d => ({ x: new Date(d.date).getTime(), y: d.savings }));
    const insurancePensionData = trendData.map(d => ({ x: new Date(d.date).getTime(), y: d.insurance_pension }));
    const investmentData = trendData.map(d => ({ x: new Date(d.date).getTime(), y: d.investment }));
    const huiData = trendData.map(d => ({ x: new Date(d.date).getTime(), y: d.hui }));

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '순자산 합계',
                    data: netAssetsData,
                    borderColor: '#f8fafc',
                    borderWidth: 3,
                    pointBackgroundColor: '#f8fafc',
                    pointHoverRadius: 7,
                    tension: 0.15,
                    fill: false
                },
                {
                    label: '부동산',
                    data: realEstateData,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    pointBackgroundColor: '#f59e0b',
                    pointRadius: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '예적금',
                    data: savingsData,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '보험/연금',
                    data: insurancePensionData,
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    pointBackgroundColor: '#8b5cf6',
                    pointRadius: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '투자자산',
                    data: investmentData,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 2,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '휴이',
                    data: huiData,
                    borderColor: '#f43f5e',
                    borderWidth: 2,
                    pointBackgroundColor: '#f43f5e',
                    pointRadius: 2,
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit, Noto Sans KR' } }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const timestamp = context[0].raw.x;
                            const date = new Date(timestamp);
                            return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
                        },
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatShortKRW(context.raw.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Outfit, Noto Sans KR' },
                        callback: function(value) {
                            const date = new Date(value);
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            return `${y}-${m}`;
                        }
                    }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: '#94a3b8', 
                        font: { family: 'Outfit' },
                        callback: function(value) {
                            return (value / 10000).toFixed(1) + '억';
                        }
                    }
                }
            }
        }
    });
    
    // Render trend history list
    const tbody = document.getElementById("history-list-tbody");
    tbody.innerHTML = "";
    
    // Show top 12 records (reverse chronological)
    const displayRecords = [...trendData].reverse().slice(0, 12);
    displayRecords.forEach((record, index) => {
        const tr = document.createElement("tr");
        
        // Month-on-Month change
        let changeStr = "-";
        let changeClass = "text-secondary";
        
        // Find previous record chronologically
        const origIndex = trendData.findIndex(r => r.date === record.date);
        if (origIndex > 0) {
            const prev = trendData[origIndex - 1];
            const diff = record.net_assets - prev.net_assets;
            if (diff > 0) {
                changeStr = `+${diff.toLocaleString()}`;
                changeClass = "text-green font-numeric";
            } else if (diff < 0) {
                changeStr = `${diff.toLocaleString()}`;
                changeClass = "text-red font-numeric";
            } else {
                changeStr = "0";
                changeClass = "font-numeric";
            }
        }
        
        tr.innerHTML = `
            <td class="font-numeric">${record.date}</td>
            <td class="text-right font-numeric font-weight-500">${record.net_assets.toLocaleString()}</td>
            <td class="text-right ${changeClass}">${changeStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Goals Tab Logic
function initGoalsTab() {
    // Goal selectors
    const goalBtns = document.querySelectorAll(".goal-tab-btn");
    goalBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            goalBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentGoalType = btn.getAttribute("data-goal");
            renderGoalChart();
        });
    });
    
    renderGoalChart();
}

function renderGoalChart() {
    let projData = null;
    let chartTitle = "";
    
    if (currentGoalType === 'pension') {
        projData = dashboardData.pension_projection;
        chartTitle = "연금 자산 축적 시뮬레이션";
        document.getElementById("goal-chart-title").innerText = chartTitle;
    } else if (currentGoalType === 'investment') {
        projData = dashboardData.investment_projection;
        chartTitle = "투자 자산 목표액 시뮬레이션";
        document.getElementById("goal-chart-title").innerText = chartTitle;
    } else if (currentGoalType === 'hui') {
        projData = dashboardData.hui_projection;
        chartTitle = "휴이 목적 자산 마련 시뮬레이션";
        document.getElementById("goal-chart-title").innerText = chartTitle;
    }
    
    if (!projData || projData.length === 0) return;
    
    const ages = projData.map(d => `${d.age}세 (${d.year}년)`);
    const actuals = projData.map(d => d.actual);
    const expected6 = projData.map(d => d.expected_6pct);
    const expected8 = projData.map(d => d.expected_8pct);
    const expected10 = projData.map(d => d.expected_10pct);
    
    const ctx = document.getElementById("goalSimulationChart").getContext("2d");
    if (goalChart) {
        goalChart.destroy();
    }
    
    goalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ages,
            datasets: [
                {
                    label: '실제 누적액',
                    data: actuals,
                    borderColor: '#10b981', // green
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 3.5,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '복리 6% 시뮬레이션',
                    data: expected6,
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '복리 8% 시뮬레이션',
                    data: expected8,
                    borderColor: '#8b5cf6',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: '복리 10% 시뮬레이션',
                    data: expected10,
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit, Noto Sans KR' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatShortKRW(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit, Noto Sans KR' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: '#94a3b8', 
                        font: { family: 'Outfit' },
                        callback: function(value) {
                            return (value / 10000).toFixed(1) + '억';
                        }
                    }
                }
            }
        }
    });
}

// Future Projection Tab Logic (Interactive Simulator)
function initProjectionTab() {
    // 1. Get initial values from current assets
    const items = dashboardData.current_assets.items;
    let initEstate = 0, initSavings = 0, initPension = 0, initInvest = 0, initHui = 0;
    
    items.forEach(item => {
        if (item.type === "부동산") initEstate += item.value;
        else if (item.type === "예적금") initSavings += item.value;
        else if (item.type === "보험/연금" || item.type === "보험연금") initPension += item.value;
        else if (item.type === "투자" || item.type === "코인") initInvest += item.value;
        else if (item.type === "휴이") initHui += item.value;
    });

    // 2. Slider references
    const retireAgeInput = document.getElementById("input-sim-retire-age");
    const incomeInput = document.getElementById("input-sim-income");
    const expensesInput = document.getElementById("input-sim-expenses");
    const returnInput = document.getElementById("input-sim-return");
    const inflationInput = document.getElementById("input-sim-inflation");

    // 3. Attach slider events
    [retireAgeInput, incomeInput, expensesInput, returnInput, inflationInput].forEach(input => {
        if (input) {
            input.addEventListener("input", () => {
                updateSliderLabels();
                runSimulation();
            });
        }
    });

    function updateSliderLabels() {
        document.getElementById("val-sim-retire-age").innerText = retireAgeInput.value + "세";
        document.getElementById("val-sim-income").innerText = Number(incomeInput.value).toLocaleString() + "만원";
        document.getElementById("val-sim-expenses").innerText = Number(expensesInput.value).toLocaleString() + "만원";
        document.getElementById("val-sim-return").innerText = Number(returnInput.value).toFixed(1) + "%";
        document.getElementById("val-sim-inflation").innerText = Number(inflationInput.value).toFixed(1) + "%";
    }

    // Initialize labels
    updateSliderLabels();

    // 4. Simulation Engine
    function runSimulation() {
        const retireAge = parseInt(retireAgeInput.value);
        const annualIncome = parseFloat(incomeInput.value);
        const annualExpenses = parseFloat(expensesInput.value);
        const investReturn = parseFloat(returnInput.value) / 100;
        const inflation = parseFloat(inflationInput.value) / 100;

        const startAge = 43; // Year 2026
        const startYear = 2026;
        const yearsToSimulate = 30; // 30 years projection

        let currentEstate = initEstate;
        let currentSavings = initSavings;
        let currentPension = initPension;
        let currentInvest = initInvest;
        let currentHui = initHui;

        const yearsLabels = [];
        const totalAssetsData = [];
        const estateData = [];
        const savingsData = [];
        const pensionData = [];
        const investData = [];
        const huiData = [];
        const timelineEvents = [];

        for (let i = 0; i < yearsToSimulate; i++) {
            const year = startYear + i;
            const age = startAge + i;
            yearsLabels.push(`${year}년 (${age}세)`);

            // Apply returns on existing assets
            currentEstate = currentEstate * (1 + inflation);
            currentSavings = currentSavings * (1 + Math.min(0.025, inflation));
            currentPension = currentPension * (1 + Math.max(0.03, investReturn - 0.02));
            currentInvest = currentInvest * (1 + investReturn);
            currentHui = currentHui * (1 + investReturn * 0.8);

            // Calculate current year income & expenses
            let income = 0;
            if (age < retireAge) {
                // Salary grows at 2% annually
                income = annualIncome * Math.pow(1 + 0.02, i);
            } else if (age === retireAge) {
                timelineEvents.push({
                    year: year,
                    event: `${retireAge}세 은퇴 시작 (소득 중단)`,
                    desc: `자산 소득과 모아둔 적금/연금을 통해 은퇴 생활을 영위합니다.`
                });
            }

            // Expenses grow at inflation
            const expenses = annualExpenses * Math.pow(1 + inflation, i);
            const surplus = income - expenses;

            if (surplus > 0) {
                // Surplus distribution logic
                // Maximize pension contributions first, then invest, then save
                const pensionContrib = Math.min(surplus * 0.3, 1800); // max 1800/yr to pension
                const investContrib = surplus * 0.5;
                const savingsContrib = surplus - pensionContrib - investContrib;

                currentPension += pensionContrib;
                currentInvest += investContrib;
                currentSavings += savingsContrib;
            } else {
                // Deficit withdrawal logic (Withdraw to cover living expenses)
                let deficit = Math.abs(surplus);

                // Withdraw from savings first
                if (currentSavings >= deficit) {
                    currentSavings -= deficit;
                    deficit = 0;
                } else {
                    deficit -= currentSavings;
                    currentSavings = 0;
                }

                // Withdraw from investments second
                if (deficit > 0) {
                    if (currentInvest >= deficit) {
                        currentInvest -= deficit;
                        deficit = 0;
                    } else {
                        deficit -= currentInvest;
                        currentInvest = 0;
                    }
                }

                // Withdraw from pension third
                if (deficit > 0) {
                    if (currentPension >= deficit) {
                        currentPension -= deficit;
                        deficit = 0;
                    } else {
                        deficit -= currentPension;
                        currentPension = 0;
                    }
                }

                // If still deficit, subtract from estate (downsizing or debt)
                if (deficit > 0) {
                    currentEstate = Math.max(0, currentEstate - deficit);
                }
            }

            const total = currentEstate + currentSavings + currentPension + currentInvest + currentHui;
            totalAssetsData.push(Math.round(total));
            estateData.push(Math.round(currentEstate));
            savingsData.push(Math.round(currentSavings));
            pensionData.push(Math.round(currentPension));
            investData.push(Math.round(currentInvest));
            huiData.push(Math.round(currentHui));

            // Check for pension contribution end (e.g. 2028 or 3 years from start)
            if (year === 2028) {
                timelineEvents.push({
                    year: 2028,
                    event: "연금저축 납입 만료",
                    desc: "계획에 따라 연금저축의 의무 납입 기간이 종료됩니다."
                });
            }

            // Check for asset exhaustion
            if (total <= 0 && !timelineEvents.some(e => e.event === "자산 소진 시점")) {
                timelineEvents.push({
                    year: year,
                    event: "자산 소진 시점 ⚠️",
                    desc: `${age}세 시점에 시뮬레이션 상의 총자산이 모두 소진됩니다. 소득을 높이거나 생활비를 줄여야 합니다.`
                });
            }
        }

        // 5. Draw Dynamic Chart
        const ctx = document.getElementById("futureProjectionChart").getContext("2d");
        if (projectionChart) {
            projectionChart.destroy();
        }

        projectionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: yearsLabels,
                datasets: [
                    {
                        type: 'line',
                        label: '예상 총자산 합계',
                        data: totalAssetsData,
                        borderColor: '#f8fafc',
                        borderWidth: 3.5,
                        pointBackgroundColor: '#f8fafc',
                        tension: 0.15,
                        order: -1
                    },
                    {
                        label: '부동산',
                        data: estateData,
                        backgroundColor: '#f59e0b', // orange
                        stack: 'Stack0'
                    },
                    {
                        label: '예적금',
                        data: savingsData,
                        backgroundColor: '#3b82f6', // blue
                        stack: 'Stack0'
                    },
                    {
                        label: '보험/연금',
                        data: pensionData,
                        backgroundColor: '#8b5cf6', // purple
                        stack: 'Stack0'
                    },
                    {
                        label: '투자자산',
                        data: investData,
                        backgroundColor: '#10b981', // green
                        stack: 'Stack0'
                    },
                    {
                        label: '휴이자산',
                        data: huiData,
                        backgroundColor: '#f43f5e', // rose
                        stack: 'Stack0'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8', font: { family: 'Outfit, Noto Sans KR' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatShortKRW(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#94a3b8', font: { family: 'Outfit, Noto Sans KR' } }
                    },
                    y: {
                        stacked: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { 
                            color: '#94a3b8', 
                            font: { family: 'Outfit' },
                            callback: function(value) {
                                return (value / 10000).toFixed(1) + '억';
                            }
                        }
                    }
                }
            }
        });

        // 6. Update Timeline
        const timelineElem = document.getElementById("future-timeline");
        timelineElem.innerHTML = "";

        // Sort events chronologically
        const sortedEvents = timelineEvents.sort((a, b) => a.year - b.year);
        sortedEvents.forEach(ev => {
            const item = document.createElement("div");
            item.className = "timeline-item";
            
            item.innerHTML = `
                <div class="timeline-badge">${ev.year % 100}</div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-year">${ev.year}년도</span>
                        <span class="timeline-event">${ev.event}</span>
                    </div>
                    <p class="timeline-desc">${ev.desc}</p>
                </div>
            `;
            timelineElem.appendChild(item);
        });

        // 7. Update initial Cash Flow Summary
        document.getElementById("cf-salary").innerText = formatKRW(annualIncome);
        document.getElementById("cf-living").innerText = formatKRW(annualExpenses);
        
        const initialSurplus = annualIncome - annualExpenses;
        const surplusElem = document.getElementById("cf-surplus");
        surplusElem.innerText = formatKRW(initialSurplus);
        surplusElem.className = initialSurplus >= 0 ? "cashflow-val text-green" : "cashflow-val text-red";

        // Distribute surplus visual
        const allocContainer = document.getElementById("cf-allocations");
        if (initialSurplus > 0) {
            const pensionContrib = Math.min(initialSurplus * 0.3, 1800);
            const investContrib = initialSurplus * 0.5;
            const savingsContrib = initialSurplus - pensionContrib - investContrib;
            
            allocContainer.innerHTML = `
                <h4 class="strategy-block-title">초기 잉여금 분배 구조 (연간)</h4>
                <div class="alloc-item"><span>보험/연금 연간 적립</span><span>${formatKRW(pensionContrib)}</span></div>
                <div class="alloc-item"><span>투자자산 연간 적립</span><span>${formatKRW(investContrib)}</span></div>
                <div class="alloc-item"><span>예적금 연간 적립</span><span>${formatKRW(savingsContrib)}</span></div>
            `;
        } else {
            allocContainer.innerHTML = `
                <h4 class="strategy-block-title text-red">⚠️ 초기 예산 부족</h4>
                <p class="strategy-desc">생활비가 수입보다 많습니다. 자산 소진 속도가 빨라질 수 있습니다.</p>
            `;
        }
    }

    // Run first simulation
    runSimulation();
}

// Strategy Tab Logic
function initStrategyTab() {
    const strategies = dashboardData.pension_strategies;
    const cardsContainer = document.getElementById("strategy-cards-container");
    cardsContainer.innerHTML = "";
    
    strategies.forEach(st => {
        const card = document.createElement("div");
        card.className = "strategy-card glass-panel";
        
        // Strategy icons matching account type
        let iconHtml = '<i data-lucide="shield-alert"></i>';
        if (st.name === "연금저축") iconHtml = '<i data-lucide="badge-percent" class="text-purple"></i>';
        else if (st.name === "IRP") iconHtml = '<i data-lucide="piggy-bank" class="text-blue"></i>';
        else if (st.name === "ISA") iconHtml = '<i data-lucide="gem" class="text-cyan"></i>';
        
        card.innerHTML = `
            <div class="strategy-card-header">
                <h4>${st.name}</h4>
                <div class="kpi-icon">${iconHtml}</div>
            </div>
            <div class="strategy-card-body">
                <div class="strategy-row">
                    <span class="strategy-lbl">연간 납입액</span>
                    <span class="strategy-val">${st.annual_payment ? st.annual_payment + '만원 (월 ' + st.monthly_payment + '만)' : '-'}</span>
                </div>
                <div class="strategy-row">
                    <span class="strategy-lbl">소득 공제 / 한도</span>
                    <span class="strategy-val">${st.deduction ? st.deduction + '만원 한도' : '-'}</span>
                </div>
                <div class="strategy-row">
                    <span class="strategy-lbl">안전자산 의무비율</span>
                    <span class="strategy-val">${(st.safe_asset_ratio !== null && typeof st.safe_asset_ratio === 'number') ? (st.safe_asset_ratio * 100) + '%' : '-'}</span>
                </div>
                
                <div class="strategy-block">
                    <span class="strategy-block-title">보돌 운용전략</span>
                    <p class="strategy-desc">${st.strategy_bodol || "설정된 전략 없음"}</p>
                </div>
                ${st.strategy_ppaekdol ? `
                <div class="strategy-block">
                    <span class="strategy-block-title">빽돌 운용전략</span>
                    <p class="strategy-desc">${st.strategy_ppaekdol}</p>
                </div>
                ` : ''}
            </div>
        `;
        cardsContainer.appendChild(card);
    });
    
    // Lucide reload for dynamically added icons
    lucide.createIcons();
    
    // Table rows details
    const tableBody = document.getElementById("strategy-table-tbody");
    tableBody.innerHTML = "";
    strategies.forEach(st => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="font-weight-500">${st.name}</td>
            <td class="font-numeric">${st.deduction ? st.deduction + ' 만원' : '-'}</td>
            <td>${st.annual_limit ? st.annual_limit.toLocaleString() + ' 만원' : '제한 없음'}</td>
            <td>${st.tax_free_dividend || '-'}</td>
            <td>${st.withdrawal_age || '-'}</td>
            <td class="font-numeric">${(st.safe_asset_ratio !== null && typeof st.safe_asset_ratio === 'number') ? (st.safe_asset_ratio * 100) + '%' : '-'}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    // Render salary chart
    initSalaryChart();
}

function initSalaryChart() {
    const salaries = dashboardData.salary_history;
    if (!salaries || salaries.length === 0) return;
    
    const years = salaries.map(d => `${d.year}년`);
    const salaryAmounts = salaries.map(d => d.salary / 10000); // converting to 만원
    const growthRates = salaries.map(d => d.growth_rate * 100);
    
    const ctx = document.getElementById("salaryHistoryChart").getContext("2d");
    if (salaryChart) {
        salaryChart.destroy();
    }
    
    salaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    type: 'line',
                    label: '연봉 상승률 (%)',
                    data: growthRates,
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    pointBackgroundColor: '#8b5cf6',
                    yAxisID: 'y1',
                    order: -1
                },
                {
                    label: '당해연봉 (만원)',
                    data: salaryAmounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.45)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit, Noto Sans KR' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return ` ${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                            }
                            return ` ${context.dataset.label}: ${(context.raw * 10000).toLocaleString()}원`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: '#94a3b8', 
                        font: { family: 'Outfit' },
                        callback: function(value) {
                            return value.toLocaleString() + '만';
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { 
                        color: '#94a3b8', 
                        font: { family: 'Outfit' },
                        callback: function(value) {
                            return value.toFixed(0) + '%';
                        }
                    }
                }
            }
        }
    });
}

// Resize helper to prevent canvas squeeze
function resizeCharts() {
    setTimeout(() => {
        if (portfolioChart) portfolioChart.resize();
        if (trendChart) trendChart.resize();
        if (goalChart) goalChart.resize();
        if (projectionChart) projectionChart.resize();
        if (salaryChart) salaryChart.resize();
        if (stockCategoryChart) stockCategoryChart.resize();
    }, 100);
}

// Detailed Stock Portfolio Tab Logic
function initStockPortfolioTab() {
    if (!kbPortfolioData) return;
    
    // 1. KPI elements
    const totalVal = kbPortfolioData.total_value;
    let totalReturn = 0;
    
    // Calculate category sums
    const categorySums = {
        "AI/반도체/테크": 0,
        "배당/채권혼합": 0,
        "금리/안전자산": 0,
        "기타/현금": 0
    };
    
    kbPortfolioData.holdings.forEach(item => {
        totalReturn += item.return_amount;
        if (categorySums[item.category] !== undefined) {
            categorySums[item.category] += item.value;
        }
    });
    
    const totalInvested = totalVal - totalReturn;
    const avgReturnRate = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    
    // Update elements
    document.getElementById("stock-total-value").innerText = totalVal.toLocaleString() + " 원";
    
    const returnAmtElem = document.getElementById("stock-total-return-amount");
    returnAmtElem.innerText = (totalReturn >= 0 ? "+" : "") + totalReturn.toLocaleString() + " 원";
    returnAmtElem.className = totalReturn >= 0 ? "kpi-value text-green" : "kpi-value text-red";
    
    const returnRateElem = document.getElementById("stock-total-return-rate");
    returnRateElem.innerText = (avgReturnRate >= 0 ? "+" : "") + avgReturnRate.toFixed(2) + "%";
    returnRateElem.className = avgReturnRate >= 0 ? "pct-badge text-green" : "pct-badge text-red";
    
    // 2. Render Sector/Theme Doughnut Chart
    const ctx = document.getElementById("stockCategoryDoughnutChart").getContext("2d");
    if (stockCategoryChart) {
        stockCategoryChart.destroy();
    }
    
    stockCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categorySums),
            datasets: [{
                data: Object.values(categorySums),
                backgroundColor: [
                    '#8b5cf6', // purple (AI/반도체/테크)
                    '#10b981', // green (배당/채권혼합)
                    '#3b82f6', // blue (금리/안전자산)
                    '#f59e0b'  // orange (기타/현금)
                ],
                borderWidth: 2,
                borderColor: '#1e293b',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit, Noto Sans KR', size: 12 },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const pct = ((val / totalVal) * 100).toFixed(1) + '%';
                            return ` ${context.label}: ${val.toLocaleString()}원 (${pct})`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
    
    // 3. Render Holdings Table (Sorted by Weight Descending)
    const tbody = document.getElementById("stock-list-tbody");
    tbody.innerHTML = "";
    
    const sortedHoldings = [...kbPortfolioData.holdings].sort((a, b) => b.value - a.value);
    
    sortedHoldings.forEach(item => {
        const tr = document.createElement("tr");
        const pct = totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) + '%' : '0%';
        
        // Badge color mapping
        let badgeClass = "badge-other";
        if (item.category === "AI/반도체/테크") badgeClass = "badge-pension";
        else if (item.category === "배당/채권혼합") badgeClass = "badge-invest";
        else if (item.category === "금리/안전자산") badgeClass = "badge-savings";
        else if (item.category === "기타/현금") badgeClass = "badge-estate";
        
        const retSign = item.return_amount >= 0 ? "+" : "";
        const retClass = item.return_amount > 0 ? "text-green font-numeric" : (item.return_amount < 0 ? "text-red font-numeric" : "font-numeric");
        const rateSign = item.return_rate >= 0 ? "+" : "";
        const rateClass = item.return_rate > 0 ? "text-green font-numeric" : (item.return_rate < 0 ? "text-red font-numeric" : "font-numeric");
        
        tr.innerHTML = `
            <td class="font-weight-500">${item.name}</td>
            <td><span class="table-badge ${badgeClass}">${item.category}</span></td>
            <td class="text-right font-numeric">${item.value.toLocaleString()}</td>
            <td class="text-right ${retClass}">${item.return_amount ? retSign + item.return_amount.toLocaleString() : '-'}</td>
            <td class="text-right ${rateClass}">${item.return_rate !== 0 ? rateSign + (item.return_rate * 100).toFixed(2) + '%' : '-'}</td>
            <td class="text-right font-numeric text-secondary">${pct}</td>
        `;
        tbody.appendChild(tr);
    });
}
